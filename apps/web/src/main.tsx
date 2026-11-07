import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@/styles/global.scss';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root element in index.html.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
