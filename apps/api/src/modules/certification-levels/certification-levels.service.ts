import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CertificationLevel } from './certification-level.entity';

/** Read-only reference data, pulled in full by the clients (small table, cached offline). */
@Injectable()
export class CertificationLevelsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Every level, inactive ones included (old participations may reference them). */
  findAll(): Promise<CertificationLevel[]> {
    return this.dataSource.manager.find(CertificationLevel, {
      order: { agency: 'ASC', rank: 'ASC', code: 'ASC' },
    });
  }
}
