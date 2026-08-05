import { Suspense, lazy } from 'react'
import Monitor from '@/pages/Monitor'

// El sistema de diseño es una vista de trabajo, no de producto: se carga bajo
// demanda para no cobrarle su peso al operador que solo abre el monitor.
const DesignSystem = lazy(() => import('@/pages/DesignSystem'))

// ponytail: mientras haya dos vistas, un chequeo de pathname alcanza.
// Se cambia por un router recién cuando aparezca la tercera.
export default function App() {
  if (window.location.pathname === '/design-system') {
    return (
      <Suspense fallback={<div className="min-h-dvh bg-surface" />}>
        <DesignSystem />
      </Suspense>
    )
  }

  return <Monitor />
}
