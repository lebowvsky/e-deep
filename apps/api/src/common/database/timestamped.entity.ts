import { Column, CreateDateColumn } from 'typeorm';

/**
 * `created_at` / `updated_at` shared by every table except `dive_buddies`.
 *
 * `updated_at` is owned by the server: the `set_updated_at()` trigger sets it on every INSERT and
 * UPDATE (it is the synchronisation cursor), so TypeORM never writes it.
 */
export abstract class TimestampedEntity {
  @CreateDateColumn({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  @Column({
    type: 'timestamptz',
    name: 'updated_at',
    insert: false,
    update: false,
    default: () => 'clock_timestamp()',
  })
  updatedAt: Date;
}

/**
 * Synchronised tables keep their deleted rows as tombstones, read by the sync pull. Plain column on
 * purpose (not `@DeleteDateColumn`): every business read filters `deleted_at IS NULL` explicitly.
 */
export abstract class SyncedEntity extends TimestampedEntity {
  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;
}
