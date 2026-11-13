import { Body, Controller, Get, Header, Headers, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsInt } from 'class-validator';
import type { FastifyReply } from 'fastify';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';
import { HappService } from './happ.service';

class TelegramDto { @IsInt() telegramId!: number; }

/** Xray clients that download the subscription themselves (anything else is a person in a browser). */
const CLIENT_UA = /happ|v2ray|xray|hiddify|streisand|sing-?box|nekobox|nekoray|v2box|shadowrocket|clash|karing|foxray|throne/i;

/** Public: the personal subscription link that Happ (and other Xray clients) download. */
@Controller('sub')
export class HappSubscriptionController {
  constructor(private readonly happ: HappService) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async subscription(
    @Param('token') token: string,
    @Query('open') open: string | undefined,
    @Headers('user-agent') ua: string | undefined,
    @Headers('accept') accept: string | undefined,
    @Res() reply: FastifyReply,
  ) {
    // Opened from the bot or pasted into a browser: a page that hands the link to Happ.
    if (open === '1' || (!CLIENT_UA.test(ua ?? '') && (accept ?? '').includes('text/html'))) {
      await this.happ.assertLink(token); // unknown link → 404, before showing anything
      return reply.header('content-type', 'text/html; charset=utf-8').header('cache-control', 'no-store')
        .header('referrer-policy', 'no-referrer').send(this.happ.openPage(token));
    }
    const { body, headers } = await this.happ.subscription(token);
    return reply.headers(headers).send(body);
  }
}

/** Bot: «📲 Подключить в Happ». */
@Controller('internal/bot/happ')
@UseGuards(InternalServiceGuard)
export class HappBotController {
  constructor(private readonly happ: HappService) {}

  @Post('enabled') @Header('cache-control', 'no-store') enabled() { return { enabled: this.happ.enabled }; }
  @Post('link') link(@Body() b: TelegramDto) { return this.happ.link(b.telegramId); }
  @Post('rotate') rotate(@Body() b: TelegramDto) { return this.happ.rotate(b.telegramId); }
}
