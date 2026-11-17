import { useId } from 'react';
import { formatMeasure } from '@/shared/lib/format';
import { Card } from '@/shared/ui/Card';
import { Measure } from '@/shared/ui/Measure';
import { Overline } from '@/shared/ui/Overline';
import type { DiveFormPreview } from '../../../form/derived';
import styles from './DivePreviewCard.module.scss';

export interface DivePreviewCardProps {
  preview: DiveFormPreview;
}

const MISSING = '—';

interface TileProps {
  label: string;
  value: number | null;
  unit: string;
  /** Spoken unit: « mètres ». */
  spokenUnit: string;
  isAccent?: boolean;
}

/** A mini KPI of the detail: label, mono value and unit, « — » until entered. */
function Tile({ label, value, unit, spokenUnit, isAccent = false }: TileProps) {
  return (
    <li className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      {value === null ? (
        <Measure size="mini" value={MISSING} tone="muted" srText="non renseignée" />
      ) : (
        <Measure
          size="mini"
          value={formatMeasure(value)}
          unit={unit}
          tone={isAccent ? 'accent' : 'default'}
          srText={`${formatMeasure(value)} ${spokenUnit}`}
        />
      )}
    </li>
  );
}

/**
 * Live preview of the dive as the detail will show it (dive-form.jsx · FormAside · Aperçu): number,
 * date and time, site, and the four KPI of the detail, the depth in accent. Not a live region: it
 * would speak on every key typed.
 */
export function DivePreviewCard({ preview }: DivePreviewCardProps) {
  const titleId = useId();
  const head = [
    preview.number === null ? null : `#${preview.number}`,
    preview.dateLabel,
    preview.entryTime,
  ].filter((part): part is string => part !== null);

  return (
    <Card as="section" aria-labelledby={titleId}>
      <Overline as="h2">
        <span id={titleId}>Aperçu</span>
      </Overline>
      <div className={styles.dive}>
        {head.length > 0 && <p className={styles.head}>{head.join(' · ')}</p>}
        <p className={styles.site} data-empty={preview.siteName === null || undefined}>
          {preview.siteName ?? 'Site à choisir'}
        </p>
        {preview.place !== null && <p className={styles.place}>{preview.place}</p>}
      </div>
      <ul className={styles.tiles} aria-label="Mesures">
        <Tile label="Prof. max" value={preview.depthMaxM} unit="m" spokenUnit="mètres" isAccent />
        <Tile label="Durée" value={preview.durationMin} unit="min" spokenUnit="minutes" />
        <Tile
          label="Temp. fond"
          value={preview.bottomTemperatureC}
          unit="°C"
          spokenUnit="degrés au fond"
        />
        <Tile
          label="Visibilité"
          value={preview.visibilityM}
          unit="m"
          spokenUnit="mètres de visibilité"
        />
      </ul>
    </Card>
  );
}
