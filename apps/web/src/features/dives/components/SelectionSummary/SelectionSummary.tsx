import { formatOneDecimal, splitMinutes } from '@/shared/lib/format';
import { Overline } from '@/shared/ui/Overline';
import type { DivesSummary } from '../../types';
import { Quantity } from '../Quantity';
import styles from './SelectionSummary.module.scss';

export interface SelectionSummaryProps {
  summary: DivesSummary;
}

const EMPTY = '—';

/**
 * Figures of the filtered selection, not of the page (dives-list.jsx · SummaryBand).
 * « — » when the selection is empty.
 */
export function SelectionSummary({ summary }: SelectionSummaryProps) {
  const empty = summary.count === 0;
  const { hours, minutes } = splitMinutes(summary.totalMinutes);
  const avg = summary.avgDepthM === null ? null : formatOneDecimal(summary.avgDepthM);

  const items = [
    { label: 'Plongées', value: summary.count, srText: `${summary.count} plongées` },
    empty
      ? { label: 'Temps cumulé', value: EMPTY, srText: 'Aucun temps cumulé' }
      : {
          label: 'Temps cumulé',
          value: hours,
          unit: `h ${minutes.toString().padStart(2, '0')} min`,
          srText: `${hours} heures ${minutes} minutes`,
        },
    avg === null
      ? { label: 'Prof. moyenne', value: EMPTY, srText: 'Aucune' }
      : { label: 'Prof. moyenne', value: avg, unit: 'm', srText: `${avg} mètres` },
    summary.maxDepthM === null
      ? { label: 'Prof. max', value: EMPTY, srText: 'Aucune' }
      : {
          label: 'Prof. max',
          value: summary.maxDepthM,
          unit: 'm',
          srText: `${summary.maxDepthM} mètres`,
        },
    empty
      ? { label: 'Sites', value: EMPTY, srText: 'Aucun' }
      : { label: 'Sites', value: summary.sites, srText: `${summary.sites} sites` },
  ];

  return (
    <section className={styles.band} aria-label="Synthèse de la sélection">
      <dl className={styles.items}>
        {items.map((item) => (
          <div key={item.label} className={styles.item}>
            <dt>
              <Overline>{item.label}</Overline>
            </dt>
            <dd>
              <Quantity
                size="summary"
                value={item.value}
                unit={'unit' in item ? item.unit : undefined}
                srText={item.srText}
                tone={item.value === EMPTY ? 'empty' : 'default'}
              />
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>
        {empty
          ? 'Aucune plongée dans la sélection'
          : 'Calculé sur la sélection — suit les filtres et la recherche'}
      </p>
    </section>
  );
}
