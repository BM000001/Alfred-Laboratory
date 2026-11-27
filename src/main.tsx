import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import { STUDIES_DEMO_BASE } from './storage/namespace';
import Demo from './modules/studies/StudiesDemoEntry';
import './styles/design.css';
import './styles/interface.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {import.meta.env.BASE_URL === STUDIES_DEMO_BASE
      ? <Demo />
      : <App />}
  </React.StrictMode>,
);
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', {
      scope: import.meta.env.BASE_URL,
    }).catch(() => {
      // A aplicação continua funcional; apenas o reaproveitamento offline dos assets OCR fica indisponível.
    });
  });
}
