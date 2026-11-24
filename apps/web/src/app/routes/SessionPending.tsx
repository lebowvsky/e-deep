import styles from './SessionPending.module.scss';

/** First load, while the route loader checks the session: nothing to see, one thing to hear. */
export function SessionPending() {
  return (
    <p role="status" className={styles.status}>
      Chargement…
    </p>
  );
}
