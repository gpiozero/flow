import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Live from './Live';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Live />
  </StrictMode>,
);
