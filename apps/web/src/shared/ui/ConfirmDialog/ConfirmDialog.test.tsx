import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

const renderDialog = (onCancel = vi.fn(), onConfirm = vi.fn()) =>
  render(
    <ConfirmDialog
      open
      title="Quitter sans enregistrer ?"
      description="Ton brouillon reste disponible sur cet appareil."
      cancelLabel="Rester"
      confirmLabel="Quitter"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />,
  );

describe('ConfirmDialog', () => {
  it('is a labelled modal that starts on the safe choice and keeps the focus inside', async () => {
    const user = userEvent.setup();
    renderDialog();
    const dialog = screen.getByRole('alertdialog', { name: 'Quitter sans enregistrer ?' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('button', { name: 'Rester' })).toBe(document.activeElement);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Quitter' })).toBe(document.activeElement);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Rester' })).toBe(document.activeElement);
  });

  it('cancels with Échap and confirms with its button', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderDialog(onCancel, onConfirm);
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Quitter' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cannot be cancelled while its choice is carried out (Échap pendant la suppression ne ferme pas)', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <ConfirmDialog
        open
        title="Supprimer ton compte ?"
        cancelLabel="Annuler"
        confirmLabel="Suppression…"
        confirmVariant="danger"
        confirmBusy
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );
    const cancel = screen.getByRole('button', { name: 'Annuler' });
    expect(cancel.getAttribute('aria-disabled')).toBe('true');
    await user.keyboard('{Escape}');
    await user.click(cancel);
    const scrim = container.querySelector('[aria-hidden="true"]');
    if (!(scrim instanceof HTMLElement)) throw new Error('scrim not rendered');
    await user.click(scrim);
    await user.click(screen.getByRole('button', { name: 'Suppression…' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Supprimer ton compte ?' })).toBeTruthy();
  });
});
