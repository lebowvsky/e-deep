import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthEvent } from './auth-event.entity';
import { Session } from './session.entity';

/** Registers the entities only (lot 1 of docs/plans/auth.md); the services come with lot 2. */
@Module({
  imports: [TypeOrmModule.forFeature([Session, AuthEvent])],
})
export class AuthModule {}
