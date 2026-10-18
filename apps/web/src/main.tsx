import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from './App';
import './styles/globals.css';

declare global {
  interface Window {
    Paddle?: {
      Environment: { set(environment: 'sandbox'): void };
      Initialize(options: { token: string }): void;
    };
  }
}

const paddleToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
if (paddleToken) {
  const script = document.createElement('script');
  script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
  script.async = true;
  script.addEventListener('load', () => {
    if (paddleToken.startsWith('test_')) window.Paddle?.Environment.set('sandbox');
    window.Paddle?.Initialize({ token: paddleToken });
  });
  document.head.appendChild(script);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </HashRouter>
  </React.StrictMode>,
);
