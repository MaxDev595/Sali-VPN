# Sali VPN fix 002

Исправляет падение `TypeError: Cannot read property 'useRef' of null` в `ContextNavigator`.

- Metro использует только React 19 из мобильного workspace;
- исключено попадание React 18 из web-пакетов в Android bundle;
- версия Android поднята до `0.1.2` (`versionCode 3`).
