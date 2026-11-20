import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './account.entity';

/** Registers the entity only (lot 1 of docs/plans/auth.md); the services come with lot 2. */
@Module({
  imports: [TypeOrmModule.forFeature([Account])],
})
export class AccountsModule {}
