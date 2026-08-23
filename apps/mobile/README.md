# Sali VPN Mobile

React Native/Expo application for iOS and Android. It reuses the existing Sali backend contracts and keeps all tunnel work behind the native `SaliVpn` bridge.

## Run

1. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_API_URL`.
2. Install from the repository root with `npm install`.
3. Run `npm run start --workspace=@sali/mobile` for UI development.
4. For a real VPN tunnel, provision the native targets described in `native/README.md` and run a development build; Expo Go is UI-only.

The current backend does not yet expose `/auth/mobile`, `/servers`, token refresh, or App Store/Google Play receipt verification. The client adapters are ready, but these endpoints and the signed native extensions must exist before release.
