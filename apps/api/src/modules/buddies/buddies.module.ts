import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Buddy } from './buddy.entity';
import { BuddiesService } from './buddies.service';

@Module({
  imports: [TypeOrmModule.forFeature([Buddy])],
  providers: [BuddiesService],
  exports: [BuddiesService],
})
export class BuddiesModule {}
