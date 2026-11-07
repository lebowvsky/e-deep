import {
  formatDiveCount,
  formatDiveDate,
  formatMonthShort,
  splitMinutes,
} from '@/shared/lib/format';
import { cumulative } from '../../lib/sparkline';
import type { DashboardStats, DiveSite } from '../../types';
import { KpiCard } from '../KpiCard';
import { Sparkline } from '../Sparkline';
import styles from './KpiRow.module.scss';

export interface KpiRowProps {
  stats: DashboardStats;
  sites: readonly DiveSite[];
}

const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

/** The four headline figures (Miller: 4 max). */
export function KpiRow({ stats, sites }: KpiRowProps) {
  const { hours, minutes } = splitMinutes(stats.totalUnderwaterMinutes);
  const averageMinutes = stats.totalDives
    ? Math.floor(stats.totalUnderwaterMinutes / stats.totalDives)
    : 0;
  const regionCount = new Set(sites.map((site) => site.region)).size;
  const monthly = stats.divesPerMonth.map((month) => month.count);
  const { depthM, site, date } = stats.maxDepthEver;

  return (
    <ul className={styles.row} aria-label="Chiffres clés">
      <KpiCard
        label={{ short: 'Plongées', long: 'Plongées totales' }}
        value={stats.totalDives}
        srText={formatDiveCount(stats.totalDives)}
        caption={`${signed(stats.recentMonthDelta)} ce mois`}
        trend={<Sparkline values={cumulative(monthly)} />}
      />
      <KpiCard
        label={{ short: 'Temps', long: 'Temps sous l’eau' }}
        value={hours}
        unit={{ short: 'h', long: `h ${minutes} min` }}
        srText={`${hours} heures ${minutes} minutes sous l’eau`}
        caption={`moy. ${averageMinutes} min`}
        trend={<Sparkline values={cumulative(monthly)} fill />}
      />
      <KpiCard
        label={{ short: 'Prof. max', long: 'Profondeur max' }}
        value={depthM}
        unit="m"
        srText={`${depthM} mètres`}
        caption={{
          short: `${site} · ${formatMonthShort(date)}`,
          long: `${site} · ${formatDiveDate(date)}`,
        }}
      />
      <KpiCard
        label={{ short: 'Sites', long: 'Sites explorés' }}
        value={stats.sitesVisited}
        unit={{ short: '', long: 'sites' }}
        srText={`${stats.sitesVisited} sites`}
        caption={{
          short: `${regionCount} régions`,
          long: `${regionCount} régions · ${stats.mainArea.name} principalement`,
        }}
      />
    </ul>
  );
}
