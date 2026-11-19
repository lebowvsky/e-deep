import { useState, type ClipboardEvent } from 'react';
import type { GeoPoint } from '@/shared/model/geo';
import { FormField } from '@/shared/ui/FormField';
import { TextInput } from '@/shared/ui/TextInput';
import {
  parseCoordinate,
  parseCoordinatePair,
  readCoordinateFields,
  toCoordinateFields,
  type CoordinateAxis,
  type CoordinateFields,
} from '../../lib/coordinates';
import styles from './CoordinatesInput.module.scss';

export interface CoordinatesInputProps {
  /** The position of the marker; the fields follow it when it moves on the map. */
  value: GeoPoint | null;
  /** A complete and valid pair, or `null` when both fields are emptied. */
  onChange: (position: GeoPoint | null) => void;
}

const ERRORS: Record<CoordinateAxis, string> = {
  latitude: 'Latitude en degrés décimaux, entre -90 et 90.',
  longitude: 'Longitude en degrés décimaux, entre -180 et 180.',
};

const samePosition = (a: GeoPoint | null, b: GeoPoint | null) =>
  a === b || (a !== null && b !== null && a.latitude === b.latitude && a.longitude === b.longitude);

/**
 * Latitude and longitude of a site (sites.jsx · AddSitePanel), in step with the marker: typing a
 * valid pair moves it, moving it rewrites the fields (4 decimals). A pair pasted in either field,
 * decimal or in degrees and minutes, fills both.
 */
export function CoordinatesInput({ value, onChange }: CoordinatesInputProps) {
  // The text typed, and the position it was written from: a new position rewrites the fields.
  const [draft, setDraft] = useState({ fields: toCoordinateFields(value), source: value });
  const [touched, setTouched] = useState<Partial<Record<CoordinateAxis, true>>>({});
  if (!samePosition(draft.source, value)) {
    setDraft({ fields: toCoordinateFields(value), source: value });
  }
  const { fields } = draft;

  const update = (next: CoordinateFields) => {
    const read = readCoordinateFields(next);
    if (read === 'invalid') {
      setDraft({ fields: next, source: value });
      return;
    }
    // Valid or emptied: the marker follows, and the fields keep the text as typed.
    setDraft({ fields: next, source: read });
    onChange(read);
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pair = parseCoordinatePair(event.clipboardData.getData('text'));
    if (!pair) return;
    event.preventDefault();
    setDraft({ fields: toCoordinateFields(pair), source: pair });
    onChange(pair);
  };

  const errorOf = (axis: CoordinateAxis) =>
    touched[axis] && fields[axis].trim() !== '' && parseCoordinate(fields[axis], axis) === null
      ? ERRORS[axis]
      : undefined;

  const latitude = parseCoordinate(fields.latitude, 'latitude');
  const longitude = parseCoordinate(fields.longitude, 'longitude');

  return (
    <div className={styles.pair}>
      <FormField label="Latitude" error={errorOf('latitude')}>
        <TextInput
          font="mono"
          inputMode="decimal"
          placeholder="42.5794"
          unit={latitude !== null && latitude < 0 ? '° S' : '° N'}
          value={fields.latitude}
          onChange={(event) => update({ ...fields, latitude: event.target.value })}
          onBlur={() => setTouched((current) => ({ ...current, latitude: true }))}
          onPaste={onPaste}
        />
      </FormField>
      <FormField label="Longitude" error={errorOf('longitude')}>
        <TextInput
          font="mono"
          inputMode="decimal"
          placeholder="8.7262"
          unit={longitude !== null && longitude < 0 ? '° W' : '° E'}
          value={fields.longitude}
          onChange={(event) => update({ ...fields, longitude: event.target.value })}
          onBlur={() => setTouched((current) => ({ ...current, longitude: true }))}
          onPaste={onPaste}
        />
      </FormField>
    </div>
  );
}
