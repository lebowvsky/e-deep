import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router';
import { mockUser } from '@/features/dashboard/mocks/dashboard';
import { DeleteSiteDialog } from '@/features/sites/components/DeleteSiteDialog';
import { MergeSiteDialog } from '@/features/sites/components/MergeSiteDialog';
import { SiteAccessCard } from '@/features/sites/components/SiteAccessCard';
import { SiteDetailHeader } from '@/features/sites/components/SiteDetailHeader';
import { SiteDivesList } from '@/features/sites/components/SiteDivesList';
import { SiteInfoCard } from '@/features/sites/components/SiteInfoCard';
import { SiteKpis } from '@/features/sites/components/SiteKpis';
import { SiteMiniMap } from '@/features/sites/components/SiteMiniMap';
import { newDiveHrefOf, siteHrefOf } from '@/features/sites/lib/labels';
import { pageTitle } from '@/shared/config/app';
import { formatInitials } from '@/shared/lib/format';
import type { SiteEntry } from '@/shared/model/site';
import { useSiteCommands } from '@/shared/sites/hooks/useSiteCommands';
import { useSites } from '@/shared/sites/hooks/useSites';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/Skeleton';
import { useToast } from '@/shared/ui/Toast';
import styles from './SiteDetailPage.module.scss';

// TODO(auth): the diver will come from the session, as in AppShell.
const SELF_INITIALS = formatInitials(mockUser.firstName, mockUser.lastName);

/** `/sites/:siteId`: one of the user's sites, its figures, its dives, what to know to go there. */
export function SiteDetailPage() {
  const { siteId = '' } = useParams();
  const state = useSites();

  switch (state.status) {
    case 'loading':
      return <SiteDetailSkeleton />;
    case 'error':
      return (
        <SiteMessage title="Ce site n’a pas pu être chargé.">
          <Button onClick={state.retry}>Réessayer</Button>
        </SiteMessage>
      );
    case 'ready': {
      const entry = state.entries.find(({ site }) => site.id === siteId);
      return entry ? (
        // Another site is another page: its dialogs start closed.
        <SiteDetail key={entry.site.id} entry={entry} entries={state.entries} />
      ) : (
        <SiteMessage title="Ce site n’existe pas ou a été supprimé">
          <ButtonLink to="/map" icon="map">
            Retour à la carte
          </ButtonLink>
        </SiteMessage>
      );
    }
  }
}

type Dialog = 'none' | 'merge' | 'delete';

interface SiteDetailProps {
  entry: SiteEntry;
  entries: readonly SiteEntry[];
}

function SiteDetail({ entry, entries }: SiteDetailProps) {
  const { site, stats, dives } = entry;
  const [dialog, setDialog] = useState<Dialog>('none');
  const { merge, remove } = useSiteCommands();
  const navigate = useNavigate();
  const { notify } = useToast();

  return (
    <article className={styles.page}>
      <title>{pageTitle(site.name)}</title>
      <SiteDetailHeader
        site={site}
        onMerge={() => setDialog('merge')}
        onDelete={() => setDialog('delete')}
      />
      <SiteKpis stats={stats} />
      <div className={styles.columns}>
        <div className={styles.main}>
          <SiteMiniMap site={site} entries={entries} />
          <ButtonLink to={newDiveHrefOf(site.id)} icon="plus" size="lg" className={styles.newDive}>
            Nouvelle plongée ici
          </ButtonLink>
          <SiteDivesList siteId={site.id} dives={dives} selfInitials={SELF_INITIALS} />
        </div>
        <div className={styles.aside}>
          <SiteInfoCard site={site} stats={stats} />
          <SiteAccessCard site={site} />
          <p className={styles.privacy}>
            Ce site n’est visible que par toi. Fusionner deux sites regroupe leurs plongées sous un
            seul nom.
          </p>
        </div>
      </div>
      {dialog === 'merge' && (
        <MergeSiteDialog
          source={entry}
          entries={entries}
          merge={merge}
          onCancel={() => setDialog('none')}
          onMerged={(target) => {
            notify(`« ${site.name} » fusionné avec « ${target.name} »`);
            void navigate(siteHrefOf(target.id), { replace: true });
          }}
        />
      )}
      {dialog === 'delete' && (
        <DeleteSiteDialog
          entry={entry}
          remove={remove}
          onCancel={() => setDialog('none')}
          onMerge={() => setDialog('merge')}
          onDeleted={() => {
            notify(`Site « ${site.name} » supprimé`);
            void navigate('/map', { replace: true });
          }}
        />
      )}
    </article>
  );
}

function SiteMessage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={styles.message}>
      <title>{pageTitle('Fiche site')}</title>
      <h1 className={styles.messageTitle}>{title}</h1>
      {children}
    </section>
  );
}

/** Loading: the shapes of the header, the figures and the cards. */
function SiteDetailSkeleton() {
  return (
    <div className={styles.page} aria-busy="true">
      <title>{pageTitle('Fiche site')}</title>
      <Skeleton className={styles.skeletonTitle} />
      <div className={styles.skeletonKpis}>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} shape="block" className={styles.skeletonKpi} />
        ))}
      </div>
      <Skeleton shape="block" className={styles.skeletonMap} />
    </div>
  );
}
