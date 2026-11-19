import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Button } from '@/shared/ui/Button';
import { formatSiteCount } from '../../lib/labels';
import styles from './SiteSheet.module.scss';

const SHEET_SNAPS = ['folded', 'half', 'full'] as const;
type SheetSnap = (typeof SHEET_SNAPS)[number];

const SNAP_LABELS: Record<SheetSnap, string> = {
  folded: 'repliée',
  half: 'à mi-hauteur',
  full: 'en plein écran',
};

/** A drag shorter than this (px) is a tap: the sheet goes to the next height. */
const DRAG_THRESHOLD = 24;

export interface SiteSheetProps {
  siteCount: number;
  waitingCount: number;
  onAdd: () => void;
  /** The list of the sites. */
  children: ReactNode;
}

const step = (snap: SheetSnap, by: 1 | -1): SheetSnap =>
  SHEET_SNAPS[Math.min(SHEET_SNAPS.length - 1, Math.max(0, SHEET_SNAPS.indexOf(snap) + by))] ??
  snap;

/**
 * Phones (sites.jsx · MapSitesMobile): the list in a bottom sheet over the map, at 3 heights
 * (folded: its header, half: default, full). The handle moves it: a tap goes up then back down,
 * a drag follows the finger, ↑ ↓ (Début, Fin) with the keyboard. From 768px it is a plain column
 * beside the map, header and handle hidden.
 */
export function SiteSheet({ siteCount, waitingCount, onAdd, children }: SiteSheetProps) {
  const titleId = useId();
  const [snap, setSnap] = useState<SheetSnap>('half');
  const dragStart = useRef<number | null>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const next: Partial<Record<string, SheetSnap>> = {
      ArrowUp: step(snap, 1),
      ArrowDown: step(snap, -1),
      Home: 'full',
      End: 'folded',
    };
    const target = next[event.key];
    if (!target) return;
    event.preventDefault();
    setSnap(target);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    dragStart.current = event.clientY;
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (start === null) return;
    const delta = event.clientY - start;
    if (Math.abs(delta) < DRAG_THRESHOLD) {
      setSnap(snap === 'full' ? 'folded' : step(snap, 1));
    } else {
      setSnap(step(snap, delta < 0 ? 1 : -1));
    }
  };

  return (
    <section className={styles.sheet} data-snap={snap} aria-labelledby={titleId}>
      <button
        type="button"
        className={styles.handle}
        aria-label={`Liste ${SNAP_LABELS[snap]}. Toucher pour la déplier, flèches haut et bas pour la redimensionner.`}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        // A keyboard « click » (Entrée, Espace) arrives without pointer events.
        onClick={(event) => {
          if (event.detail === 0) setSnap(snap === 'full' ? 'folded' : step(snap, 1));
        }}
      >
        <span className={styles.grip} aria-hidden="true" />
      </button>
      <div className={styles.head}>
        <div>
          <h2 id={titleId} className={styles.title}>
            Mes sites
          </h2>
          <p className={styles.counts}>
            {formatSiteCount(siteCount)}
            {waitingCount > 0 && ` · ${waitingCount} à compléter`}
          </p>
        </div>
        <Button icon="plus" onClick={onAdd}>
          Site
        </Button>
      </div>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
