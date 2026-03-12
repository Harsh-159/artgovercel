/**
 * Fast location utility — two-tier strategy:
 * 1. IP geolocation (instant city-level, ~100ms) — removes the "Cambridge default"
 * 2. GPS watchPosition (accurate, refines the position once available)
 */

export interface LatLng {
  lat: number;
  lng: number;
}

type LocationCallback = (location: LatLng, source: 'ip' | 'gps') => void;
type ErrorCallback = (err: string) => void;

/**
 * Get location fast. Fires IP geo first (instant), then refines with GPS.
 * Returns a cleanup function to stop watching.
 */
export function getLocationFast(
  onLocation: LocationCallback,
  onError?: ErrorCallback
): () => void {
  let watchId: number | null = null;
  let cancelled = false;
  let gotGps = false;

  // Tier 1: IP-based geolocation (city-level, nearly instant)
  fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
    .then(res => res.json())
    .then((data) => {
      if (!cancelled && !gotGps && data.latitude && data.longitude) {
        onLocation({ lat: data.latitude, lng: data.longitude }, 'ip');
      }
    })
    .catch(() => {
      // Fallback IP geo service if ipapi fails
      if (!cancelled && !gotGps) {
        fetch('https://ip-api.com/json/?fields=lat,lon', { signal: AbortSignal.timeout(4000) })
          .then(res => res.json())
          .then((data) => {
            if (!cancelled && !gotGps && data.lat && data.lon) {
              onLocation({ lat: data.lat, lng: data.lon }, 'ip');
            }
          })
          .catch(() => {}); // silently fail, GPS will handle it
      }
    });

  // Tier 2: GPS watchPosition (accurate)
  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        gotGps = true;
        onLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }, 'gps');

        // Once we have an accurate GPS fix, stop watching to save battery
        if (pos.coords.accuracy < 100 && watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
      },
      (err) => {
        if (!cancelled) {
          const messages: Record<number, string> = {
            1: 'Location permission denied',
            2: 'Location unavailable',
            3: 'Location request timed out',
          };
          onError?.(messages[err.code] || 'Location error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  } else {
    onError?.('Geolocation is not supported by your browser');
  }

  // Return cleanup
  return () => {
    cancelled = true;
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
  };
}

/**
 * One-shot locate (for "Locate Me" button) — uses cached GPS first for instant response.
 */
export function locateNow(
  onLocation: (location: LatLng) => void,
  onError?: (err: string) => void
): void {
  if (!navigator.geolocation) {
    onError?.('Geolocation not supported');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => onLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => onError?.(err.message),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
  );
}
