/**
 * index.js — React Entry Point
 *
 * This is the very first file React runs.
 * It renders the <App /> component into the <div id="root"> in index.html.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';

// Import Bootstrap CSS — gives us all Bootstrap styles globally
import 'bootstrap/dist/css/bootstrap.min.css';

// Import our global custom styles
import './App.css';

import App from './App';

// Find the root div in index.html and render the App there
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
