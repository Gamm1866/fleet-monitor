import DesignSystem from '@/pages/DesignSystem'

// ponytail: mientras haya dos vistas, un chequeo de pathname alcanza.
// Se cambia por un router recién cuando aparezca la tercera.
export default function App() {
  if (window.location.pathname === '/design-system') {
    return <DesignSystem />
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-surface px-6 text-center">
      <div>
        <p className="text-label uppercase text-text-tertiary">Monitor de flota</p>
        <h1 className="mt-2 text-display text-text-primary">
          La interfaz llega en la fase siguiente
        </h1>
        <a
          className="mt-4 inline-block rounded-control text-data-md text-accent underline underline-offset-4"
          href="/design-system"
        >
          Ver el sistema de diseño
        </a>
      </div>
    </main>
  )
}
