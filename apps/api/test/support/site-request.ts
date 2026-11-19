import { randomUUID } from 'node:crypto';
import type { SiteCreateRequest } from '@e-deep/shared';

/** A valid creation request of a full site (every detail entered), overridden by `values`. */
export function siteCreateRequest(values: Partial<SiteCreateRequest> = {}): SiteCreateRequest {
  return {
    id: randomUUID(),
    name: 'Pointe de la Revellata',
    locality: 'Calvi',
    region: 'Corse',
    area: 'Méditerranée',
    latitude: 42.583,
    longitude: 8.725,
    type: 'tombant',
    depthMinM: 15,
    depthMaxM: 60,
    accessNotes: 'Mouillage au pied du phare.',
    createdVia: 'full',
    ...values,
  };
}
