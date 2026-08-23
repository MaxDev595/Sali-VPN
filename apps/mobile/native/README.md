# SaliVpn native module contract

The JavaScript application deliberately never implements a tunnel. A production build must expose `NativeModules.SaliVpn` with `prepare`, `connect`, `disconnect`, `getStatus`, and the `vpnStatusChanged` event.

- Android: implement with `VpnService`, WireGuard tunnel library, a foreground service and an ongoing notification. Persist only key aliases in Android Keystore-backed storage.
- iOS: add a Packet Tunnel Provider target using WireGuardKit/NetworkExtension, an App Group and Network Extension entitlements. Store secrets in Keychain and communicate through `NETunnelProviderManager`.
- Do not log the WireGuard config. Pass it directly from the authenticated API response to the native module, then release the JS reference.

Both platform targets require signing profiles and VPN entitlements owned by Sali before they can be compiled and distributed. Expo Go cannot load this module; use `expo prebuild` plus a custom development/production client.
