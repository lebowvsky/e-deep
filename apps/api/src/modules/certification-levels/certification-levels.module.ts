import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificationLevel } from './certification-level.entity';
import { CertificationLevelsController } from './certification-levels.controller';
import { CertificationLevelsService } from './certification-levels.service';

@Module({
  imports: [TypeOrmModule.forFeature([CertificationLevel])],
  controllers: [CertificationLevelsController],
  providers: [CertificationLevelsService],
  exports: [CertificationLevelsService],
})
export class CertificationLevelsModule {}
