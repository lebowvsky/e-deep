// Dive log mocks — the 23 sites (Mediterranean and Brittany).
import type { DiveSiteRef } from '../types';

export interface MockSite extends DiveSiteRef {
  /** Usual depth range of the site (m), for the generator. */
  depthRange: [number, number];
}

const site = (
  id: string,
  name: string,
  place: string,
  region: DiveSiteRef['region'],
  depthRange: [number, number],
): MockSite => ({ id, name, place, region, depthRange });

export const SITES = {
  revellata: site('s01', 'Pointe de la Revellata', 'Calvi · Corse', 'corse', [22, 39]),
  bibliotheque: site('s02', 'La Bibliothèque', 'Calvi · Corse', 'corse', [18, 32]),
  b17: site('s03', 'Épave du B-17', 'Calvi · Corse', 'corse', [24, 28]),
  puntaBianca: site('s04', 'Punta Bianca', 'Calvi · Corse', 'corse', [12, 22]),
  scandola: site('s05', 'Les Aiguilles de Scandola', 'Girolata · Corse', 'corse', [10, 25]),
  moyades: site('s06', 'Les Moyades', 'Riou · Marseille', 'marseille', [20, 38]),
  liban: site('s07', 'Épave du Liban', 'Frioul · Marseille', 'marseille', [25, 36]),
  chaouen: site('s08', 'Le Chaouen', 'Planier · Marseille', 'marseille', [18, 35]),
  imperial: site('s09', 'L’Impérial de Terre', 'Riou · Marseille', 'marseille', [20, 39]),
  secCroix: site('s10', 'Sec de la Croix', 'Hyères · Var', 'var', [18, 34]),
  gabiniere: site('s11', 'La Gabinière', 'Port-Cros · Var', 'var', [20, 39]),
  donator: site('s12', 'Épave du Donator', 'Porquerolles · Var', 'var', [30, 39]),
  sarranier: site('s13', 'Sec du Sarranier', 'Porquerolles · Var', 'var', [15, 32]),
  vaisseau: site('s14', 'Pointe du Vaisseau', 'Port-Cros · Var', 'var', [12, 28]),
  fourmigue: site('s15', 'La Fourmigue', 'Giens · Var', 'var', [8, 20]),
  capRoux: site('s16', 'Cap Roux', 'Esterel · Var', 'esterel', [12, 28]),
  lionDeMer: site('s17', 'Le Lion de Mer', 'Saint-Raphaël · Var', 'esterel', [8, 20]),
  amoco: site('s18', 'Épave de l’Amoco Cadiz', 'Portsall · Bretagne', 'bretagne', [18, 28]),
  kleber: site('s19', 'Épave du Kléber', 'Morgat · Bretagne', 'bretagne', [20, 30]),
  pierresNoires: site('s20', 'Les Pierres Noires', 'Le Conquet · Bretagne', 'bretagne', [12, 25]),
  basseJaune: site('s21', 'La Basse Jaune', 'Glénan · Bretagne', 'bretagne', [10, 22]),
  toulinguet: site('s22', 'Pointe du Toulinguet', 'Camaret · Bretagne', 'bretagne', [10, 24]),
  septIles: site('s23', 'Les Sept-Îles', 'Perros-Guirec · Bretagne', 'bretagne', [8, 20]),
} as const satisfies Record<string, MockSite>;

export type SiteKey = keyof typeof SITES;
