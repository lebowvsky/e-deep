import type { GasMix } from '@e-deep/shared';
import { gasFact, pressureFact, suitFact, tankFact, weightFact } from '../../../lib/diveFacts';
import { MISSING_LABELS } from '../../../lib/labels';
import type { DiveEquipment } from '../../../types';
import { DetailSection } from '../DetailSection';
import { contentFact, FactList } from '../FactList';

export interface DiveEquipmentCardProps {
  gasMix: GasMix;
  equipment: DiveEquipment;
  className?: string | undefined;
}

/**
 * « Équipement & gaz » (dive-detail.jsx · ParamsCard): gas and its oxygen share, tank, pressures
 * with the bar used, suit, ballast. The gas is always entered: the card is never empty.
 */
export function DiveEquipmentCard({ gasMix, equipment, className }: DiveEquipmentCardProps) {
  return (
    <DetailSection title="Équipement & gaz" icon="tank" className={className}>
      <FactList
        layout="rows"
        facts={[
          contentFact('Gaz', gasFact(gasMix, equipment.o2Percent)),
          contentFact('Bloc', tankFact(equipment.tankVolumeL, equipment.tankMaterial)),
          contentFact(
            'Pression',
            pressureFact(equipment.startPressureBar, equipment.endPressureBar),
            MISSING_LABELS.feminine,
          ),
          contentFact(
            'Combinaison',
            suitFact(equipment.suitThicknessMm, equipment.suitType),
            MISSING_LABELS.feminine,
          ),
          contentFact('Lest', weightFact(equipment.weightKg)),
        ]}
      />
    </DetailSection>
  );
}
