import type { VPNServer } from '../types';
export function selectOptimalServer(servers: VPNServer[]): VPNServer | null { return servers.filter(server => server.availability && !server.premiumOnly).sort((a, b) => (a.ping + a.load * .7) - (b.ping + b.load * .7))[0] ?? null; }
