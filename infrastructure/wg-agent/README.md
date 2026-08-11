# Sali wg-agent

A minimal HTTP wrapper around WireGuard (`wg`) that runs **on the VPN server
itself**, so the Sali VPN backend (`apps/api`) never needs root or SSH access
to your VPN boxes. The backend's `WireGuardProvider` talks to this agent over
HTTP with a bearer token.

## Why this exists

WireGuard has no built-in multi-user management API — adding/removing peers
means running `wg set ...` as root. Rather than giving the application
backend that level of access to every VPN node, each node runs this small,
narrowly-scoped agent instead.

## Setup on a fresh Ubuntu 22.04 VPN server

```bash
# 1. Install WireGuard
sudo apt update && sudo apt install -y wireguard nodejs npm

# 2. Generate the server keypair (once)
sudo mkdir -p /etc/wireguard
wg genkey | sudo tee /etc/wireguard/server_private.key | wg pubkey | sudo tee /etc/wireguard/server_public.key
sudo chmod 600 /etc/wireguard/server_private.key

# 3. Create /etc/wireguard/wg0.conf
cat <<EOF | sudo tee /etc/wireguard/wg0.conf
[Interface]
PrivateKey = $(sudo cat /etc/wireguard/server_private.key)
Address = 10.66.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
EOF

# 4. Bring the interface up and enable IP forwarding
sudo sysctl -w net.ipv4.ip_forward=1
sudo wg-quick up wg0
sudo systemctl enable wg-quick@wg0

# 5. Install and run this agent
cd infrastructure/wg-agent
npm install
AGENT_API_KEY=$(openssl rand -hex 32) node index.js
```

Print the generated `AGENT_API_KEY` and put it in the main project's `.env`
as `WIREGUARD_API_KEY`. Set `WIREGUARD_API_URL` to point at this agent (e.g.
`http://127.0.0.1:51821` if the API and agent run on the same box, or over a
private network / SSH tunnel if they don't).

Run the agent under a process manager (systemd unit or pm2) so it restarts on
boot and on crash.

## Security notes

- The agent binds to `127.0.0.1` by default — expose it to the API server
  only via an SSH tunnel, WireGuard-to-WireGuard link, or your cloud
  provider's private networking, never directly on the public internet.
- Rotate `AGENT_API_KEY` periodically.
- The agent never returns the server's private key — only its public key
  (`GET /server-public-key`), used to build client configs.
