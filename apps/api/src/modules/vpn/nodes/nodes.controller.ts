import { Body, Controller, Get, Header, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { InternalServiceGuard } from '../../../common/guards/internal-service.guard';
import { NodesService } from './nodes.service';

class EnrollDto {
  @IsString() @Length(20, 64) token!: string;
  @IsString() @MaxLength(45) host!: string;
  @IsOptional() @IsString() @MaxLength(64) hostname?: string;
  @IsInt() @Min(1) @Max(65535) agentPort!: number;
  @IsString() @Length(32, 128) agentKey!: string;
  @IsString() @MaxLength(4096) certPem!: string;
}
class AdminDto { @IsInt() telegramId!: number; }
class TokenDto extends AdminDto {
  @IsString() @Matches(/^[A-Za-z]{2}$/) countryCode!: string;
  @IsOptional() @IsString() @MaxLength(40) city?: string;
}
class ActiveDto extends AdminDto { @IsString() @MaxLength(40) name!: string; @IsBoolean() isActive!: boolean; }
class PremiumDto extends AdminDto { @IsString() @MaxLength(40) name!: string; @IsBoolean() premiumOnly!: boolean; }

/** Files are served from the repo so a new VPS only needs this API to install itself. */
function nodeFile(name: string) {
  const candidates = [
    resolve(process.cwd(), '../../infrastructure/vpn-node', name),
    resolve(process.cwd(), 'infrastructure/vpn-node', name),
    resolve(__dirname, '../../../../../../infrastructure/vpn-node', name),
  ];
  const file = candidates.find((path) => existsSync(path));
  if (!file) throw new NotFoundException(`${name} not found`);
  return readFileSync(file, 'utf8');
}

@Controller('nodes')
export class NodesController {
  constructor(private readonly nodes: NodesService) {}

  @Get('install.sh')
  @Header('content-type', 'text/x-shellscript; charset=utf-8')
  installScript() { return nodeFile('install.sh'); }

  @Get('agent.js')
  @Header('content-type', 'application/javascript; charset=utf-8')
  agent() { return nodeFile('agent.js'); }

  @Post('enroll')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  enroll(@Body() body: EnrollDto) { return this.nodes.enroll(body); }
}

/** Admin commands from the bot (/addserver, /nodes, /node_off, /node_on, /node_free, /node_paid). */
@Controller('internal/bot/nodes')
@UseGuards(InternalServiceGuard)
export class NodesBotController {
  constructor(private readonly nodes: NodesService) {}

  @Post('token') token(@Body() body: TokenDto) { return this.nodes.createEnrollToken(body.telegramId, body.countryCode, body.city); }
  @Post('list') list(@Body() body: AdminDto) { return this.nodes.list(body.telegramId); }
  @Post('active') active(@Body() body: ActiveDto) { return this.nodes.setActive(body.telegramId, body.name, body.isActive); }
  @Post('premium') premium(@Body() body: PremiumDto) { return this.nodes.setPremium(body.telegramId, body.name, body.premiumOnly); }
  @Post('is-admin') isAdmin(@Body() body: AdminDto) { return { admin: this.nodes.isAdmin(body.telegramId) }; }
}
