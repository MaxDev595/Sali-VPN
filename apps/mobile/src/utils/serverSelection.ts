import type { VPNServer } from '../types';

/** Lower is better: ping plus a load penalty. Unknown values count as average. */
const score = (server: VPNServer) => (server.ping ?? 60) + (server.load ?? 50) * .7;

export function selectOptimalServer(servers: VPNServer[]): VPNServer | null {
  return servers.filter(server => server.availability && !server.premiumOnly).sort((a, b) => score(a) - score(b))[0] ?? null;
}
