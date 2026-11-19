// Tolerant search of the sites, for the site field of the dive form and the list of the map:
// case and accents ignored, articles ignored, partial words, one typo on long words.
import { foldText } from '@/shared/lib/textMatch';

/** What the search reads: the name, and the dive count to break ties. */
export interface SearchableSite {
  name: string;
  diveCount: number;
}

const ARTICLES: ReadonlySet<string> = new Set(['la', 'le', 'les', 'l']);

/** A typo is tolerated from this length on (« revelata » finds « Revellata »). */
const FUZZY_MIN_LENGTH = 5;

/** Best first. */
const MATCH_RANKS = ['prefix', 'word', 'partial', 'approximate'] as const;
type MatchRank = (typeof MATCH_RANKS)[number];

/** « Pointe de la Revellata » → `['pointe', 'de', 'revellata']`; « L’Impérial » → `['imperial']`. */
export function searchWords(text: string): string[] {
  return foldText(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== '' && !ARTICLES.has(word));
}

/** Levenshtein distance, stopped as soon as it exceeds `max` (`max + 1` is returned then). */
function boundedDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[b.length] ?? max + 1;
}

/**
 * A query word close to a word of the name: one edit away from the word, or from its beginning
 * (« revela » → « revellata »). Short words must be typed right.
 */
function isApproximate(queryWord: string, word: string): boolean {
  if (queryWord.length < FUZZY_MIN_LENGTH) return false;
  const beginnings = [word, word.slice(0, queryWord.length), word.slice(0, queryWord.length + 1)];
  return beginnings.some((candidate) => boundedDistance(queryWord, candidate, 1) <= 1);
}

type WordMatch = 'word' | 'partial' | 'approximate';

function matchWord(queryWord: string, words: readonly string[]): WordMatch | null {
  if (words.includes(queryWord)) return 'word';
  if (words.some((word) => word.startsWith(queryWord))) return 'partial';
  if (words.some((word) => isApproximate(queryWord, word))) return 'approximate';
  return null;
}

/** How well the name matches: every query word must be found, the weakest one sets the rank. */
function rankName(name: string, queryWords: readonly string[]): MatchRank | null {
  const words = searchWords(name);
  if (words.join(' ').startsWith(queryWords.join(' '))) return 'prefix';
  let worst: MatchRank = 'word';
  for (const queryWord of queryWords) {
    const match = matchWord(queryWord, words);
    if (match === null) return null;
    if (MATCH_RANKS.indexOf(match) > MATCH_RANKS.indexOf(worst)) worst = match;
  }
  return worst;
}

const byName = (a: SearchableSite, b: SearchableSite): number =>
  a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });

/**
 * The sites matching `query`, best first: name starting with the query > whole words > partial
 * words > approximate words, then the most dived, then by name. A blank query (or articles only)
 * keeps every site, most dived first.
 */
export function searchSites<T extends SearchableSite>(sites: readonly T[], query: string): T[] {
  const queryWords = searchWords(query);
  if (queryWords.length === 0) {
    return [...sites].sort((a, b) => b.diveCount - a.diveCount || byName(a, b));
  }
  return sites
    .map((site) => ({ site, rank: rankName(site.name, queryWords) }))
    .filter((entry): entry is { site: T; rank: MatchRank } => entry.rank !== null)
    .sort(
      (a, b) =>
        MATCH_RANKS.indexOf(a.rank) - MATCH_RANKS.indexOf(b.rank) ||
        b.site.diveCount - a.site.diveCount ||
        byName(a.site, b.site),
    )
    .map(({ site }) => site);
}
