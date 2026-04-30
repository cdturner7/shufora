import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { logger } from './utils/logger';
import './styles/global.css';

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' });
}

window.addEventListener('error', (e) => {
  logger.error('global', e.message || 'Uncaught error', {
    filename: e.filename,
    line: e.lineno,
    col: e.colno,
    stack: e.error?.stack,
  });
});

window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason;
  const msg = reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection');
  logger.error('global', msg, reason instanceof Error ? { stack: reason.stack } : reason);
});

logger.info('app', `Shufora started — ${new Date().toLocaleString()}`);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
