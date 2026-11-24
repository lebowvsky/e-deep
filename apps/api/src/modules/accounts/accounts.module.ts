import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ConsentsModule } from '../consents/consents.module';
import { DiversModule } from '../divers/divers.module';
import { Account } from './account.entity';
import { AccountsService } from './accounts.service';
import { OnboardingService } from './onboarding.service';

/** The diver's account: password change, erasure, onboarding (D36, D38). No controller until lot 3. */
@Module({
  imports: [TypeOrmModule.forFeature([Account]), AuthModule, ConsentsModule, DiversModule],
  providers: [AccountsService, OnboardingService],
  exports: [AccountsService, OnboardingService],
})
export class AccountsModule {}
