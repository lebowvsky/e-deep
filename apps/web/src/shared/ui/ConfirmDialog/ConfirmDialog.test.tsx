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
});
