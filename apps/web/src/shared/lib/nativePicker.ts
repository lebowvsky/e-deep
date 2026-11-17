import type { MouseEvent } from 'react';

/**
 * Opens the browser picker of a date / time input on click (its own icon is hidden). Skipped when
 * the input cannot change or the browser has no `showPicker`.
 */
export function openNativePicker(event: MouseEvent<HTMLInputElement>): void {
  const input = event.currentTarget;
  if (input.readOnly || input.disabled || !('showPicker' in input)) return;
  try {
    input.showPicker();
  } catch {
    // Expected when the browser refuses (e.g. inside a cross-origin frame): typing still works.
  }
}
