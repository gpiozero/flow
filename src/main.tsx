import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import Landing from './Landing';
import './index.css';

// Two static routes, both full-page navigations (plain <a> links, not
// client-side routing) — deciding once at load time is all that's
// needed, and the browser's own back/forward already works correctly.
const path = window.location.pathname.replace(/\/+$/, '');
const Root = path === '/app' ? App : Landing;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
