/**
 * Lower case, without accents (« Épave » → « epave »): the one definition of « same text » for the
 * searches, the combobox and the tags.
 */
export function foldText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export interface TextMatch {
  /** Code-unit range of `text` that matched: `text.slice(start, end)`. */
  start: number;
  end: number;
}

/**
 * First place where `query` appears in `text`, ignoring case and accents (« revel » finds
 * « Révellata »). `null` when absent or when the query is blank.
 */
export function findTextMatch(text: string, query: string): TextMatch | null {
  const needle = foldText(query.trim());
  if (needle === '') return null;

  // One folded entry per character of `text`, with its offset, so a match maps back to `text`.
  const chars: { offset: number; folded: string }[] = [];
  let offset = 0;
  for (const char of text) {
    chars.push({ offset, folded: foldText(char) });
    offset += char.length;
  }

  for (let first = 0; first < chars.length; first += 1) {
    let candidate = '';
    for (let last = first; last < chars.length && candidate.length < needle.length; last += 1) {
      candidate += chars[last]?.folded ?? '';
      if (candidate === needle) {
        const end = chars[last + 1]?.offset ?? text.length;
        return { start: chars[first]?.offset ?? 0, end };
      }
      if (!needle.startsWith(candidate)) break;
    }
  }
  return null;
}

/**
 * `query` appears in a text already folded by `foldText` (blank query: no). For filtering a list,
 * each text folded once; `findTextMatch` is for the range to highlight.
 */
export function matchesText(foldedText: string, query: string): boolean {
  const needle = foldText(query.trim());
  return needle !== '' && foldedText.includes(needle);
}

/** Same text, ignoring case, accents and surrounding spaces. */
export function isSameText(a: string, b: string): boolean {
  return foldText(a.trim()) === foldText(b.trim());
}
