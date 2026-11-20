import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consent } from './consent.entity';

/** Registers the entity only (lot 1 of docs/plans/auth.md); the services come with lot 2. */
@Module({
  imports: [TypeOrmModule.forFeature([Consent])],
})
export class ConsentsModule {}
