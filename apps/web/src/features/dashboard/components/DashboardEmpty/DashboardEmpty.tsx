import { useId } from 'react';
import { ButtonLink } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Overline } from '@/shared/ui/Overline';
import type { User } from '../../types';
import { KpiCard } from '../KpiCard';
import { MapBackdrop } from '../MapBackdrop';
import styles from './DashboardEmpty.module.scss';

export interface DashboardEmptyProps {
  user: User;
}

const EMPTY_KPIS = [
  { short: 'Plongées', long: 'Plongées totales' },
  { short: 'Temps', long: 'Temps sous l’eau' },
  { short: 'Prof. max', long: 'Profondeur max' },
  { short: 'Sites', long: 'Sites explorés' },
] as const;

/**
 * First visit, no dive yet (mockup 02): deliberately minimal — one CTA (the FAB on phones), KPI at
 * « — », and explanations where data will appear.
 */
export function DashboardEmpty({ user }: DashboardEmptyProps) {
  const mapTitleId = useId();

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Overline tone="accent">Première connexion · Bienvenue</Overline>
          <h1 className={styles.title}>Bienvenue à bord, {user.firstName}</h1>
          <p className={styles.intro}>
            Ton carnet est vierge.{' '}
            <span className={styles.hint}>La première plongée l’ouvrira.</span>
          </p>
        </div>
        {/* Phones: the FAB is the single CTA, as in the nominal state. */}
        <ButtonLink className={styles.cta} to="/dives/new" variant="primary" size="lg" icon="plus">
          Enregistrer ma première plongée
        </ButtonLink>
      </header>

      <ul className={styles.kpis} aria-label="Chiffres clés">
        {EMPTY_KPIS.map((label) => (
          <KpiCard
            key={label.long}
            label={label}
            value="—"
            tone="muted"
            srText="Aucune donnée"
            caption="en attente de données"
          />
        ))}
      </ul>

      <section className={styles.map} aria-labelledby={mapTitleId}>
        <MapBackdrop variant="empty" />
        <div className={styles.mapMessage}>
          <span className={styles.pin} aria-hidden="true">
            <Icon name="pin" size="xxl" />
          </span>
          <h2 id={mapTitleId} className={styles.mapTitle}>
            Aucun site marqué pour l’instant
          </h2>
          <p className={styles.mapText}>
            Ta carte se remplira au fil de tes plongées. Chaque site exploré y laissera une trace.
          </p>
        </div>
      </section>

      <div className={styles.pair}>
        <section className={styles.placeholder}>
          <Overline as="h2">Dernière plongée</Overline>
          <p className={styles.placeholderText}>
            Profondeur, durée, température — tout apparaîtra ici après ta première saisie.
          </p>
        </section>
        <section className={styles.placeholder}>
          <Overline as="h2">Plongées par mois</Overline>
          <p className={styles.placeholderText}>
            Le rythme de ton année se dessinera au fil des mois.
          </p>
        </section>
      </div>
    </div>
  );
}
