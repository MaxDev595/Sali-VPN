import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  CreateVpnUserInput,
  CreateVpnUserResult,
  VPNProvider,
  VpnConnectionConfig,
  VpnServerStatus,
} from './vpn-provider.interface';

/**
 * In-memory stand-in for a real VPN backend. Used automatically when
 * VPN_PROVIDER=mock (e.g. in local development before a real WireGuard
 * server has been provisioned) so the rest of the product — trials,
 * subscriptions, Mini App — can be built and demoed end-to-end. It is never
 * selected in production unless explicitly configured, and clearly labels
 * its output as a demo config.
 */
@Injectable()
export class MockVpnProvider implements VPNProvider {
  readonly name = 'mock';
  private users = new Map<string, boolean>();

  async createUser(input: CreateVpnUserInput): Promise<CreateVpnUserResult> {
    const externalId = `mock_${input.userId}`;
    this.users.set(externalId, true);
    return {
      externalId,
      publicKey: randomBytes(16).toString('base64'),
      privateKey: randomBytes(32).toString('base64'),
      allocatedIp: `10.66.0.${(this.users.size % 250) + 2}`,
    };
  }

  async deleteUser(externalId: string): Promise<void> {
    this.users.delete(externalId);
  }

  async getUser(externalId: string) {
    if (!this.users.has(externalId)) return null;
    return { isEnabled: this.users.get(externalId)! };
  }

  async disableUser(externalId: string): Promise<void> {
    this.users.set(externalId, false);
  }

  async enableUser(externalId: string): Promise<void> {
    this.users.set(externalId, true);
  }

  async generateConfig(params: { privateKey: string; allocatedIp: string }): Promise<VpnConnectionConfig> {
    return {
      configText: [
        '# DEMO CONFIG — no real VPN server is connected yet.',
        '# Set VPN_PROVIDER=wireguard and configure WIREGUARD_API_URL to go live.',
        '[Interface]',
        `PrivateKey = ${params.privateKey}`,
        `Address = ${params.allocatedIp}/32`,
        '',
        '[Peer]',
        'PublicKey = DEMO_SERVER_PUBLIC_KEY',
        'Endpoint = demo.example:51820',
        'AllowedIPs = 0.0.0.0/0, ::/0',
      ].join('\n'),
      serverPublicHost: 'demo.example',
      serverPublicPort: 51820,
    };
  }

  async getServerStatus(): Promise<VpnServerStatus> {
    return { isOnline: true, currentLoad: this.users.size, capacity: 1000 };
  }
}
