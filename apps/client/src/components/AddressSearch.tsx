'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Navigation, Search, X, Clock, Home, Briefcase } from 'lucide-react'
import { geocode, type GeocoderResult } from '@/lib/yandex-maps'
import { useDebounce } from '@/hooks/useDebounce'

interface SavedAddress {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  type?: 'home' | 'work' | 'other'
}

interface AddressSearchProps {
  placeholder?: string
  value?: string
  icon?: 'from' | 'to'
  savedAddresses?: SavedAddress[]
  recentAddresses?: string[]
  onSelect: (result: GeocoderResult) => void
  onCurrentLocation?: () => void
  onFocus?: () => void
  onBlur?: () => void
  autoFocus?: boolean
}

export function AddressSearch({
  placeholder = 'Куда едем?',
  value = '',
  icon = 'to',
  savedAddresses = [],
  recentAddresses = [],
  onSelect,
  onCurrentLocation,
  onFocus,
  onBlur,
  autoFocus = false
}: AddressSearchProps) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<GeocoderResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setResults([])
      return
    }

    const searchAddresses = async () => {
      setIsLoading(true)
      try {
        const searchResults = await geocode(debouncedQuery)
        setResults(searchResults)
      } catch (err) {
        console.error('Geocode error:', err)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    searchAddresses()
  }, [debouncedQuery])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false)
        onBlur?.()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onBlur])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    onFocus?.()
  }, [onFocus])

  const handleSelect = useCallback((result: GeocoderResult) => {
    setQuery(result.shortAddress)
    setResults([])
    setIsFocused(false)
    onSelect(result)
  }, [onSelect])

  const handleClear = useCallback(() => {
    setQuery('')
    setResults([])
    inputRef.current?.focus()
  }, [])

  const getIcon = () => {
    if (icon === 'from') {
      return <Navigation className="w-5 h-5 text-primary-500" />
    }
    return <MapPin className="w-5 h-5 text-red-500" />
  }

  const getSavedIcon = (type?: 'home' | 'work' | 'other') => {
    switch (type) {
      case 'home':
        return <Home className="w-4 h-4 text-gray-400" />
      case 'work':
        return <Briefcase className="w-4 h-4 text-gray-400" />
      default:
        return <MapPin className="w-4 h-4 text-gray-400" />
    }
  }

  const getAddressType = (name: string): 'home' | 'work' | 'other' => {
    const lower = name.toLowerCase()
    if (lower.includes('дом') || lower.includes('home')) return 'home'
    if (lower.includes('работа') || lower.includes('офис') || lower.includes('work')) return 'work'
    return 'other'
  }

  const showDropdown = isFocused && (
    results.length > 0 ||
    savedAddresses.length > 0 ||
    recentAddresses.length > 0 ||
    onCurrentLocation
  )

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2">
          {getIcon()}
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-12 pr-10 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {isLoading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 max-h-80 overflow-y-auto z-50">
          {onCurrentLocation && query.length === 0 && (
            <button
              onClick={() => {
                onCurrentLocation()
                setIsFocused(false)
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
            >
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <Navigation className="w-5 h-5 text-primary-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Моё местоположение</p>
                <p className="text-sm text-gray-500">Определить автоматически</p>
              </div>
            </button>
          )}

          {query.length === 0 && savedAddresses.length > 0 && (
            <div className="border-b border-gray-100">
              <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Сохранённые адреса</p>
              {savedAddresses.map((addr) => (
                <button
                  key={addr.id}
                  onClick={() => handleSelect({
                    address: addr.address,
                    shortAddress: addr.name,
                    coordinates: [addr.lat, addr.lng]
                  })}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                    {getSavedIcon(addr.type || getAddressType(addr.name))}
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-gray-900">{addr.name}</p>
                    <p className="text-sm text-gray-500 truncate">{addr.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {query.length === 0 && recentAddresses.length > 0 && (
            <div>
              <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Недавние</p>
              {recentAddresses.slice(0, 3).map((addr, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect({
                    address: addr,
                    shortAddress: addr,
                    coordinates: [0, 0]
                  })}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <Clock className="w-5 h-5 text-gray-400" />
                  <p className="text-gray-700 truncate text-left">{addr}</p>
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <div>
              {query.length > 0 && (
                <p className="px-4 py-2 text-xs font-medium text-gray-400 uppercase">Результаты поиска</p>
              )}
              {results.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleSelect(result)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Search className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-medium text-gray-900 truncate">{result.shortAddress}</p>
                    <p className="text-sm text-gray-500 truncate">{result.address}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
