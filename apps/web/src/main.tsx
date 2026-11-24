import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Global styles first (fonts, reset, focus), then the components': at equal specificity, a
// component's rule (e.g. the bare `<input>` of a field, framed by its box) wins over the reset.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@/styles/global.scss';
import { App } from '@/app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
