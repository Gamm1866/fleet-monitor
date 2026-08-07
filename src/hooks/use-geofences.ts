import { useQuery } from '@tanstack/react-query'
import { fetchGeofences } from '@/lib/traccar'

/** Los geofences casi no cambian: no hace falta sondearlos cada 8 segundos
 * junto con la flota, alcanza con refrescarlos cada 5 minutos. */
const GEOFENCE_POLL_INTERVAL_MS = 5 * 60_000

export function useGeofences() {
  return useQuery({
    queryKey: ['geofences'],
    queryFn: fetchGeofences,
    refetchInterval: GEOFENCE_POLL_INTERVAL_MS,
    retry: 1,
  })
}
