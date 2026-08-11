import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { RateLimitModule } from './config/rate-limit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { VpnModule } from './modules/vpn/vpn.module';
import { TrialsModule } from './modules/trials/trials.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { DevicesModule } from './modules/devices/devices.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { SupportModule } from './modules/support/support.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { HomeModule } from './modules/home/home.module';
import { InternalModule } from './modules/internal/internal.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RateLimitModule,
    PrismaModule,

    AuthModule,
    UsersModule,
    VpnModule,
    TrialsModule,
    SubscriptionsModule,
    PaymentsModule,
    DevicesModule,
    ReferralsModule,
    SupportModule,
    NotificationsModule,
    AdminModule,
    HomeModule,
    InternalModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
