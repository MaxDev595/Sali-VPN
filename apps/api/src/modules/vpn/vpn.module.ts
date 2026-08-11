import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { VpnService } from './vpn.service';
import { VPN_PROVIDER } from './providers/vpn-provider.interface';
import { WireGuardProvider } from './providers/wireguard.provider';
import { MockVpnProvider } from './providers/mock.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    WireGuardProvider,
    MockVpnProvider,
    {
      provide: VPN_PROVIDER,
      useFactory: (config: ConfigService, wg: WireGuardProvider, mock: MockVpnProvider) => {
        const selected = config.get<string>('VPN_PROVIDER', 'mock');
        return selected === 'wireguard' ? wg : mock;
      },
      inject: [ConfigService, WireGuardProvider, MockVpnProvider],
    },
    VpnService,
  ],
  exports: [VpnService],
})
export class VpnModule {}
