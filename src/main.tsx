import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AdminPage } from './components/AdminPage';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/^\/admin\/?$/.test(window.location.pathname) ? <AdminPage /> : <App />}
  </React.StrictMode>
);
