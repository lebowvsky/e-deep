import type { DiveDetailView, DiveLogInsights } from '../../../types';
import { DiveConditionsCard } from '../DiveConditionsCard';
import { DiveDetailHeader } from '../DiveDetailHeader';
import { DiveEquipmentCard } from '../DiveEquipmentCard';
import { DiveKpis } from '../DiveKpis';
import { DiveNotesCard } from '../DiveNotesCard';
import { DiveRecordDates } from '../DiveRecordDates';
import { DiveRunCard } from '../DiveRunCard';
import { DiveSiteCard } from '../DiveSiteCard';
import { DiveTeamCard } from '../DiveTeamCard';
import styles from './DiveDetailReady.module.scss';

export interface DiveDetailReadyProps {
  dive: DiveDetailView;
  /** `null` while the log loads or when it failed: the dive is shown without them. */
  insights: DiveLogInsights | null;
}

/**
 * The dive: header, KPI, then the main column (run, equipment and conditions side by side, notes)
 * and the side column (site, team, sharing note and record dates). On phones and tablets a single
 * column in the spec order: run, team, equipment, conditions, notes, site.
 */
export function DiveDetailReady({ dive, insights }: DiveDetailReadyProps) {
  return (
    <div className={styles.ready}>
      <DiveDetailHeader
        dive={dive}
        stopsOk={dive.stopsOk}
        area={dive.site.area}
        entryType={dive.conditions.entryType}
      />
      <DiveKpis dive={dive} isPersonalBest={insights?.isPersonalBest ?? null} />
      <div className={styles.layout}>
        <div className={styles.main}>
          <DiveRunCard dive={dive} className={styles.run} />
          <div className={styles.pair}>
            <DiveEquipmentCard gasMix={dive.gasMix} equipment={dive.equipment} />
            <DiveConditionsCard
              conditions={dive.conditions}
              surfaceTemperatureC={dive.surfaceTemperatureC}
              bottomTemperatureC={dive.temperatureC}
            />
          </div>
          <DiveNotesCard
            notes={dive.notes}
            observations={dive.observations}
            className={styles.notes}
          />
        </div>
        <div className={styles.aside}>
          <DiveSiteCard site={dive.site} stats={insights?.site ?? null} className={styles.site} />
          <DiveTeamCard
            team={dive.team}
            sharedDives={insights?.sharedDives ?? null}
            className={styles.team}
          />
          <div className={styles.sharing}>
            <p className={styles.sharingText}>
              Site, date et palanquée sont partagés entre les plongeurs. Tes mesures, ton équipement
              et tes notes n’appartiennent qu’à toi.
            </p>
            <DiveRecordDates createdAt={dive.createdAt} updatedAt={dive.updatedAt} />
          </div>
        </div>
      </div>
    </div>
  );
}
