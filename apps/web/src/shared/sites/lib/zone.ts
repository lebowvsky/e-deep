// Sea area of a site: from its position when placed, else guessed from the words of its region.
// French coasts first (the zones of the product); anything else is `autre`.
//
// Limit: rectangles, not coastlines. A position inland but inside a box (a quarry near Rouen, a
// lake near Avignon, Nantes) takes the sea of the box; telling land from sea needs coastline data
// (or the geocoding of V2). Paris and the centre of France fall outside every box (`autre`).
import { foldText } from '@/shared/lib/textMatch';
import type { GeoPoint } from '@/shared/model/geo';
import type { SiteZone } from '@/shared/model/site';

interface Box {
  south: number;
  north: number;
  west: number;
  east: number;
}

const inBox = ({ latitude, longitude }: GeoPoint, box: Box): boolean =>
  latitude >= box.south && latitude <= box.north && longitude >= box.west && longitude <= box.east;

// The Channel, in two boxes: the north coast of Brittany from Portsall to the bay of the
// Mont-Saint-Michel (west of it, Ouessant and the Iroise sea are the Atlantic), then Normandy
// to the Strait of Dover (north of Paris).
const CHANNEL_BRITTANY: Box = { south: 48.4, north: 49.1, west: -4.8, east: -1.4 };
const CHANNEL_NORMANDY: Box = { south: 49.1, north: 51.5, west: -2.5, east: 2.5 };
// Gibraltar to the Levant; the Bay of Biscay and the Black Sea are carved out below.
const MEDITERRANEAN: Box = { south: 30, north: 46, west: -5.6, east: 36.5 };
const BAY_OF_BISCAY: Box = { south: 42.5, north: 46, west: -5.6, east: 1 };
const BLACK_SEA: Box = { south: 40.9, north: 46, west: 26.5, east: 36.5 };
// From the Iroise sea down to Gibraltar, west of the continent.
const ATLANTIC: Box = { south: 35, north: 52, west: -30, east: -1 };

function zoneOfPosition(position: GeoPoint): SiteZone {
  if (inBox(position, CHANNEL_BRITTANY) || inBox(position, CHANNEL_NORMANDY)) return 'manche';
  if (
    inBox(position, MEDITERRANEAN) &&
    !inBox(position, BAY_OF_BISCAY) &&
    !inBox(position, BLACK_SEA)
  ) {
    return 'mediterranee';
  }
  if (inBox(position, ATLANTIC) || inBox(position, BAY_OF_BISCAY)) return 'atlantique';
  return 'autre';
}

// Words of a region (folded) that name a coast. « Bretagne » alone says nothing: it has both seas.
const REGION_WORDS: readonly { zone: SiteZone; words: readonly string[] }[] = [
  {
    zone: 'mediterranee',
    words: [
      'mediterranee',
      'corse',
      'var',
      'marseille',
      'esterel',
      'provence',
      'calanques',
      'cote d azur',
      'cote bleue',
      'cote vermeille',
      'languedoc',
      'roussillon',
      'hyeres',
      'porquerolles',
      'port-cros',
      'nice',
      'antibes',
      'cannes',
      'banyuls',
      'sete',
      'sardaigne',
      'sicile',
      'baleares',
      'malte',
      'croatie',
      'grece',
    ],
  },
  {
    zone: 'atlantique',
    words: [
      'atlantique',
      'gascogne',
      'iroise',
      'crozon',
      'morgat',
      'camaret',
      'glenan',
      'quiberon',
      'belle-ile',
      'groix',
      'vendee',
      'charente',
      'oleron',
      'arcachon',
      'pays basque',
      'biarritz',
      'canaries',
      'acores',
    ],
  },
  {
    zone: 'manche',
    words: [
      'manche',
      'normandie',
      'cotentin',
      'saint-malo',
      'dinard',
      'granville',
      'perros-guirec',
      'sept-iles',
      'roscoff',
      'portsall',
      'brehat',
      'jersey',
      'guernesey',
      'cherbourg',
      'cote d opale',
    ],
  },
];

/** « Côte d’Azur · Var » → `cote d azur var`: folded, apostrophes and separators as spaces. */
function regionText(region: string): string {
  return ` ${foldText(region)
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim()} `;
}

function zoneOfRegion(region: string): SiteZone {
  const text = regionText(region);
  const found = REGION_WORDS.find(({ words }) => words.some((word) => text.includes(` ${word} `)));
  return found?.zone ?? 'autre';
}

/** The zone of a site: its position decides; without one, the words of its region. */
export function deriveZone(position: GeoPoint | null, region: string | null): SiteZone {
  if (position) return zoneOfPosition(position);
  return region === null ? 'autre' : zoneOfRegion(region);
}
