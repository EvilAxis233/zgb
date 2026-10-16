import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AdminPage } from './components/AdminPage';
import { DialogProvider } from './components/BauhausDialog';
import './style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DialogProvider>
      {/^\/admin\/?$/.test(window.location.pathname) ? <AdminPage /> : <App />}
    </DialogProvider>
  </React.StrictMode>
);
