'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { loadYandexMaps, reverseGeocode, type GeocoderResult } from '@/lib/yandex-maps'

interface UseYandexMapOptions {
  center?: [number, number]
  zoom?: number
  onMapClick?: (coords: [number, number], address: GeocoderResult | null) => void
  onUserLocationFound?: (coords: [number, number], address: GeocoderResult | null) => void
}

export function useYandexMap(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseYandexMapOptions = {}
) {
  const {
    center = [55.751574, 37.573856],
    zoom = 12,
    onMapClick,
    onUserLocationFound
  } = options

  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)

  const mapRef = useRef<any>(null)
  const ymapsRef = useRef<typeof ymaps | null>(null)
  const markersRef = useRef<Map<string, any>>(new Map())
  const routeRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let mounted = true

    loadYandexMaps()
      .then((ymaps) => {
        if (!mounted || !containerRef.current) return

        ymapsRef.current = ymaps

        mapRef.current = new ymaps.Map(containerRef.current, {
          center,
          zoom,
          controls: ['zoomControl', 'geolocationControl']
        }, {
          suppressMapOpenBlock: true
        })

        if (onMapClick) {
          mapRef.current.events.add('click', async (e: any) => {
            const coords = e.get('coords') as [number, number]
            const address = await reverseGeocode(coords)
            onMapClick(coords, address)
          })
        }

        setIsLoaded(true)
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message)
        }
      })

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.destroy()
        mapRef.current = null
      }
    }
  }, [])

  const getUserLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported')
      return null
    }

    return new Promise<[number, number] | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const coords: [number, number] = [
            position.coords.latitude,
            position.coords.longitude
          ]
          setUserLocation(coords)

          if (mapRef.current) {
            mapRef.current.setCenter(coords, 15, { duration: 500 })
          }

          const address = await reverseGeocode(coords)
          onUserLocationFound?.(coords, address)

          resolve(coords)
        },
        (err) => {
          setError(`Geolocation error: ${err.message}`)
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      )
    })
  }, [onUserLocationFound])

  const setCenter = useCallback((coords: [number, number], zoomLevel?: number) => {
    if (mapRef.current) {
      mapRef.current.setCenter(coords, zoomLevel ?? mapRef.current.getZoom(), {
        duration: 500
      })
    }
  }, [])

  const addMarker = useCallback((
    id: string,
    coords: [number, number],
    options?: {
      preset?: string
      iconColor?: string
      draggable?: boolean
      content?: string
      onDragEnd?: (newCoords: [number, number]) => void
    }
  ) => {
    if (!mapRef.current || !ymapsRef.current) return

    if (markersRef.current.has(id)) {
      markersRef.current.get(id).geometry.setCoordinates(coords)
      return
    }

    const placemark = new ymapsRef.current.Placemark(coords, {
      balloonContent: options?.content
    }, {
      preset: options?.preset || 'islands#redDotIcon',
      iconColor: options?.iconColor,
      draggable: options?.draggable || false
    })

    if (options?.draggable && options?.onDragEnd) {
      placemark.events.add('dragend', () => {
        const newCoords = placemark.geometry.getCoordinates()
        options.onDragEnd?.(newCoords)
      })
    }

    mapRef.current.geoObjects.add(placemark)
    markersRef.current.set(id, placemark)
  }, [])

  const removeMarker = useCallback((id: string) => {
    if (!mapRef.current) return

    const marker = markersRef.current.get(id)
    if (marker) {
      mapRef.current.geoObjects.remove(marker)
      markersRef.current.delete(id)
    }
  }, [])

  const updateMarkerPosition = useCallback((id: string, coords: [number, number]) => {
    const marker = markersRef.current.get(id)
    if (marker) {
      marker.geometry.setCoordinates(coords)
    }
  }, [])

  const showRoute = useCallback(async (
    from: [number, number],
    to: [number, number],
    options?: { color?: string; strokeWidth?: number }
  ) => {
    if (!mapRef.current || !ymapsRef.current) return null

    if (routeRef.current) {
      mapRef.current.geoObjects.remove(routeRef.current)
    }

    return new Promise((resolve) => {
      ymapsRef.current!.route([from, to], {
        mapStateAutoApply: true,
        routingMode: 'auto'
      }).then((route: any) => {
        route.getPaths().options.set({
          strokeColor: options?.color || '#6366f1',
          strokeWidth: options?.strokeWidth || 5,
          opacity: 0.8
        })

        mapRef.current.geoObjects.add(route)
        routeRef.current = route

        const activeRoute = route.getRoutes().get(0)
        const distance = activeRoute?.properties.get('distance').value || 0
        const duration = activeRoute?.properties.get('duration').value || 0

        resolve({ distance, duration })
      }).catch(() => {
        resolve(null)
      })
    })
  }, [])

  const clearRoute = useCallback(() => {
    if (mapRef.current && routeRef.current) {
      mapRef.current.geoObjects.remove(routeRef.current)
      routeRef.current = null
    }
  }, [])

  const fitBounds = useCallback((points: [number, number][]) => {
    if (!mapRef.current || points.length === 0) return

    const bounds = points.reduce(
      (acc, point) => {
        return [
          [Math.min(acc[0][0], point[0]), Math.min(acc[0][1], point[1])],
          [Math.max(acc[1][0], point[0]), Math.max(acc[1][1], point[1])]
        ]
      },
      [[points[0][0], points[0][1]], [points[0][0], points[0][1]]] as [[number, number], [number, number]]
    )

    mapRef.current.setBounds(bounds, { checkZoomRange: true, zoomMargin: 50 })
  }, [])

  return {
    isLoaded,
    error,
    userLocation,
    map: mapRef.current,
    ymaps: ymapsRef.current,
    getUserLocation,
    setCenter,
    addMarker,
    removeMarker,
    updateMarkerPosition,
    showRoute,
    clearRoute,
    fitBounds
  }
}
