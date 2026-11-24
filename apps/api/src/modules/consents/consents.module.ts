import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Consent } from './consent.entity';
import { ConsentsService } from './consents.service';

/** Health data consents (D38). No controller until lot 3. */
@Module({
  imports: [TypeOrmModule.forFeature([Consent]), AuthModule],
  providers: [ConsentsService],
  exports: [ConsentsService],
})
export class ConsentsModule {}
