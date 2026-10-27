import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './app/App'
import { AuthProvider } from './features/auth/AuthProvider'
import './index.css'

// BASE_URL ist '/' lokal und '/kraftwerk/' im Build für GitHub Pages.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

const root = document.getElementById('root')
if (!root) throw new Error('Root-Element fehlt')

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <App />
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
)
