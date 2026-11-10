#!/usr/bin/env bash
# Sali VPN node — protects the server itself (owner side). Safe to run again at any time.
#
#   curl -fsSL https://api.salivpn.com/api/v1/nodes/harden.sh | bash
#
# - root logs in over SSH only with the admins' keys (infrastructure/vpn-node/admin_keys.pub);
#   passwords stop working over SSH. Only if at least one key is installed — never locks you out.
#   The Vultr/Hetzner web console still accepts the root password as an emergency way in.
# - fail2ban bans an IP for an hour after 5 failed SSH logins (state lives in RAM, like all logs here).
# - security updates install automatically every day.
set -euo pipefail

API="${SALI_API:-https://api.salivpn.com}"
say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!! %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "запустите от root"
export DEBIAN_FRONTEND=noninteractive
APT="apt-get -o DPkg::Lock::Timeout=180 -y -qq"

say "Ключи администраторов"
install -d -m 700 /root/.ssh
touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
keys="$(curl -fsSL "$API/api/v1/nodes/admin_keys.pub" 2>/dev/null || true)"
added=0
while IFS= read -r key; do
  key="$(printf '%s' "$key" | tr -d '\r')"
  case "$key" in
    ssh-ed25519\ *|ssh-rsa\ *|ecdsa-sha2-*)
      if ! grep -qxF "$key" /root/.ssh/authorized_keys; then
        printf '%s\n' "$key" >> /root/.ssh/authorized_keys
        added=$((added + 1))
      fi ;;
  esac
done <<< "$keys"
total="$(grep -cE '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-)' /root/.ssh/authorized_keys || true)"
echo "добавлено ключей: $added, всего: $total"

say "Вход по SSH"
if [ "${total:-0}" -gt 0 ]; then
  # 00- so it wins over Ubuntu's 50-cloud-init.conf (sshd keeps the first value it reads).
  cat >/etc/ssh/sshd_config.d/00-sali-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PubkeyAuthentication yes
MaxAuthTries 3
LoginGraceTime 20
X11Forwarding no
EOF
  sshd -t || { rm -f /etc/ssh/sshd_config.d/00-sali-hardening.conf; die "проверка настроек SSH не прошла — ничего не изменено"; }
  systemctl try-reload-or-restart ssh 2>/dev/null || systemctl try-reload-or-restart sshd 2>/dev/null || true
  SSH_MODE="только по ключу"
else
  warn "Ключей администраторов нет — вход по паролю оставлен, чтобы не потерять доступ."
  SSH_MODE="по паролю (нет ключей)"
fi

say "Защита от подбора пароля"
$APT install fail2ban unattended-upgrades >/dev/null
mkdir -p /etc/fail2ban/jail.d
cat >/etc/fail2ban/jail.d/sali.conf <<'EOF'
[DEFAULT]
backend  = systemd
bantime  = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF
systemctl enable -q fail2ban
systemctl restart fail2ban

say "Автоматические обновления безопасности"
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
systemctl enable -q --now unattended-upgrades 2>/dev/null || true

printf '\n\033[1;32mГотово: защита сервера включена. SSH: %s · fail2ban · автообновления безопасности.\033[0m\n' "$SSH_MODE"
