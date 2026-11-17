export interface NumberInputFormat {
  /** Keeps one decimal separator, written as a French comma. */
  decimal: boolean;
  /** Keeps a leading minus sign (water temperature). */
  signed: boolean;
}

/**
 * Cleans what was typed in a number field: digits only, a leading `-` when signed, and one decimal
 * separator when decimal — a dot or a comma, always shown as a comma (« 12.5 » → « 12,5 »).
 */
export function normalizeNumberInput(raw: string, { decimal, signed }: NumberInputFormat): string {
  const negative = signed && raw.trimStart().startsWith('-');
  let seenSeparator = false;
  let body = '';
  for (const char of raw) {
    if (char >= '0' && char <= '9') {
      body += char;
    } else if (decimal && (char === ',' || char === '.') && !seenSeparator) {
      seenSeparator = true;
      body += ',';
    }
  }
  return negative ? `-${body}` : body;
}

/** Number written in a number field (« 12,5 », « -2 »), or `null` when empty or incomplete. */
export function parseNumberInput(text: string): number | null {
  const value = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) ? null : value;
}
