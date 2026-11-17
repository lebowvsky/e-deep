import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSubmitShortcut } from './useSubmitShortcut';

const pressCtrlEnter = () => fireEvent.keyDown(document, { key: 'Enter', ctrlKey: true });

describe('useSubmitShortcut', () => {
  it('submits on Ctrl or ⌘ + Entrée, not on Entrée alone', () => {
    const onSubmit = vi.fn();
    renderHook(() => useSubmitShortcut(onSubmit));
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
    pressCtrlEnter();
    fireEvent.keyDown(document, { key: 'Enter', metaKey: true });
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('does nothing while disabled, e.g. behind a modal dialog', () => {
    const onSubmit = vi.fn();
    const { rerender } = renderHook(({ enabled }) => useSubmitShortcut(onSubmit, enabled), {
      initialProps: { enabled: false },
    });
    pressCtrlEnter();
    expect(onSubmit).not.toHaveBeenCalled();
    rerender({ enabled: true });
    pressCtrlEnter();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
