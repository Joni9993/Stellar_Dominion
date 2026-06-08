import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// React.StrictMode intentionally omitted — PixiJS WebGL doesn't survive the
// double-invocation of effects that StrictMode performs in development.
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
