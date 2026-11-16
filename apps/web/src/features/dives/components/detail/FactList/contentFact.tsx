import type { FactContent } from '../../../lib/diveFacts';
import type { MissingLabel } from '../../../lib/labels';
import { Quantity } from '../../Quantity';
import type { Fact } from './FactList';

/**
 * A `Fact` from a built value (`lib/diveFacts`): words as text, measures as a `Quantity` (mono,
 * spoken form), `null` as « — · Non renseigné(e) ».
 */
export function contentFact(
  term: string,
  content: FactContent | null,
  missingLabel?: MissingLabel,
  size: 'cell' | 'fact' = 'cell',
): Fact {
  if (content === null) return { term, value: null, missingLabel };
  if (content.kind === 'text') return { term, value: content.text, note: content.note };
  return {
    term,
    value: (
      <Quantity size={size} value={content.value} unit={content.unit} srText={content.srText} />
    ),
    note: content.note,
    noteSpoken: content.noteSpoken,
  };
}

/** Nothing entered in any of the facts (the card then says « Rien de renseigné »). */
export function isAllMissing(facts: readonly Fact[]): boolean {
  return facts.every((fact) => fact.value === null);
}
