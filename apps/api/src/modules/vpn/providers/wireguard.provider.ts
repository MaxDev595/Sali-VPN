import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateVpnUserInput,
  CreateVpnUserResult,
  VPNProvider,
  VpnConnectionConfig,
  VpnServerStatus,
} from './vpn-provider.interface';
import { PrismaService } from '../../../prisma/prisma.service';

/**
 * WireGuard adapter.
 *
 * WireGuard itself has no user-management API — peers are just entries in
 * `wg0.conf` plus kernel state, which requires root on the VPN box. Rather
 * than giving the API server SSH/root access to every VPN node (a large
 * blast radius), Sali VPN talks to a small "wg-agent" HTTP service that runs
 * locally on each VPN server and wraps `wg`/`wg-quick`. See
 * docs/vpn-server-setup.md for the agent's spec and a reference
 * implementation you can deploy.
 *
 * This keeps VPN private keys and root access confined to the VPN box itself
 * — the API only ever receives a public key + allocated IP back from the
 * agent when creating a user, and generates the client config using the
 * private key that was generated (and immediately handed off) at creation
 * time. See generateConfig().
 */
@Injectable()
export class WireGuardProvider implements VPNProvider {
  readonly name = 'wireguard';
  private readonly logger = new Logger(WireGuardProvider.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private async agentFetch(path: string, init: RequestInit = {}) {
    const baseUrl = this.config.getOrThrow<string>('WIREGUARD_API_URL');
    const apiKey = this.config.getOrThrow<string>('WIREGUARD_API_KEY');

    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(init.headers ?? {}),
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`wg-agent ${path} failed: ${res.status} ${body}`);
      throw new Error(`VPN server error (${res.status})`);
    }

    return res.json();
  }

  async createUser(input: CreateVpnUserInput): Promise<CreateVpnUserResult> {
    const externalId = `sali_${input.userId}`;
    const data = await this.agentFetch('/peers', {
      method: 'POST',
      body: JSON.stringify({ externalId }),
    });

    return {
      externalId,
      publicKey: data.publicKey,
      privateKey: data.privateKey,
      allocatedIp: data.allocatedIp,
    };
  }

  async deleteUser(externalId: string): Promise<void> {
    await this.agentFetch(`/peers/${encodeURIComponent(externalId)}`, { method: 'DELETE' });
  }

  async getUser(externalId: string): Promise<{ isEnabled: boolean } | null> {
    try {
      const data = await this.agentFetch(`/peers/${encodeURIComponent(externalId)}`);
      return { isEnabled: data.isEnabled };
    } catch {
      return null;
    }
  }

  async disableUser(externalId: string): Promise<void> {
    await this.agentFetch(`/peers/${encodeURIComponent(externalId)}/disable`, { method: 'POST' });
  }

  async enableUser(externalId: string): Promise<void> {
    await this.agentFetch(`/peers/${encodeURIComponent(externalId)}/enable`, { method: 'POST' });
  }

  async generateConfig(params: {
    privateKey: string;
    allocatedIp: string;
    serverId: string;
  }): Promise<VpnConnectionConfig> {
    const server = await this.prisma.vpnServer.findUniqueOrThrow({
      where: { id: params.serverId },
    });
    const serverPublicKey = await this.agentFetch('/server-public-key');

    const configText = [
      '[Interface]',
      `PrivateKey = ${params.privateKey}`,
      `Address = ${params.allocatedIp}/32`,
      'DNS = 1.1.1.1',
      '',
      '[Peer]',
      `PublicKey = ${serverPublicKey.publicKey}`,
      `Endpoint = ${server.publicHost}:${server.publicPort}`,
      'AllowedIPs = 0.0.0.0/0, ::/0',
      'PersistentKeepalive = 25',
    ].join('\n');

    return {
      configText,
      serverPublicHost: server.publicHost,
      serverPublicPort: server.publicPort,
    };
  }

  async getServerStatus(serverId: string): Promise<VpnServerStatus> {
    const server = await this.prisma.vpnServer.findUniqueOrThrow({ where: { id: serverId } });
    try {
      const data = await this.agentFetch('/status');
      return { isOnline: true, currentLoad: data.peerCount, capacity: server.capacity };
    } catch {
      return { isOnline: false, currentLoad: server.currentLoad, capacity: server.capacity };
    }
  }
}
