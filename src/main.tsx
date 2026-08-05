import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './styles/global.css'
import App from './App.tsx'
import { ThemeProvider } from './providers/theme-provider.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // El dato de una flota envejece en segundos. Marcarlo fresco por más
      // tiempo del que dura el intervalo de polling haría que volver a la
      // pestaña muestre una posición vieja como si fuera actual.
      staleTime: 0,
      refetchOnWindowFocus: true,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
