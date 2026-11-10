import { useState, type ReactNode } from 'react';
import { RangeSlider } from '@/shared/ui/RangeSlider';
import { Avatar } from '@/shared/ui/Avatar';
import { Chip } from '@/shared/ui/Chip';
import { Overline } from '@/shared/ui/Overline';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { depthRangeLabel, GAS_FAMILY_LABELS, periodOptions, REGION_LABELS } from '../../lib/labels';
import {
  DEPTH_SCALE_MAX,
  GAS_FAMILIES,
  REGION_KEYS,
  type DivesFacets,
  type DivesQuery,
} from '../../types';
import styles from './FilterSection.module.scss';

export type FilterSectionKey = 'period' | 'regions' | 'depth' | 'gases' | 'with';

export interface FilterChange {
  (patch: Partial<DivesQuery>, options?: { replace?: boolean }): void;
}

export interface FilterSectionProps {
  filter: FilterSectionKey;
  query: DivesQuery;
  onChange: FilterChange;
  facets: DivesFacets;
  now: Date;
}

/** Members shown before « + N autres ». */
const VISIBLE_MEMBERS = 3;

const toggle = <T,>(list: readonly T[], item: T): T[] =>
  list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

const selectedCount = (count: number, feminine: boolean) =>
  count === 0 ? null : `${count} sélectionné${feminine ? 'e' : ''}${count > 1 ? 's' : ''}`;

/**
 * One filter of the dive log (dives-list.jsx · SheetSection): title, current value, controls.
 * Shared by the toolbar popovers (desktop) and the filters sheet (mobile).
 */
export function FilterSection({ filter, query, onChange, facets, now }: FilterSectionProps) {
  switch (filter) {
    case 'period':
      return (
        <Section title="Période">
          <SegmentedControl
            label="Période"
            options={periodOptions(now)}
            value={query.period}
            onChange={(period) => onChange({ period })}
          />
        </Section>
      );
    case 'regions':
      return (
        <Section title="Région" aside={selectedCount(query.regions.length, true)}>
          <ul className={styles.chips}>
            {REGION_KEYS.map((region) => (
              <li key={region}>
                <Chip
                  selected={query.regions.includes(region)}
                  onClick={() => onChange({ regions: toggle(query.regions, region) })}
                >
                  <span>
                    {REGION_LABELS[region]} ·{' '}
                    <span className={styles.count}>{facets.regions[region]}</span>
                  </span>
                </Chip>
              </li>
            ))}
          </ul>
        </Section>
      );
    case 'depth':
      return (
        <Section title="Profondeur max" aside={depthRangeLabel(query.depthMin, query.depthMax)}>
          <RangeSlider
            min={0}
            max={DEPTH_SCALE_MAX}
            value={[query.depthMin ?? 0, query.depthMax ?? DEPTH_SCALE_MAX]}
            onChange={([low, high]) =>
              onChange(
                { depthMin: low > 0 ? low : null, depthMax: high < DEPTH_SCALE_MAX ? high : null },
                { replace: true },
              )
            }
            labels={['Profondeur minimale', 'Profondeur maximale']}
            formatValueText={(value) => `${value} mètres`}
            ticks={['0 m', '20', '40', `${DEPTH_SCALE_MAX} m`]}
          />
        </Section>
      );
    case 'gases':
      return (
        <Section title="Gaz">
          <ul className={styles.chips}>
            {GAS_FAMILIES.map((gas) => (
              <li key={gas}>
                <Chip
                  selected={query.gases.includes(gas)}
                  onClick={() => onChange({ gases: toggle(query.gases, gas) })}
                >
                  {GAS_FAMILY_LABELS[gas]}
                </Chip>
              </li>
            ))}
          </ul>
        </Section>
      );
    case 'with':
      return <TeamFilter query={query} onChange={onChange} facets={facets} />;
  }
}

function TeamFilter({
  query,
  onChange,
  facets,
}: Pick<FilterSectionProps, 'query' | 'onChange' | 'facets'>) {
  const [expanded, setExpanded] = useState(false);
  // Selected members always stay visible, even beyond the first ones.
  const visible = expanded
    ? facets.members
    : facets.members.filter(
        ({ member }, index) => index < VISIBLE_MEMBERS || query.with.includes(member.id),
      );
  const hidden = facets.members.length - visible.length;

  return (
    <Section title="Plongé avec" aside={selectedCount(query.with.length, false)}>
      <ul className={styles.chips}>
        {visible.map(({ member, count }) => (
          <li key={member.id}>
            <Chip
              selected={query.with.includes(member.id)}
              icon={<Avatar initials={member.initials} color={member.color} size="xxs" />}
              onClick={() => onChange({ with: toggle(query.with, member.id) })}
              aria-label={`${member.firstName} ${member.lastName}, ${count} plongées`}
            >
              <span>
                {member.firstName} · <span className={styles.count}>{count}</span>
              </span>
            </Chip>
          </li>
        ))}
        {hidden > 0 && (
          <li>
            <Chip onClick={() => setExpanded(true)}>+ {hidden} autres</Chip>
          </li>
        )}
      </ul>
    </Section>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: string | null;
  children: ReactNode;
}) {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.heading}>
        <Overline tone="med">{title}</Overline>
        {aside && <span className={styles.aside}>{aside}</span>}
      </div>
      {children}
    </section>
  );
}
