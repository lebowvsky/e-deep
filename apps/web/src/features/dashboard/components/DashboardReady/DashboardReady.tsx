import type { DashboardPayload } from '../../types';
import { BuddyList } from '../BuddyList';
import { DashboardFooter } from '../DashboardFooter';
import { DashboardHeader } from '../DashboardHeader';
import { DivesPerMonthChart } from '../DivesPerMonthChart';
import { KpiRow } from '../KpiRow';
import { LastDiveCard } from '../LastDiveCard';
import { SiteMap } from '../SiteMap';
import styles from './DashboardReady.module.scss';

export interface DashboardReadyProps {
  data: DashboardPayload;
  /** Injected for tests; defaults to the current time. */
  now?: Date;
}

/** Nominal dashboard (mockups 01 / 04). */
export function DashboardReady({ data, now }: DashboardReadyProps) {
  const { user, stats, lastDive, sites, frequentBuddies } = data;

  return (
    <div className={styles.dashboard}>
      <DashboardHeader
        firstName={user.firstName}
        lastDiveDate={lastDive?.date ?? null}
        areaName={stats.mainArea.name}
        {...(now ? { now } : {})}
      />
      <KpiRow stats={stats} sites={sites} />
      <SiteMap
        sites={sites}
        siteCount={stats.sitesVisited}
        areaName={stats.mainArea.name}
        mapTitle={stats.mainArea.mapTitle}
        initialActiveSiteId={lastDive?.site.id}
      />
      <div className={styles.pair}>
        {lastDive && <LastDiveCard dive={lastDive} level={user.level} />}
        <DivesPerMonthChart months={stats.divesPerMonth} />
      </div>
      <BuddyList buddies={frequentBuddies} />
      <DashboardFooter />
    </div>
  );
}
