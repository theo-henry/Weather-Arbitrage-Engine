"use client"

import { useEffect, useState } from 'react'
import { Check, ChevronsUpDown, Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CITIES } from '@/lib/types'
import { cn } from '@/lib/utils'

interface CitySearchProps {
  value: string
  onChange: (city: string) => void
  className?: string
}

interface GeocodeResult {
  name: string
  displayName: string
  lat: number
  lng: number
}

export function CitySearch({ value, onChange, className }: CitySearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setLoading(false)
  }, [open])

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (!open || !trimmedQuery) {
      setResults([])
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)

      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Geocoding failed')

        const data = (await response.json()) as { results?: GeocodeResult[] }
        setResults(data.results ?? [])
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setResults([])
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, 300)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [open, query])

  const selectCity = (city: string) => {
    onChange(city.trim())
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          <span className="truncate">{value || 'Select a city'}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search any city..."
          />
          <CommandList>
            {!query.trim() ? (
              <CommandGroup heading="Quick picks">
                {CITIES.map((city) => (
                  <CommandItem key={city} value={city} onSelect={() => selectCity(city)}>
                    <MapPin className="h-4 w-4" />
                    <span>{city}</span>
                    <Check className={cn('ml-auto h-4 w-4', value === city ? 'opacity-100' : 'opacity-0')} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <>
                {loading && (
                  <div className="flex items-center gap-2 px-3 py-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading cities...
                  </div>
                )}

                {!loading && results.length === 0 && (
                  <CommandEmpty>No cities found.</CommandEmpty>
                )}

                {results.length > 0 && (
                  <CommandGroup heading="Cities">
                    {results.map((result) => (
                      <CommandItem
                        key={`${result.displayName}-${result.lat}-${result.lng}`}
                        value={result.displayName}
                        onSelect={() => selectCity(result.name)}
                      >
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{result.displayName}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
