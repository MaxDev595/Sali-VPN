# Sali VPN for Windows

Electron app with the same flow as the Android app: silent sign-in (Sali ID), codes from the
Telegram bot, one-tap connect. The tunnel runs through the official WireGuard for Windows
service (`wireguard.exe /installtunnelservice`); if WireGuard is missing, the bundled MSI is
installed silently on first connect.

- `npm install && npm start` — run locally (Windows, as administrator for the VPN part).
- `npm run dist` — build `dist/SaliVPN-Setup.exe` and `dist/SaliVPN-Portable.exe`.
- CI: `.github/workflows/desktop.yml` builds on `windows-latest` and publishes the
  `desktop-latest` release: https://github.com/MaxDev595/Sali-VPN/releases/download/desktop-latest/SaliVPN-Setup.exe

The API address is discovered from `https://salivpn.com/config.json` (`{ "apiUrl": "https://…" }`,
written by `npm run dev:publish`), falling back to `SALI_API_URL` / https://salivpn.com.
