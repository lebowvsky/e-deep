import { useState } from 'react';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Chip, RemovableChip } from '@/shared/ui/Chip';
import { Icon, type IconName } from '@/shared/ui/Icon';
import { IconButton, IconLink } from '@/shared/ui/IconButton';
import { Overline } from '@/shared/ui/Overline';
import { RangeSlider } from '@/shared/ui/RangeSlider';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Select } from '@/shared/ui/Select';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './UiPreviewPage.module.scss';

const ICONS: IconName[] = [
  'dashboard',
  'dives',
  'map',
  'stats',
  'plus',
  'chevronDown',
  'chevronRight',
  'search',
  'bell',
  'clock',
  'depth',
  'pin',
  'logout',
  'settings',
  'menu',
  'close',
  'arrowRight',
  'waves',
  'chevronLeft',
  'check',
  'download',
  'upload',
  'sliders',
  'sort',
  'book',
];

const PERIODS = [
  { value: '12m', label: '12 mois' },
  { value: '2026', label: '2026' },
  { value: 'all', label: 'Tout' },
] as const;

/** Controlled form primitives need a little state to be tried out. */
function Controls() {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['value']>('all');
  const [range, setRange] = useState<[number, number]>([20, 40]);
  const [selected, setSelected] = useState(true);
  return (
    <Card>
      <Overline>Chips · segmented · slider · select</Overline>
      <div className={styles.stack}>
        <div className={styles.row}>
          <Chip selected={selected} onClick={() => setSelected(!selected)}>
            Corse · 31
          </Chip>
          <Chip icon={<Avatar initials="LB" color="#3a5a82" size="xxs" />}>Lucas · 24</Chip>
          <RemovableChip removeLabel="Retirer le filtre Région : Bretagne" onRemove={() => {}}>
            Région : Bretagne
          </RemovableChip>
        </div>
        <SegmentedControl label="Période" options={PERIODS} value={period} onChange={setPeriod} />
        <RangeSlider
          min={0}
          max={60}
          value={range}
          onChange={setRange}
          labels={['Minimum', 'Maximum']}
          formatValueText={(value) => `${value} mètres`}
          ticks={['0 m', '20', '40', '60 m']}
        />
        <Select
          label="Tri"
          icon="sort"
          options={[
            { value: 'recent', label: 'Plus récentes' },
            { value: 'old', label: 'Plus anciennes' },
          ]}
          value="recent"
          onChange={() => {}}
        />
      </div>
    </Card>
  );
}

/** Dev-only catalogue of the `shared/ui` primitives (`/_dev/ui`, absent from the prod build). */
export function UiPreviewPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Primitives UI</h1>
      <div className={styles.grid}>
        <Card elevation={0}>
          <Overline>Buttons</Overline>
          <div className={styles.row}>
            <Button variant="primary" icon="plus">
              Nouvelle plongée
            </Button>
            <Button>Voir le détail</Button>
            <Button variant="ghost" icon="arrowRight">
              Aller
            </Button>
            <Button disabled>Désactivé</Button>
            <ButtonLink to="/dashboard" variant="ghost">
              Lien
            </ButtonLink>
          </div>
          <div className={styles.row}>
            <IconButton icon="search" label="Rechercher" variant="secondary" />
            <IconLink
              to="/notifications"
              icon="bell"
              label="Notifications"
              variant="secondary"
              dot
            />
            <IconButton icon="menu" label="Menu" iconSize="xl" />
          </div>
        </Card>
        <Card elevation={0}>
          <Overline>Chips &amp; badges</Overline>
          <div className={styles.row}>
            <Badge tone="accent" dot>
              N2 · FFESSM
            </Badge>
            <Badge tone="success">Palier OK</Badge>
            <Badge tone="warning">Visa vérif.</Badge>
            <Badge tone="danger">Incident</Badge>
            <Badge>Méditerranée</Badge>
          </div>
        </Card>
        <Card elevation={0}>
          <Overline tone="accent">Icônes</Overline>
          <div className={styles.row}>
            {ICONS.map((name) => (
              <Icon key={name} name={name} label={name} />
            ))}
          </div>
        </Card>
        <Card>
          <Overline>Avatars</Overline>
          <div className={styles.row}>
            <Avatar initials="MR" />
            <Avatar initials="LB" color="#3a5a82" size="lg" />
            <Avatar initials="TN" color="#2a6a6a" size="sm" />
            <Avatar initials="MR" tone="neutral" size="xs" />
          </div>
        </Card>
        <Controls />
        <Card aria-busy="true">
          <Overline>Skeletons</Overline>
          <div className={styles.stack}>
            <Skeleton />
            <Skeleton shape="block" />
            <Skeleton shape="control" />
          </div>
        </Card>
        <Card elevation={2} padding="lg">
          <Overline tone="med">Card elevation 2 · padding lg</Overline>
        </Card>
      </div>
    </main>
  );
}
