import { useCallback, useState } from 'react';
import { MapHeader } from '@/features/sites/components/MapHeader';
import { SiteList } from '@/features/sites/components/SiteList';
import { SitePanel } from '@/features/sites/components/SitePanel';
import { SiteSheet } from '@/features/sites/components/SiteSheet';
import { SitesMap } from '@/features/sites/components/SitesMap';
import { useMapQuery } from '@/features/sites/hooks/useMapQuery';
import { useSitesPage } from '@/features/sites/hooks/useSitesPage';
import { focusAfterClose, formatSiteCount } from '@/features/sites/lib/labels';
import { panelKey, type MapPanel } from '@/features/sites/lib/mapQuery';
import {
  DEFAULT_SITE_LIST_QUERY,
  regionGroups,
  toCompleteCount,
  type SiteListQuery,
} from '@/features/sites/lib/siteList';
import { breakpoint } from '@/design/tokens';
import { pageTitle } from '@/shared/config/app';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import type { GeoPoint } from '@/shared/model/geo';
import type { Site, SiteDraft, SiteEntry, SiteZone } from '@/shared/model/site';
import { useSiteCommands } from '@/shared/sites/hooks/useSiteCommands';
import type { SitesState } from '@/shared/sites/hooks/useSites';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import styles from './MapPage.module.scss';

/** Same bound as `until($bp-tablet)` in SCSS. */
const PHONE = `(max-width: ${breakpoint.tablet - 1}px)`;

/** What the camera frames: every site, a zone, or one site. */
type FrameTarget =
  { kind: 'all' } | { kind: 'zone'; zone: SiteZone } | { kind: 'site'; id: string };

function framedPoints(entries: readonly SiteEntry[], target: FrameTarget): GeoPoint[] {
  const placed = entries.flatMap(({ site }) =>
    site.position ? [{ site, position: site.position }] : [],
  );
  switch (target.kind) {
    case 'all':
      return placed.map(({ position }) => position);
    case 'zone':
      return placed.filter(({ site }) => site.zone === target.zone).map(({ position }) => position);
    case 'site':
      return placed.filter(({ site }) => site.id === target.id).map(({ position }) => position);
  }
}

function announcement(state: SitesState): string {
  switch (state.status) {
    case 'loading':
      return 'Chargement de tes sites…';
    case 'error':
      return 'Tes sites n’ont pas pu être chargés.';
    case 'ready':
      return formatSiteCount(state.entries.length);
  }
}

/** « Mes sites » (`/map`): the map and the list of the user's sites, the panel to add or edit. */
export function MapPage() {
  const state = useSitesPage();
  const [query, updateQuery] = useMapQuery();
  const entries = state.status === 'ready' ? state.entries : null;
  const panel = entries ? openPanel(query.panel, entries) : null;

  return (
    <div className={styles.page}>
      <title>{pageTitle('Mes sites')}</title>
      <MapHeader
        counts={
          entries && {
            sites: entries.length,
            regions: regionGroups(entries).length,
            waiting: toCompleteCount(entries),
          }
        }
        onAdd={() => updateQuery({ panel: { kind: 'new' } })}
      />
      <p className={styles.srOnly} role="status">
        {announcement(state)}
      </p>
      {state.status === 'loading' && <MapSkeleton />}
      {state.status === 'error' && (
        <div className={styles.message} role="alert">
          <p className={styles.messageTitle}>Tes sites n’ont pas pu être chargés.</p>
          <Button onClick={state.retry}>Réessayer</Button>
        </div>
      )}
      {entries && entries.length === 0 && panel === null && (
        <div className={styles.message}>
          <p className={styles.messageTitle}>Aucun site pour l’instant</p>
          <p className={styles.messageText}>Tes sites apparaissent ici dès ta première plongée.</p>
          <Button
            variant="primary"
            icon="plus"
            onClick={() => updateQuery({ panel: { kind: 'new' } })}
          >
            Ajouter un site
          </Button>
        </div>
      )}
      {entries && (entries.length > 0 || panel !== null) && (
        <MapStage entries={entries} panel={panel} />
      )}
    </div>
  );
}

/** The panel of the URL, when its site exists (a deleted or unknown id opens nothing). */
function openPanel(panel: MapPanel | null, entries: readonly SiteEntry[]) {
  if (panel === null) return null;
  if (panel.kind === 'new') return { panel, site: null };
  const site = entries.find((entry) => entry.site.id === panel.id)?.site;
  return site ? { panel, site } : null;
}

interface MapStageProps {
  entries: readonly SiteEntry[];
  panel: { panel: MapPanel; site: Site | null } | null;
}

/** The map and, beside it, the list or the panel; both in step with the URL. */
function MapStage({ entries, panel }: MapStageProps) {
  const [query, updateQuery] = useMapQuery();
  const { create, update } = useSiteCommands();
  const { notify } = useToast();
  // Phones place under a fixed marker (the map moves); a click places it above (spec § 2).
  const isPhone = useMediaQuery(PHONE);
  const [listQuery, setListQuery] = useState<SiteListQuery>(DEFAULT_SITE_LIST_QUERY);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // The camera moves on demand (zone chip, row of the list), not on every selection.
  const [frame, setFrame] = useState<{ n: number; target: FrameTarget }>(() => ({
    n: 0,
    target:
      query.panel && query.panel.kind !== 'new'
        ? { kind: 'site', id: query.panel.id }
        : query.siteId
          ? { kind: 'site', id: query.siteId }
          : query.zone
            ? { kind: 'zone', zone: query.zone }
            : { kind: 'all' },
  }));
  const points = framedPoints(entries, frame.target);
  // Phones: the bottom sheet covers half of the map (its default height).
  const viewport = {
    key: `${frame.n}:${points.length}`,
    points,
    bottomCover: isPhone && !panel ? 0.5 : 0,
  };
  const reframe = (target: FrameTarget) => setFrame(({ n }) => ({ n: n + 1, target }));

  // The marker being placed: the site's position when the panel opens, then the diver's.
  const key = panelKey(panel?.panel ?? null);
  const [pick, setPick] = useState<{ key: string | null; position: GeoPoint | null }>({
    key: null,
    position: null,
  });
  const pickPosition = pick.key === key ? pick.position : (panel?.site?.position ?? null);
  const setPickPosition = useCallback(
    (position: GeoPoint | null) => setPick({ key, position }),
    [key],
  );

  const selectFromList = (id: string) => {
    updateQuery({ siteId: id }, { replace: true });
    reframe({ kind: 'site', id });
  };
  const save = (draft: SiteDraft, site: Site | null) =>
    site ? update(site, draft) : create(draft, 'full');
  const closePanel = () => {
    updateQuery({ panel: null });
    // Back to where the panel was opened from: the row of the site, or « Ajouter un site ».
    focusAfterClose(panel?.site?.id ?? null);
  };

  return (
    <div className={styles.stage} data-panel={panel !== null || undefined}>
      <SitesMap
        entries={entries}
        selectedId={query.siteId}
        highlightedId={highlightedId}
        onSelect={(id) => updateQuery({ siteId: id }, { replace: true })}
        onDeselect={() => {
          const { siteId } = query;
          updateQuery({ siteId: null }, { replace: true });
          // The preview closes with its link: the focus goes to the row of the site.
          focusAfterClose(siteId);
        }}
        viewport={viewport}
        isNarrow={isPhone}
        zone={query.zone}
        onZoneChange={(zone) => {
          updateQuery({ zone }, { replace: true });
          reframe(zone ? { kind: 'zone', zone } : { kind: 'all' });
        }}
        pick={
          panel
            ? {
                position: pickPosition,
                onPick: setPickPosition,
                mode: isPhone ? 'center' : 'click',
              }
            : null
        }
      />
      {panel ? (
        <SitePanel
          key={key}
          mode={panel.panel.kind}
          site={panel.site}
          sites={entries.map(({ site }) => site)}
          position={pickPosition}
          onPositionChange={setPickPosition}
          placing={isPhone ? 'center' : 'click'}
          save={save}
          onSaved={(site) => {
            notify(`Site « ${site.name} » enregistré`);
            updateQuery({ panel: null, siteId: site.id });
            reframe({ kind: 'site', id: site.id });
          }}
          onClose={closePanel}
        />
      ) : (
        <SiteSheet
          siteCount={entries.length}
          waitingCount={toCompleteCount(entries)}
          onAdd={() => updateQuery({ panel: { kind: 'new' } })}
        >
          <SiteList
            entries={entries}
            query={listQuery}
            onQueryChange={(patch) => setListQuery((current) => ({ ...current, ...patch }))}
            selectedId={query.siteId}
            onSelect={selectFromList}
            onHighlight={setHighlightedId}
            onPlace={(id) => updateQuery({ panel: { kind: 'place', id }, siteId: id })}
          />
        </SiteSheet>
      )}
    </div>
  );
}

/** Loading: the map greyed, the list as skeleton rows. */
function MapSkeleton() {
  return (
    <div className={styles.stage} aria-busy="true">
      <div className={styles.mapSkeleton} />
      <div className={styles.listSkeleton}>
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} shape="block" className={styles.rowSkeleton} />
        ))}
      </div>
    </div>
  );
}
