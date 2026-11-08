import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiveBuddy } from './dive-buddy.entity';
import { DiveEvent } from './dive-event.entity';
import { DiveParticipation } from './dive-participation.entity';
import { DivesService } from './dives.service';
import { PurgeService } from './purge.service';

/** One module for the dive aggregate (event + participation + dive team), written in one block. */
@Module({
  imports: [TypeOrmModule.forFeature([DiveEvent, DiveParticipation, DiveBuddy])],
  providers: [DivesService, PurgeService],
  exports: [DivesService, PurgeService],
})
export class DivesModule {}
