import { useState, useTransition } from 'react';
import { formatDiveCount } from '@/shared/lib/format';
import type { SiteEntry } from '@/shared/model/site';
import type { DeleteSiteResult } from '@/shared/sites/lib/siteCommands';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import styles from './DeleteSiteDialog.module.scss';

export interface DeleteSiteDialogProps {
  entry: SiteEntry;
  /** Writes the deletion (`deleteSite`): refused for a site with dives. */
  remove: (entry: SiteEntry) => Promise<DeleteSiteResult>;
  onDeleted: () => void;
  /** The way out for a site with dives. */
  onMerge: () => void;
  onCancel: () => void;
}

const DELETE_FAILED = 'La suppression n’a pas abouti. Réessaie.';

/**
 * « Supprimer le site » (sites.md): only for a site without dive. With dives, it says why not and
 * offers the merge instead, so that no dive is lost.
 */
export function DeleteSiteDialog({
  entry,
  remove,
  onDeleted,
  onMerge,
  onCancel,
}: DeleteSiteDialogProps) {
  const [refusedCount, setRefusedCount] = useState(entry.stats.diveCount);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const name = entry.site.name;

  if (refusedCount > 0) {
    return (
      <ConfirmDialog
        open
        title={`Supprimer « ${name} » ?`}
        description={`Ce site a ${formatDiveCount(refusedCount)} : fusionne-le avec un autre site pour ne pas les perdre.`}
        cancelLabel="Annuler"
        confirmLabel="Fusionner…"
        onCancel={onCancel}
        onConfirm={onMerge}
      />
    );
  }

  const confirm = () => {
    if (isPending) return;
    startTransition(async () => {
      try {
        const result = await remove(entry);
        if (result.status === 'deleted') onDeleted();
        else setRefusedCount(result.diveCount);
      } catch {
        setError(DELETE_FAILED);
      }
    });
  };

  return (
    <ConfirmDialog
      open
      title={`Supprimer « ${name} » ?`}
      description="Le site sera supprimé. Action irréversible."
      cancelLabel="Annuler"
      confirmLabel="Supprimer"
      confirmVariant="danger"
      confirmDisabled={isPending}
      onCancel={onCancel}
      onConfirm={confirm}
    >
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
