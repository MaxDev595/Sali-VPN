import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VpnService } from './vpn.service';
import { VPN_PROVIDER } from './providers/vpn-provider.interface';
import { WireGuardProvider } from './providers/wireguard.provider';
import { MockVpnProvider } from './providers/mock.provider';
import { NodesProvider } from './providers/nodes.provider';
import { NodesBotController, NodesController } from './nodes/nodes.controller';
import { NodesService } from './nodes/nodes.service';
import { ServersController } from './servers.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    WireGuardProvider,
    MockVpnProvider,
    NodesProvider,
    {
      provide: VPN_PROVIDER,
      // nodes = Sali node agents (AmneziaWG + WireGuard, many servers); wireguard = legacy single agent.
      useFactory: (config: ConfigService, wg: WireGuardProvider, mock: MockVpnProvider, nodes: NodesProvider) => {
        const selected = config.get<string>('VPN_PROVIDER', 'wireguard');
        return selected === 'mock' ? mock : selected === 'nodes' ? nodes : wg;
      },
      inject: [ConfigService, WireGuardProvider, MockVpnProvider, NodesProvider],
    },
    VpnService,
    NodesService,
  ],
  controllers: [ServersController, NodesController, NodesBotController],
  exports: [VpnService, NodesService, NodesProvider],
})
export class VpnModule {}
