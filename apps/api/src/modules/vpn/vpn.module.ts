import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VpnService } from './vpn.service';
import { VPN_PROVIDER } from './providers/vpn-provider.interface';
import { WireGuardProvider } from './providers/wireguard.provider';
import { MockVpnProvider } from './providers/mock.provider';
import { ServersController } from './servers.controller';

@Module({
  imports: [ConfigModule],
  providers: [
    WireGuardProvider,
    MockVpnProvider,
    {
      provide: VPN_PROVIDER,
      useFactory: (config: ConfigService, wg: WireGuardProvider, mock: MockVpnProvider) => {
        const selected = config.get<string>('VPN_PROVIDER', 'wireguard');
        return selected === 'mock' ? mock : wg;
      },
      inject: [ConfigService, WireGuardProvider, MockVpnProvider],
    },
    VpnService,
  ],
  controllers: [ServersController],
  exports: [VpnService],
})
export class VpnModule {}
