import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { RadioEvent, RadioInformation } from '../types'

export function useRadioContent() {
  const [events, setEvents] = useState<RadioEvent[]>([])
  const [information, setInformation] = useState<RadioInformation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setError('')
    if (!supabase) {
      setError('Radio information is temporarily unavailable.')
      setLoading(false)
      return
    }
    try {
      const [eventRows, infoRows] = await Promise.all([
        supabase.from('radio_events').select('*').order('start_date').order('start_time'),
        supabase.from('radio_information').select('*').order('sort_order').order('title'),
      ])
      if (eventRows.error || infoRows.error) throw new Error('Could not load radio content')
      setEvents(eventRows.data as RadioEvent[])
      setInformation(infoRows.data as RadioInformation[])
    } catch {
      setError('We could not load the radio calendar and information. Please try again.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])
  return { events, information, loading, error, refresh }
}
