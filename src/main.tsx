import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/global.css';

// --- PWA service worker (prompt mode: never reload an active editor) --------
try {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.dispatchEvent(new Event('naildesk:need-refresh'));
    },
    onOfflineReady() {
      window.dispatchEvent(new Event('naildesk:offline-ready'));
    },
    onRegisterError() {
      /* offline caching unavailable — app still works from network */
    },
  });
  (window as unknown as { __naildeskSwUpdate?: () => Promise<void> }).__naildeskSwUpdate = updateSW;
} catch {
  /* dev-mode or unsupported: skip registration */
}

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
