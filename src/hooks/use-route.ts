import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchRoute } from '@/lib/traccar'

/**
 * Recorrido del vehículo seleccionado.
 *
 * Consulta aparte de la flota y más espaciada: el histórico de seis horas casi
 * no cambia entre sondeos, y pedirlo al mismo ritmo que la posición actual
 * sería mover cientos de puntos por una punta nueva.
 */
const ROUTE_POLL_INTERVAL_MS = 60_000

export function useRoute(deviceId?: number) {
  return useQuery({
    queryKey: ['route', deviceId],
    queryFn: () => fetchRoute(deviceId!),
    enabled: deviceId !== undefined,
    refetchInterval: ROUTE_POLL_INTERVAL_MS,
    placeholderData: keepPreviousData,
    retry: 1,
  })
}
