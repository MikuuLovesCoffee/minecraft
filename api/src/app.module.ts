import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { AdminGuard, AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { DbService } from './db.service';
import { SkinsService } from './minecraft/skins.service';
import { StatusService } from './minecraft/status.service';
import { SyncService } from './minecraft/sync.service';
import { PublicController } from './public.controller';
import { TicketsController } from './tickets.controller';

@Module({
  imports: [ScheduleModule.forRoot(), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }])],
  controllers: [AuthController, PublicController, TicketsController],
  providers: [
    DbService,
    StatusService,
    SyncService,
    SkinsService,
    AuthService,
    AuthGuard,
    AdminGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
