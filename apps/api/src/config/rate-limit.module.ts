import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get('RATE_LIMIT_TTL_SECONDS', 60)) * 1000,
            limit: Number(config.get('RATE_LIMIT_MAX_REQUESTS', 100)),
          },
        ],
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
