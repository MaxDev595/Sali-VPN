import { Controller, Get, Headers, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class ServersController {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  @Get()
  async list(@Headers('cf-ipcountry') country?: string) {
    const servers = await this.prisma.vpnServer.findMany({
      // Nodes mode: only enrolled Sali nodes (the seeded legacy rows have no agent).
      where: { isActive: true, ...(this.config.get<string>('VPN_PROVIDER') === 'nodes' ? { agentUrl: { not: null } } : {}) },
      orderBy: [{ premiumOnly: 'asc' }, { pingMs: 'asc' }],
    });
    const free = servers.filter((server) => !server.premiumOnly);
    const recommendedId = free.find((server) => server.countryCode === country)?.id ?? free[0]?.id;
    return servers.map((server) => ({
      id: server.id,
      name: server.name,
      location: server.location,
      countryCode: server.countryCode,
      city: server.city,
      premiumOnly: server.premiumOnly,
      pingMs: server.pingMs,
      currentLoad: server.currentLoad,
      capacity: server.capacity,
      recommended: server.id === recommendedId,
    }));
  }
}
