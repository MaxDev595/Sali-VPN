; Sali VPN — on uninstall, stop and remove the Sali tunnel service (WireGuard itself stays).
!macro customUnInstall
  nsExec::Exec '"$PROGRAMFILES64\WireGuard\wireguard.exe" /uninstalltunnelservice SaliVPN'
  RMDir /r "$COMMONAPPDATA\SaliVPN"
!macroend
