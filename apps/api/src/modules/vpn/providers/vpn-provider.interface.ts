/**
 * VPNProvider is the single abstraction the rest of the backend talks to.
 * Business logic (trials, subscriptions, admin actions) must never import a
 * specific VPN technology directly — only this interface. Swapping WireGuard
 * for another technology later means writing one new adapter class, with
 * zero changes anywhere else.
 */

/** awg = AmneziaWG (obfuscated, works where WireGuard is blocked); wg = plain WireGuard. */
export type VpnProtocol = 'awg' | 'wg';

export interface CreateVpnUserInput {
  /** Internal Sali user id — used to build a stable, human-traceable external id */
  userId: string;
  serverId: string;
  /** Re-use an existing keypair (moving a user to another server). */
  keys?: { privateKey: string; publicKey: string };
}

export interface CreateVpnUserResult {
  externalId: string;
  publicKey: string;
  /** Returned once; the caller is responsible for encrypting before storage. */
  privateKey: string;
  allocatedIp: string;
}

export interface VpnConnectionConfig {
  configText: string;
  serverPublicHost: string;
  serverPublicPort: number;
  protocol?: VpnProtocol;
}

export interface VpnServerStatus {
  isOnline: boolean;
  currentLoad: number;
  capacity: number;
}

export interface VPNProvider {
  readonly name: string;

  createUser(input: CreateVpnUserInput): Promise<CreateVpnUserResult>;
  deleteUser(externalId: string, serverId: string): Promise<void>;
  getUser(externalId: string, serverId: string): Promise<{ isEnabled: boolean } | null>;
  disableUser(externalId: string, serverId: string): Promise<void>;
  enableUser(externalId: string, serverId: string): Promise<void>;

  /** Renders a ready-to-import client config (e.g. a .conf file for WireGuard). */
  generateConfig(params: {
    privateKey: string;
    allocatedIp: string;
    serverId: string;
    protocol?: VpnProtocol;
  }): Promise<VpnConnectionConfig>;

  getServerStatus(serverId: string): Promise<VpnServerStatus>;
}

export const VPN_PROVIDER = Symbol('VPN_PROVIDER');
