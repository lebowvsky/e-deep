// Writing a dive — the port the form depends on, and its input.
//
// The input is the write contract of the API (`DiveWriteRequest`, D-24): the event, the
// participation, the observations, the site and the dive team, every field present and `null`
// when not entered (D-22). What the API creates beforehand (a site or a buddy typed by name)
// travels in `contacts`, flagged `isNew`.
import type {
  DiveWriteBuddy,
  DiveWriteEvent,
  DiveWriteObservation,
  DiveWriteParticipation,
  DiveWriteSite,
} from '@e-deep/shared';
import type { DiveFormField } from '../form/model';

export interface SaveDiveInput {
  /** `create` for a new or duplicated dive, `update` when editing `event.id`. */
  kind: 'create' | 'update';
  /** `siteId` is `contacts.site.id`. */
  event: DiveWriteEvent;
  participation: DiveWriteParticipation;
  /** In display order. */
  observations: DiveWriteObservation[];
  /** The site, and the dive team in display order. */
  contacts: { site: DiveWriteSite; buddies: DiveWriteBuddy[] };
  /** `updatedAt` of the detail the edit started from; `null` for a creation (D-25). */
  baseUpdatedAt: string | null;
}

/** Field errors are expected rejections (validation); anything unexpected is a rejected promise. */
export type SaveDiveResult =
  /** `number`: the logbook number the dive got once saved (D26, computed by the store). */
  | { ok: true; id: string; number: number }
  | { ok: false; fieldErrors: Partial<Record<DiveFormField, string>> };

/** Port of the dive writes: `POST /api/dives` and `PUT /api/dives/:id` (`httpDiveRepository`). */
export type SaveDive = (input: SaveDiveInput) => Promise<SaveDiveResult>;
