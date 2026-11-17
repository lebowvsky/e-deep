import { useEffect, useState } from 'react';

/** Band of the viewport that counts as « being read »: its top 40 %. */
const READING_BAND = '0px 0px -60% 0px';

/**
 * Id of the element currently read among `ids` (page order), for a table of contents: the first one
 * crossing the top band of the viewport; between two elements, the previous answer stays. `ids[0]`
 * until the page scrolls, and without `IntersectionObserver`. `ids` must be stable (constant).
 */
export function useScrollSpy(ids: readonly string[]): string | undefined {
  const [activeId, setActiveId] = useState(ids[0]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const current = ids.find((id) => visible.has(id));
        if (current !== undefined) setActiveId(current);
      },
      { rootMargin: READING_BAND },
    );
    for (const element of elements) observer.observe(element);
    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}
