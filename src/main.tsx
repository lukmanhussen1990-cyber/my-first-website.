import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { App } from './App';
import { useTorch } from './state/store';
import { useUi } from './state/ui';
import { runtime } from './scene/runtime';
import { fallbackShadowMap } from './scene/environment/Dust';

if (import.meta.env.DEV) {
  // Handy for poking at state from the console / automated visual checks.
  Object.assign(window, { __torch: useTorch, __ui: useUi, __runtime: runtime, __fallbackShadow: fallbackShadowMap });
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
