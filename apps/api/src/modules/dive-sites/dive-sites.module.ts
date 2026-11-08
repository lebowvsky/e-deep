import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiveSite } from './dive-site.entity';
import { DiveSitesService } from './dive-sites.service';

@Module({
  imports: [TypeOrmModule.forFeature([DiveSite])],
  providers: [DiveSitesService],
  exports: [DiveSitesService],
})
export class DiveSitesModule {}
