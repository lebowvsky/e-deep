import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurrentDiverGuard } from '../../common/auth/current-diver.guard';
import { DiveSite } from './dive-site.entity';
import { DiveSitesController } from './dive-sites.controller';
import { DiveSitesService } from './dive-sites.service';

@Module({
  imports: [TypeOrmModule.forFeature([DiveSite])],
  controllers: [DiveSitesController],
  providers: [DiveSitesService, CurrentDiverGuard],
  exports: [DiveSitesService],
})
export class DiveSitesModule {}
