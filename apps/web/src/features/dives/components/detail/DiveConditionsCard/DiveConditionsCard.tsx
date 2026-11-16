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
 * from the surface to the bottom, dive centre. « Rien de renseigné » when nothing was entered.
 */
export function DiveConditionsCard({
  conditions,
  surfaceTemperatureC,
  bottomTemperatureC,
  className,
}: DiveConditionsCardProps) {
  const { seaState, currentStrength, diveCenter } = conditions;
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
    contentFact('Eau', waterFact(surfaceTemperatureC, bottomTemperatureC), MISSING_LABELS.feminine),
    { term: 'Structure', value: diveCenter, missingLabel: MISSING_LABELS.feminine },
  ];

  return (
    <DetailSection title="Conditions" icon="sun" className={className} empty={isAllMissing(facts)}>
      <FactList layout="rows" facts={facts} />
    </DetailSection>
  );
}
