import type { DiveDetailLinkState } from '../../../lib/backLink';
import type { DiveDetailView, DiveLogInsights } from '../../../types';
import { DiveDetailHeader } from '../DiveDetailHeader';
import { DiveKpis } from '../DiveKpis';
import { DiveNotesCard } from '../DiveNotesCard';
import { DivePager } from '../DivePager';
import { DiveRunCard } from '../DiveRunCard';
import { DiveSiteCard } from '../DiveSiteCard';
import { DiveTeamCard } from '../DiveTeamCard';
import styles from './DiveDetailReady.module.scss';

export interface DiveDetailReadyProps {
  dive: DiveDetailView;
  /** `null` while the log loads or when it failed: the dive is shown without them. */
  insights: DiveLogInsights | null;
  linkState: DiveDetailLinkState;
}

/**
 * The dive: header, KPI, then the main column (run, notes) and the side column (site, team). On
 * phones and tablets a single column, the team moved up right after the run (spec order).
 */
export function DiveDetailReady({ dive, insights, linkState }: DiveDetailReadyProps) {
  return (
    <div className={styles.ready}>
      <DiveDetailHeader dive={dive} stopsOk={dive.stopsOk} />
      <DiveKpis dive={dive} isPersonalBest={insights?.isPersonalBest ?? null} />
      <div className={styles.layout}>
        <div className={styles.main}>
          <DiveRunCard dive={dive} className={styles.run} />
          <DiveNotesCard notes={dive.notes} className={styles.notes} />
        </div>
        <div className={styles.aside}>
          <DiveSiteCard site={dive.site} stats={insights?.site ?? null} className={styles.site} />
          <DiveTeamCard
            team={dive.team}
            sharedDives={insights?.sharedDives ?? null}
            className={styles.team}
          />
          <p className={styles.sharing}>
            Site, date et palanquée sont partagés entre les plongeurs. Tes mesures, ton équipement
            et tes notes n’appartiennent qu’à toi.
          </p>
        </div>
      </div>
      {insights && (
        <DivePager
          previous={insights.previous}
          next={insights.next}
          linkState={linkState}
          variant="tiles"
          className={styles.tiles}
        />
      )}
    </div>
  );
}
