import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuddiesModule } from '../buddies/buddies.module';
import { DiveSitesModule } from '../dive-sites/dive-sites.module';
import { DiveBuddy } from './dive-buddy.entity';
import { DiveEvent } from './dive-event.entity';
import { DiveLogService } from './dive-log.service';
import { DiveObservation } from './dive-observation.entity';
import { DiveParticipation } from './dive-participation.entity';
import { DiveWriteService } from './dive-write.service';
import { DivesController } from './dives.controller';
import { DivesService } from './dives.service';
import { PurgeService } from './purge.service';

/**
 * One module for the dive aggregate (event + participation + dive team + observations): the
 * synchronisation writes it in one block (`DivesService`), the online form through
 * `DiveWriteService` (with the sites and buddies it creates), the dive log reads it
 * (`DiveLogService`).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([DiveEvent, DiveParticipation, DiveBuddy, DiveObservation]),
    DiveSitesModule,
    BuddiesModule,
  ],
  controllers: [DivesController],
  providers: [DivesService, DiveWriteService, PurgeService, DiveLogService],
  exports: [DivesService, PurgeService],
})
export class DivesModule {}
