@echo off
cd /d "%~dp0"
(
git add apps/api/prisma/migrations/20261104150000_vpn_nodes/migration.sql apps/api/prisma/schema.prisma apps/api/src/modules/home/home.controller.ts apps/api/src/modules/internal/internal.controller.ts apps/api/src/modules/vpn/nodes/node-client.ts apps/api/src/modules/vpn/nodes/nodes.controller.ts apps/api/src/modules/vpn/nodes/nodes.service.ts apps/api/src/modules/vpn/providers/nodes.provider.ts apps/api/src/modules/vpn/providers/vpn-provider.interface.ts apps/api/src/modules/vpn/vpn.module.ts apps/api/src/modules/vpn/vpn.service.ts apps/bot/src/handlers/admin.ts apps/bot/src/index.ts apps/bot/src/services/api-client.ts docs/vpn-nodes.md infrastructure/vpn-node/agent.js infrastructure/vpn-node/install.sh scripts/render-start.js 
git commit -m "VPN nodes: AmneziaWG + WireGuard agent, one-command install, multi-server API, admin bot commands; robust bot token"
git push --progress origin main
echo EXIT=%errorlevel%
) > push-apk-build.log 2>&1
type push-apk-build.log
timeout /t 15
