'use client'

import { useRef, useEffect } from 'react'
import { useYandexMap } from '@/hooks/useYandexMap'
import type { GeocoderResult } from '@/lib/yandex-maps'

interface MapProps {
  className?: string
  center?: [number, number]
  zoom?: number
  onMapClick?: (coords: [number, number], address: GeocoderResult | null) => void
  onUserLocationFound?: (coords: [number, number], address: GeocoderResult | null) => void
  onMapReady?: (map: ReturnType<typeof useYandexMap>) => void
  autoLocate?: boolean
}

export function Map({
  className = '',
  center,
  zoom,
  onMapClick,
  onUserLocationFound,
  onMapReady,
  autoLocate = false
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const map = useYandexMap(containerRef, {
    center,
    zoom,
    onMapClick,
    onUserLocationFound
  })

  useEffect(() => {
    if (map.isLoaded && onMapReady) {
      onMapReady(map)
    }
  }, [map.isLoaded, onMapReady])

  useEffect(() => {
    if (map.isLoaded && autoLocate) {
      map.getUserLocation()
    }
  }, [map.isLoaded, autoLocate])

  if (map.error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <p className="text-gray-500">Ошибка загрузки карты: {map.error}</p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
      {!map.isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
