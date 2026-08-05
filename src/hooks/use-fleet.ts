import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchFleet } from '@/lib/traccar'

/**
 * Cada cuánto se le pregunta al servidor.
 *
 * Se descartó el WebSocket de Traccar: `/api/socket` solo autentica con la
 * cookie de sesión del navegador, que el proxy no puede reenviar sin exponer
 * la cuenta. El polling es la opción honesta, y a 8 segundos el retraso máximo
 * es menor que el intervalo con que OsmAnd reporta.
 */
const POLL_INTERVAL_MS = 8_000

export function useFleet() {
  return useQuery({
    queryKey: ['fleet'],
    queryFn: fetchFleet,
    refetchInterval: POLL_INTERVAL_MS,
    // Sin esto, cada refetch vacía los datos y el panel parpadea a skeleton
    // ocho veces por minuto.
    placeholderData: keepPreviousData,
    // El polling ya cubre la actualización; reintentar al instante sobre un
    // servidor caído solo multiplica las peticiones fallidas.
    retry: 1,
  })
}
