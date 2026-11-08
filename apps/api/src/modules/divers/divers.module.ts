import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Diver } from './diver.entity';
import { DiversService } from './divers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Diver])],
  providers: [DiversService],
  exports: [DiversService],
})
export class DiversModule {}
