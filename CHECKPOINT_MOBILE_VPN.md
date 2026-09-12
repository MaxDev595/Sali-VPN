# Mobile VPN checkpoint — 2026-09-01

## Completed

- Generated the native Android project for `apps/mobile`.
- Added the official WireGuard Android tunnel backend.
- Implemented `NativeModules.SaliVpn` with `prepare`, `connect`, `disconnect`, `getStatus`, and status events.
- Registered WireGuard's Android `VpnService` with `BIND_VPN_SERVICE`.
- Registered `sali://` deep links.
- Built and verified a universal debug APK:
  - `apps/mobile/dist/sali-vpn-debug.apk`
  - package: `app.sali.vpn`
  - minSdk: 24, targetSdk: 35
  - SHA-256: `4828DC8F95F490AAD5354C5338DEAE7C0C676F5F7984AD1089F5C1F3786F990F`
- Installed local Android SDK 35, Build Tools 35, CMake 3.22.1, NDK 27.1.12297006, and portable JDK 17 for builds.
- Worked around Windows Cyrillic-path failures with these ASCII build paths:
  - source build copy: `C:\sali-build`
  - Android SDK: `C:\sali-android-sdk`
  - JDK: `C:\sali-jdk17`
  - Gradle cache mapped as `G:` to the existing user Gradle directory

## Current release-build state

Standalone ARM64 release build completed successfully on 2026-09-02.

- APK: `apps/mobile/dist/sali-vpn-arm64.apk`
- Size: `77,826,074` bytes
- SHA-256: `BAA6B3CD0C7F9A82BCB6AAD0B3DDD69625306EBCDFB2EB7C187B695F1C0CCA31`
- Signature: APK Signature Scheme v2, test/debug certificate
- Embedded bundle: `assets/index.android.bundle`
- Native WireGuard library: `lib/arm64-v8a/libwg-go.so`
- Manifest checks passed for `sali://`, `GoBackend$VpnService`, and `BIND_VPN_SERVICE`.

## Device launch state

No Android device or emulator was connected to ADB during the final check. Connect an ARM64 Android phone with USB debugging enabled, accept its RSA prompt, then install and launch `app.sali.vpn` with ADB.

## Important remaining product check

An APK can establish the Android system VPN interface, but real internet tunneling still requires the API to return a WireGuard endpoint reachable from the phone. A config using `127.0.0.1:51820` only points back to the phone and cannot provide a working client VPN.
