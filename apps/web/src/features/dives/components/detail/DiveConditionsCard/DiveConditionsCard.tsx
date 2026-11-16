import { entryFact, waterFact, weatherFact } from '../../../lib/diveFacts';
import { CURRENT_STRENGTH_LABELS, MISSING_LABELS, SEA_STATE_LABELS } from '../../../lib/labels';
import type { DiveConditions } from '../../../types';
import { DetailSection } from '../DetailSection';
import { contentFact, FactList, isAllMissing, type Fact } from '../FactList';

export interface DiveConditionsCardProps {
  conditions: DiveConditions;
  /** Water at the surface and at the bottom (« Eau »). */
  surfaceTemperatureC: number | null;
  bottomTemperatureC: number | null;
  className?: string | undefined;
}

/**
 * « Conditions » (dive-detail.jsx · ConditionsCard): type, weather and air, sea, current, water
 * from the surface to the bottom, dive centre. « Rien de renseigné » when none of the conditions
 * was entered: the bottom temperature alone does not count (it is a KPI of the page already).
 */
export function DiveConditionsCard({
  conditions,
  surfaceTemperatureC,
  bottomTemperatureC,
  className,
}: DiveConditionsCardProps) {
  const { seaState, currentStrength, diveCenter } = conditions;
  const water = contentFact(
    'Eau',
    waterFact(surfaceTemperatureC, bottomTemperatureC),
    MISSING_LABELS.feminine,
  );
  const facts: Fact[] = [
    contentFact('Type', entryFact(conditions)),
    contentFact(
      'Météo',
      weatherFact(conditions.weather, conditions.airTemperatureC),
      MISSING_LABELS.feminine,
    ),
    {
      term: 'Mer',
      value: seaState === null ? null : SEA_STATE_LABELS[seaState],
      missingLabel: MISSING_LABELS.feminine,
    },
    {
      term: 'Courant',
      value: currentStrength === null ? null : CURRENT_STRENGTH_LABELS[currentStrength],
    },
    water,
    { term: 'Structure', value: diveCenter, missingLabel: MISSING_LABELS.feminine },
  ];
  const empty =
    surfaceTemperatureC === null && isAllMissing(facts.filter((fact) => fact !== water));

  return (
    <DetailSection title="Conditions" icon="sun" className={className} empty={empty}>
      <FactList layout="rows" facts={facts} />
    </DetailSection>
  );
}
