# VPN Server Setup (WireGuard)

Sali VPN's backend never manages WireGuard directly — it talks to a small
management agent (`infrastructure/wg-agent`) that runs **on each VPN
server**. Full setup steps, including installing WireGuard itself and
running the agent, are documented in
[`infrastructure/wg-agent/README.md`](../infrastructure/wg-agent/README.md).

## Summary

1. Provision a VPS (any provider — DigitalOcean, Hetzner, AWS Lightsail, ...)
   in the region you want to offer (e.g. Netherlands for the MVP default).
2. Follow `infrastructure/wg-agent/README.md` to install WireGuard and run
   the agent.
3. Register the server in the database — either via the seed script
   (`apps/api/prisma/seed.ts`) or the admin API — with its public host/port
   and location label.
4. Point `WIREGUARD_API_URL` / `WIREGUARD_API_KEY` in `.env` at the agent.
5. Set `VPN_PROVIDER=wireguard` in `.env` (it defaults to `mock`, an
   in-memory stand-in used for local development before a real server
   exists).

## Adding more servers / locations later

The schema (`VpnServer` in `apps/api/prisma/schema.prisma`) already supports
multiple servers. `VpnService.pickServer()` currently picks the
least-loaded active server — extend it with real latency/location-aware
routing as you add capacity. No changes are needed to `VPNProvider` itself:
each server just needs its own running `wg-agent` instance and a row in
`vpn_servers` pointing at it.

## Swapping WireGuard for a different VPN technology later

Business logic never talks to WireGuard directly — only to the `VPNProvider`
interface (`apps/api/src/modules/vpn/providers/vpn-provider.interface.ts`).
To support another technology, implement that interface in a new adapter
class and select it in `vpn.module.ts`'s factory based on `VPN_PROVIDER`. No
other code changes are required.
