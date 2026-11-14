import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// `findBy*` / `waitFor` give up after 1 s by default. A page test pays for the cold first render of
// a whole screen (≈ 0.2 s alone, up to ≈ 1 s when every core runs a Vitest worker, e.g. `pnpm test`
// at the root): 3 s keeps a real margin under load and still fails well before the 5 s test timeout.
configure({ asyncUtilTimeout: 3000 });

// Vitest globals are disabled, so Testing Library cannot register its automatic cleanup.
afterEach(() => {
  cleanup();
});
