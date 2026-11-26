// Texts of the landing page (welcome.jsx, accueil.md): what the product does today, no testimony
// nor invented figure (D45). The promises that depend on a feature are filtered by `landingContent`.
import type { IconName } from '@/shared/ui/Icon';
import type { AppConfig } from '@/shared/config/app';

/** Targets of the header anchors and of « Découvre l'app plus bas ». */
export const LANDING_ANCHORS = {
  preview: 'apercu',
  steps: 'comment-ca-marche',
  features: 'fonctionnalites',
  privacy: 'confidentialite',
} as const;

export interface Step {
  index: string;
  title: string;
  text: string;
  icon: IconName;
}

export const STEPS: readonly Step[] = [
  {
    index: '01',
    title: 'Saisis ta plongée',
    text: 'Site, heures, profondeur : l’essentiel en une minute après la sortie. Le reste se complète plus tard.',
    icon: 'pencil',
  },
  {
    index: '02',
    title: 'Retrouve-la en deux clics',
    text: 'Carnet numéroté comme ton carnet papier, filtres par région et profondeur.',
    icon: 'book',
  },
  {
    index: '03',
    title: 'Vois ta progression',
    text: 'Temps sous l’eau, profondeur max, sites explorés : ton parcours de plongeur d’un coup d’œil.',
    icon: 'stats',
  },
];

export interface Feature {
  id: string;
  title: string;
  text: string;
  icon: IconName;
}

const CORE_FEATURES: readonly Feature[] = [
  {
    id: 'logbook',
    title: 'Un vrai carnet',
    text: 'Numérotation qui suit ton carnet papier, déroulé, paliers, équipement et conditions.',
    icon: 'book',
  },
  {
    id: 'buddies',
    title: 'Ta palanquée',
    text: 'Note avec qui tu plonges, et retrouve tes binômes les plus fréquents sur ton tableau de bord.',
    icon: 'users',
  },
  {
    id: 'sites',
    title: 'Tes sites sur la carte',
    text: 'Tes sites restent privés. Crée-les en pleine saisie, place-les plus tard.',
    icon: 'map',
  },
  {
    id: 'dashboard',
    title: 'Ton tableau de bord',
    text: 'Plongées par mois, record de profondeur, dernière sortie.',
    icon: 'stats',
  },
];

const OFFLINE_FEATURE: Feature = {
  id: 'offline',
  title: 'Même sans réseau',
  text: 'Installe l’app sur ton téléphone ; ta saisie est gardée sur le bateau.',
  icon: 'wifi',
};

/** Title of the privacy promise; its text is `privacy.copy`, validated by the product owner. */
export const PRIVACY_TITLE = 'Tes données restent à toi';

const HERO_POINTS = [
  'Numérotation qui suit ton carnet papier',
  'Ta palanquée, ton équipement, tes conditions',
] as const;

const OFFLINE_POINT = 'Fonctionne même sans réseau, sur le bateau';

/** What the landing page may promise, given what the product delivers (D45). */
export function landingContent({ features, privacy }: AppConfig) {
  const promises: Feature[] = [...CORE_FEATURES];
  if (features.offline) promises.push(OFFLINE_FEATURE);
  if (privacy.copy !== null) {
    promises.push({
      id: LANDING_ANCHORS.privacy,
      title: PRIVACY_TITLE,
      text: privacy.copy,
      icon: 'lock',
    });
  }
  return {
    heroPoints: features.offline ? [...HERO_POINTS, OFFLINE_POINT] : [...HERO_POINTS],
    features: promises,
    hasPrivacy: privacy.copy !== null,
  };
}
