import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
)

// Register the service worker only in production builds. The
// `virtual:pwa-register` module is provided by vite-plugin-pwa at build
// time and is not resolvable under Vitest/jsdom, so this must stay a
// dynamic import guarded by import.meta.env.PROD.
if (import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => registerSW({ immediate: true }))
    .catch(() => {})
}
