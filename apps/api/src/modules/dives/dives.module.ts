import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentDiverGuard } from '../../common/auth/current-diver.guard';
import { DiveBuddy } from './dive-buddy.entity';
import { DiveEvent } from './dive-event.entity';
import { DiveLogService } from './dive-log.service';
import { DiveObservation } from './dive-observation.entity';
import { DiveParticipation } from './dive-participation.entity';
import { DivesController } from './dives.controller';
import { DivesService } from './dives.service';
import { PurgeService } from './purge.service';

/**
 * One module for the dive aggregate (event + participation + dive team + observations): the synchronisation writes
 * it in one block (`DivesService`), the dive log reads it (`DiveLogService`).
 */
@Module({
  imports: [TypeOrmModule.forFeature([DiveEvent, DiveParticipation, DiveBuddy, DiveObservation])],
  controllers: [DivesController],
  providers: [DivesService, PurgeService, DiveLogService, CurrentDiverGuard],
  exports: [DivesService, PurgeService],
})
export class DivesModule {}
