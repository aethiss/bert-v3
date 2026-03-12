import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { App } from '@renderer/App';
import { store } from '@renderer/store';
import { Toaster } from '@ui/components/ui/sonner';
import '@renderer/styles/app.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
      <Toaster />
    </Provider>
  </React.StrictMode>
);
