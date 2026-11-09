import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VpnServer } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { decryptSecret } from '../crypto.util';
import { callNode, generateWgKeypair, NodeInfo, NodePeer, NodeTarget } from '../nodes/node-client';
import {
  CreateVpnUserInput,
  CreateVpnUserResult,
  VPNProvider,
  VpnConnectionConfig,
  VpnProtocol,
  VpnServerStatus,
} from './vpn-provider.interface';

/**
 * Sali node provider: every VPN server runs infrastructure/vpn-node/agent.js, which serves
 * the same peers on AmneziaWG (awg0, obfuscated) and plain WireGuard (wg0). The API keeps the
 * client keys (encrypted) and only sends public keys to nodes.
 */
@Injectable()
export class NodesProvider implements VPNProvider {
  readonly name = 'wireguard';
  private readonly logger = new Logger(NodesProvider.name);

  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  target(server: VpnServer): NodeTarget {
    if (!server.agentUrl || !server.agentKeyEnc || !server.agentCertPem) {
      throw new Error(`server ${server.name} is not a Sali node`);
    }
    return {
      agentUrl: server.agentUrl,
      agentKey: decryptSecret(server.agentKeyEnc, this.config.getOrThrow<string>('JWT_SECRET')),
      certPem: server.agentCertPem,
    };
  }

  private async node(serverId: string) {
    const server = await this.prisma.vpnServer.findUniqueOrThrow({ where: { id: serverId } });
    return { server, target: this.target(server) };
  }

  /** Creates the peer with a fresh keypair, or re-uses `keys` (moving a user between servers). */
  async createUser(input: CreateVpnUserInput): Promise<CreateVpnUserResult> {
    const { target } = await this.node(input.serverId);
    const keys = input.keys ?? generateWgKeypair();
    const externalId = `sali_${input.userId}`;
    const peer = await callNode<NodePeer>(target, 'PUT', `/peers/${externalId}`, { publicKey: keys.publicKey, enabled: true });
    return { externalId, publicKey: keys.publicKey, privateKey: keys.privateKey, allocatedIp: peer.ips.wg ?? peer.ips.awg! };
  }

  async deleteUser(externalId: string, serverId: string) {
    const { target } = await this.node(serverId);
    await callNode(target, 'DELETE', `/peers/${externalId}`);
  }

  async getUser(externalId: string, serverId: string) {
    try {
      const { target } = await this.node(serverId);
      const peer = await callNode<NodePeer>(target, 'GET', `/peers/${externalId}`);
      return { isEnabled: peer.enabled };
    } catch {
      return null;
    }
  }

  async disableUser(externalId: string, serverId: string) {
    const { target } = await this.node(serverId);
    await callNode(target, 'POST', `/peers/${externalId}/disable`);
  }

  async enableUser(externalId: string, serverId: string) {
    const { target } = await this.node(serverId);
    await callNode(target, 'POST', `/peers/${externalId}/enable`);
  }

  async generateConfig(params: { privateKey: string; allocatedIp: string; serverId: string; protocol?: VpnProtocol }): Promise<VpnConnectionConfig> {
    const server = await this.prisma.vpnServer.findUniqueOrThrow({ where: { id: params.serverId } });
    const awg = params.protocol === 'awg' && server.awgPublicKey && server.awgPort;
    const index = params.allocatedIp.split('.').slice(2).join('.');
    const address = awg ? `10.67.${index}` : `10.66.${index}`;
    const awgParams = (server.awgParams ?? {}) as Record<string, number>;
    const lines = [
      '[Interface]',
      `PrivateKey = ${params.privateKey}`,
      `Address = ${address}/32`,
      // The node's own no-log resolver, reached inside the tunnel. Older nodes without it fall
      // back to privacy-focused public resolvers (Quad9, Cloudflare) — never Google.
      `DNS = ${server.privateDns ? (awg ? '10.67.0.1' : '10.66.0.1') : '9.9.9.9, 1.1.1.1'}`,
      'MTU = 1280',
      ...(awg ? ['Jc', 'Jmin', 'Jmax', 'S1', 'S2', 'H1', 'H2', 'H3', 'H4'].filter((k) => awgParams[k] !== undefined).map((k) => `${k} = ${awgParams[k]}`) : []),
      '',
      '[Peer]',
      `PublicKey = ${awg ? server.awgPublicKey : server.wgPublicKey}`,
      `Endpoint = ${server.publicHost}:${awg ? server.awgPort : server.publicPort}`,
      'AllowedIPs = 0.0.0.0/0, ::/0',
      'PersistentKeepalive = 25',
    ];
    return {
      configText: lines.join('\n'),
      serverPublicHost: server.publicHost,
      serverPublicPort: awg ? server.awgPort! : server.publicPort,
      protocol: awg ? 'awg' : 'wg',
    };
  }

  async info(serverId: string) {
    const { target } = await this.node(serverId);
    return callNode<NodeInfo>(target, 'GET', '/info', undefined, 5000);
  }

  async getServerStatus(serverId: string): Promise<VpnServerStatus> {
    const server = await this.prisma.vpnServer.findUniqueOrThrow({ where: { id: serverId } });
    if (!server.agentUrl) return { isOnline: false, currentLoad: server.currentLoad, capacity: server.capacity };
    try {
      const info = await callNode<NodeInfo>(this.target(server), 'GET', '/info', undefined, 5000);
      return { isOnline: info.up, currentLoad: info.enabled, capacity: server.capacity };
    } catch (error) {
      this.logger.warn(`node ${server.name} unreachable: ${(error as Error).message}`);
      return { isOnline: false, currentLoad: server.currentLoad, capacity: server.capacity };
    }
  }
}
