import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from "react-router-dom";

import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import notifly from 'notifly-js-sdk-dev';

const VAPID_PUBLIC_KEY = "BGkEcbk7nbeozYYvs7EXqWDuqcDPBdxJ5p51jM9vx2ERj5iGSntBXFhIociva1boO9LuCec-ZCCAI_HC82NUIuQ"
notifly.registerServiceWorker(VAPID_PUBLIC_KEY);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
