import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nextProvider } from 'react-i18next';
// import App from './App.jsx'
import Lineage from './components/lineage/index.jsx'

import i18n from './utils/i18next/LocalUtil';
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* <App /> */}
    <I18nextProvider i18n={i18n}>
      <div style={{width: '100vw', height: '100vh'}}>
        <Lineage />
      </div>
    </I18nextProvider>
  </React.StrictMode>,
)
