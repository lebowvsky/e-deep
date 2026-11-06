/** Joins the truthy class names (CSS module lookups are `string | undefined`). */
export function cx(...classNames: (string | false | null | undefined)[]): string {
  return classNames.filter(Boolean).join(' ');
}
