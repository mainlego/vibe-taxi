declare global {
  interface Window {
    ymaps: any
  }
}

let ymapsPromise: Promise<any> | null = null

export function loadYandexMaps(): Promise<any> {
  if (ymapsPromise) return ymapsPromise

  ymapsPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window is not defined'))
      return
    }

    if (window.ymaps) {
      window.ymaps.ready(() => resolve(window.ymaps))
      return
    }

    const script = document.createElement('script')
    const apiKey = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY
    script.src = `https://api-maps.yandex.ru/2.1/?apikey=${apiKey}&lang=ru_RU`
    script.async = true

    script.onload = () => {
      window.ymaps.ready(() => resolve(window.ymaps))
    }

    script.onerror = () => {
      ymapsPromise = null
      reject(new Error('Failed to load Yandex Maps'))
    }

    document.head.appendChild(script)
  })

  return ymapsPromise
}

export interface GeocoderResult {
  address: string
  coordinates: [number, number]
  shortAddress: string
}

export async function geocode(query: string): Promise<GeocoderResult[]> {
  const ymaps = await loadYandexMaps()

  return new Promise((resolve, reject) => {
    ymaps.geocode(query, { results: 5 }).then(
      (res: any) => {
        const results: GeocoderResult[] = []
        const geoObjects = res.geoObjects

        geoObjects.each((obj: any) => {
          const coords = obj.geometry.getCoordinates()
          results.push({
            address: obj.getAddressLine(),
            coordinates: [coords[0], coords[1]],
            shortAddress: obj.properties.get('name') || obj.getAddressLine()
          })
        })

        resolve(results)
      },
      (err: Error) => reject(err)
    )
  })
}

export async function reverseGeocode(coords: [number, number]): Promise<GeocoderResult | null> {
  const ymaps = await loadYandexMaps()

  return new Promise((resolve, reject) => {
    ymaps.geocode(coords, { results: 1 }).then(
      (res: any) => {
        const firstGeoObject = res.geoObjects.get(0)
        if (!firstGeoObject) {
          resolve(null)
          return
        }

        resolve({
          address: firstGeoObject.getAddressLine(),
          coordinates: coords,
          shortAddress: firstGeoObject.properties.get('name') || firstGeoObject.getAddressLine()
        })
      },
      (err: Error) => reject(err)
    )
  })
}

export interface RouteInfo {
  distance: number
  duration: number
  path: number[][]
}

export async function buildRoute(
  from: [number, number],
  to: [number, number]
): Promise<RouteInfo> {
  const ymaps = await loadYandexMaps()

  return new Promise((resolve, reject) => {
    ymaps.route([from, to], { mapStateAutoApply: false }).then(
      (route: any) => {
        const activeRoute = route.getRoutes().get(0)
        if (!activeRoute) {
          reject(new Error('Route not found'))
          return
        }

        const distance = activeRoute.properties.get('distance').value
        const duration = activeRoute.properties.get('duration').value
        const path = activeRoute.getPaths().get(0).geometry.getCoordinates()

        resolve({
          distance,
          duration,
          path
        })
      },
      (err: Error) => reject(err)
    )
  })
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} м`
  }
  return `${(meters / 1000).toFixed(1)} км`
}

export function formatDuration(seconds: number): string {
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) {
    return `${minutes} мин`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours} ч ${mins} мин`
}
