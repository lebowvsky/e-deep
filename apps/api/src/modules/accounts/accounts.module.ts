import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConsentsModule } from '../consents/consents.module';
import { DiversModule } from '../divers/divers.module';
import { Account } from './account.entity';
import { AccountsService } from './accounts.service';
import { AdminMeController } from './admin-me.controller';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { OnboardingService } from './onboarding.service';

/**
 * The signed-in account (D36, D38, D42): identity (`/me`, `/admin/me`), onboarding, consents,
 * password change and erasure.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Account]), AuthModule, ConsentsModule, DiversModule],
  controllers: [MeController, AdminMeController],
  providers: [AccountsService, OnboardingService, MeService],
  exports: [AccountsService, OnboardingService, MeService],
})
export class AccountsModule {}
