import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Signin from './pages/Signin.tsx'
import Signup from './pages/Signup.tsx'
import { ThemeProvider } from './components/theme-provider.tsx'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import DiscordClone from './pages/DiscordClone.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/signin" element={<Signin />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/discord" element={<DiscordClone />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>
)
