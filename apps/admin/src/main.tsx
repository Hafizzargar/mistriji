import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

document.body.style.setProperty('overflow', 'auto', 'important');
document.documentElement.style.setProperty('overflow', 'auto', 'important');
