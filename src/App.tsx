import { Suspense, lazy } from 'react'
import Monitor from '@/pages/Monitor'

// El sistema de diseño es una vista de trabajo, no de producto: se carga bajo
// demanda para no cobrarle su peso al operador que solo abre el monitor.
const DesignSystem = lazy(() => import('@/pages/DesignSystem'))
const Share = lazy(() => import('@/pages/Share'))

// ponytail: mientras el ruteo sea "pathname o query param", un chequeo manual
// alcanza. Se cambia por un router recién cuando aparezca una cuarta vista.
export default function App() {
  if (window.location.pathname === '/design-system') {
    return (
      <Suspense fallback={<div className="min-h-dvh bg-surface" />}>
        <DesignSystem />
      </Suspense>
    )
  }

  // Live Share va por query param (?share=<id>) y no por ruta: es el mismo
  // origen que el monitor, solo filtrado a un vehículo — no un endpoint nuevo
  // que exponer ni un token que emitir.
  const shareId = Number(new URLSearchParams(window.location.search).get('share'))
  if (Number.isInteger(shareId) && shareId !== 0) {
    return (
      <Suspense fallback={<div className="min-h-dvh bg-surface" />}>
        <Share vehicleId={shareId} />
      </Suspense>
    )
  }

  return <Monitor />
}
