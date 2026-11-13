/** Lower case, without accents: « Épave » and « epave » match. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}
