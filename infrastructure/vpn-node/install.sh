#!/usr/bin/env bash
# Sali VPN — turns a fresh Ubuntu 22.04/24.04 server into a VPN node and connects it to Sali.
#
#   curl -fsSL https://api.salivpn.com/api/v1/nodes/install.sh | bash -s -- <ENROLL_TOKEN>
#
# The one-time token comes from the Sali bot (/addserver, admins only).
# Installs AmneziaWG (obfuscated WireGuard, works where WireGuard is blocked) and plain
# WireGuard side by side, tunes the network, starts the node agent and registers the
# server in Sali. Safe to re-run: keys and peers are kept.
set -euo pipefail

TOKEN="${1:-}"
API="${SALI_API:-https://api.salivpn.com}"
DIR=/etc/sali-node
APP=/opt/sali-node
AGENT_PORT=8443
WG_PORT=51820

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "запустите от root (sudo -i)"
[ -n "$TOKEN" ] || die "нужен токен: bash -s -- <TOKEN> (получите его в боте командой /addserver)"
. /etc/os-release
[ "${ID:-}" = ubuntu ] || die "нужна Ubuntu 22.04 или 24.04"

say "Устанавливаю пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -qq
apt-get install -y -qq software-properties-common curl ca-certificates openssl iptables wireguard-tools nodejs unbound >/dev/null
apt-get install -y -qq "linux-headers-$(uname -r)" >/dev/null 2>&1 || apt-get install -y -qq linux-headers-generic >/dev/null
add-apt-repository -y ppa:amnezia/ppa >/dev/null
apt-get update -y -qq
apt-get install -y -qq amneziawg amneziawg-tools >/dev/null
modprobe amneziawg || die "модуль AmneziaWG не загрузился (обновите ядро: apt upgrade && reboot, затем запустите снова)"
modprobe wireguard || true

say "Настраиваю сеть"
ETH="$(ip -4 route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="dev"){print $(i+1); exit}}')"
IP="$(ip -4 route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}')"
[ -n "$ETH" ] && [ -n "$IP" ] || die "не удалось определить сетевой интерфейс"
cat >/etc/sysctl.d/90-sali-vpn.conf <<EOF
net.ipv4.ip_forward=1
net.ipv6.conf.all.forwarding=1
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.core.rmem_max=26214400
net.core.wmem_max=26214400
net.core.netdev_max_backlog=16384
net.ipv4.tcp_mtu_probing=1
EOF
sysctl --system >/dev/null

mkdir -p "$DIR" "$APP" /etc/amnezia/amneziawg /etc/wireguard
chmod 700 "$DIR"

say "Ключи и параметры маскировки"
[ -f "$DIR/awg.key" ] || awg genkey >"$DIR/awg.key"
[ -f "$DIR/wg.key" ] || wg genkey >"$DIR/wg.key"
[ -f "$DIR/agent.key" ] || openssl rand -hex 32 >"$DIR/agent.key"
chmod 600 "$DIR"/*.key
if [ ! -f "$DIR/awg.params" ]; then
  r() { shuf -i "$1-$2" -n 1; }
  S1=$(r 15 150); S2=$(r 15 150); while [ $((S1 + 56)) -eq "$S2" ]; do S2=$(r 15 150); done
  H=($(shuf -i 5-2147483647 -n 4))
  cat >"$DIR/awg.params" <<EOF
AWG_PORT=$(r 30000 60000)
JC=$(r 4 8)
JMIN=40
JMAX=70
S1=$S1
S2=$S2
H1=${H[0]}
H2=${H[1]}
H3=${H[2]}
H4=${H[3]}
EOF
fi
. "$DIR/awg.params"

if [ ! -f "$DIR/tls.crt" ]; then
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 3650 \
    -subj "/CN=sali-node" -addext "subjectAltName=IP:$IP" \
    -keyout "$DIR/tls.key" -out "$DIR/tls.crt" >/dev/null 2>&1
  chmod 600 "$DIR/tls.key"
fi

# Privacy rules, inserted above the ACCEPTs (iptables -I puts each new rule first):
#  - clients can't reach each other, in the same tunnel or across awg0/wg0 (10.66.0.0/15 = both);
#  - clients can't reach the hoster's private networks or the cloud metadata service.
PRIVATE_NETS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,169.254.0.0/16,100.64.0.0/10"
nat() { # $1 = subnet
  local up="iptables -I FORWARD -i %i -j ACCEPT; iptables -I FORWARD -o %i -j ACCEPT"
  up="$up; iptables -I FORWARD -i %i -o $ETH -d $PRIVATE_NETS -j DROP"
  up="$up; iptables -I FORWARD -s 10.66.0.0/15 -d 10.66.0.0/15 -j DROP"
  up="$up; iptables -t nat -A POSTROUTING -s $1 -o $ETH -j MASQUERADE; iptables -t mangle -A FORWARD -o %i -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu"
  local down="iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT"
  down="$down; iptables -D FORWARD -i %i -o $ETH -d $PRIVATE_NETS -j DROP"
  down="$down; iptables -D FORWARD -s 10.66.0.0/15 -d 10.66.0.0/15 -j DROP"
  down="$down; iptables -t nat -D POSTROUTING -s $1 -o $ETH -j MASQUERADE; iptables -t mangle -D FORWARD -o %i -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu"
  echo "PostUp = $up; systemctl --no-block try-restart sali-node-agent unbound"
  echo "PostDown = $down"
}

cat >/etc/amnezia/amneziawg/awg0.conf <<EOF
[Interface]
PrivateKey = $(cat "$DIR/awg.key")
Address = 10.67.0.1/16
ListenPort = $AWG_PORT
Jc = $JC
Jmin = $JMIN
Jmax = $JMAX
S1 = $S1
S2 = $S2
H1 = $H1
H2 = $H2
H3 = $H3
H4 = $H4
$(nat 10.67.0.0/16)
EOF
cat >/etc/wireguard/wg0.conf <<EOF
[Interface]
PrivateKey = $(cat "$DIR/wg.key")
Address = 10.66.0.1/16
ListenPort = $WG_PORT
$(nat 10.66.0.0/16)
EOF
chmod 600 /etc/amnezia/amneziawg/awg0.conf /etc/wireguard/wg0.conf

say "Свой DNS без журналов"
# Clients resolve names on this server (10.67.0.1 / 10.66.0.1), not at Google or Cloudflare.
# Unbound resolves recursively from the root servers, with QNAME minimisation and DNSSEC,
# and logs nothing: no query log, no reply log, verbosity 0.
cat >/etc/unbound/unbound.conf.d/sali.conf <<'EOF'
server:
  interface: 10.67.0.1
  interface: 10.66.0.1
  ip-freebind: yes
  access-control: 0.0.0.0/0 refuse
  access-control: 10.66.0.0/15 allow
  verbosity: 0
  log-queries: no
  log-replies: no
  log-servfail: no
  log-local-actions: no
  use-syslog: no
  logfile: ""
  hide-identity: yes
  hide-version: yes
  qname-minimisation: yes
  harden-glue: yes
  harden-dnssec-stripped: yes
  aggressive-nsec: yes
  prefetch: yes
  cache-max-ttl: 3600
  rrset-roundrobin: yes
  private-address: 10.0.0.0/8
  private-address: 172.16.0.0/12
  private-address: 192.168.0.0/16
  private-address: 169.254.0.0/16
EOF
unbound-checkconf >/dev/null || die "ошибка в настройке DNS (unbound-checkconf)"
systemctl disable --now -q unbound-resolvconf 2>/dev/null || true # keep the server's own resolver untouched
systemctl enable -q unbound

say "Журналы только в памяти"
# Nothing about clients is written to disk: the system journal lives in RAM, is capped and
# forgets entries after a day; it is wiped on reboot. (The tunnels themselves log nothing.)
mkdir -p /etc/systemd/journald.conf.d
cat >/etc/systemd/journald.conf.d/90-sali-privacy.conf <<'EOF'
[Journal]
Storage=volatile
RuntimeMaxUse=32M
MaxRetentionSec=1day
ForwardToSyslog=no
EOF
rm -rf /var/log/journal
systemctl restart systemd-journald

cat >"$DIR/node.json" <<EOF
{ "apiKey": "$(cat "$DIR/agent.key")", "port": $AGENT_PORT,
  "awg": { "iface": "awg0", "port": $AWG_PORT, "prefix": "10.67",
           "params": { "Jc": $JC, "Jmin": $JMIN, "Jmax": $JMAX, "S1": $S1, "S2": $S2, "H1": $H1, "H2": $H2, "H3": $H3, "H4": $H4 } },
  "wg":  { "iface": "wg0", "port": $WG_PORT, "prefix": "10.66" } }
EOF
chmod 600 "$DIR/node.json"

say "Запускаю туннели и агента"
curl -fsSL "$API/api/v1/nodes/agent.js" -o "$APP/agent.js"
cat >/etc/systemd/system/sali-node-agent.service <<EOF
[Unit]
Description=Sali VPN node agent
After=network-online.target awg-quick@awg0.service wg-quick@wg0.service
Wants=network-online.target

[Service]
ExecStart=/usr/bin/node $APP/agent.js
Restart=always
RestartSec=2
Environment=SALI_NODE_DIR=$DIR

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable -q awg-quick@awg0 wg-quick@wg0 sali-node-agent
systemctl restart awg-quick@awg0 wg-quick@wg0
systemctl restart unbound sali-node-agent
sleep 2
systemctl is-active -q sali-node-agent || die "агент не запустился: journalctl -u sali-node-agent -n 50"

# Let the API reach the agent and clients reach the tunnels if a firewall is on.
if command -v ufw >/dev/null && ufw status | grep -q active; then
  ufw allow "$AGENT_PORT"/tcp >/dev/null; ufw allow "$AWG_PORT"/udp >/dev/null; ufw allow "$WG_PORT"/udp >/dev/null
  for i in awg0 wg0; do ufw allow in on "$i" to any port 53 >/dev/null; done
fi

say "Подключаю сервер к Sali"
SALI_TOKEN="$TOKEN" SALI_API="$API" SALI_IP="$IP" SALI_DIR="$DIR" node - <<'EOF'
const fs = require('fs');
const dir = process.env.SALI_DIR;
const node = JSON.parse(fs.readFileSync(`${dir}/node.json`, 'utf8'));
const body = {
  token: process.env.SALI_TOKEN,
  host: process.env.SALI_IP,
  hostname: require('os').hostname(),
  agentPort: node.port,
  agentKey: node.apiKey,
  certPem: fs.readFileSync(`${dir}/tls.crt`, 'utf8'),
};
fetch(`${process.env.SALI_API}/api/v1/nodes/enroll`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  .then(async (r) => { const t = await r.text(); if (!r.ok) { console.error(`Сервер не подключён: ${r.status} ${t}`); process.exit(1); } console.log(`Готово: ${JSON.parse(t).name} подключён к Sali VPN.`); })
  .catch((e) => { console.error(`Не удалось связаться с ${process.env.SALI_API}: ${e.message}`); process.exit(1); });
EOF
