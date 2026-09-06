import type { RadioEvent } from '../types'

export const radioTimeZone = 'America/Denver'
export const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Calendar dates are civil dates, not instants. UTC arithmetic prevents the
// visitor's timezone or daylight-saving changes from moving an occurrence.
export function parseDay(day: string) {
  return new Date(`${day}T12:00:00Z`)
}

export function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function mountainToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: radioTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const part = (name: string) => parts.find((item) => item.type === name)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function shiftDay(day: string, amount: number) {
  const date = parseDay(day)
  date.setUTCDate(date.getUTCDate() + amount)
  return dayKey(date)
}

export function shiftMonth(month: string, amount: number) {
  const date = parseDay(`${month}-01`)
  date.setUTCMonth(date.getUTCMonth() + amount)
  return dayKey(date).slice(0, 7)
}

export function calendarDays(month: string) {
  const first = `${month}-01`
  const start = shiftDay(first, -parseDay(first).getUTCDay())
  return Array.from({ length: 42 }, (_, index) => shiftDay(start, index))
}

export function eventOccursOn(event: RadioEvent, day: string) {
  if (day < event.start_date || (event.repeat_until && day > event.repeat_until) || event.skipped_dates.includes(day)) return false
  if (event.recurrence === 'once') return day === event.start_date
  const date = parseDay(day)
  if (date.getUTCDay() !== event.weekday) return false
  return event.recurrence === 'weekly' || event.month_weeks.includes(Math.ceil(date.getUTCDate() / 7))
}

export function eventsOnDay(events: RadioEvent[], day: string) {
  return events.filter((event) => eventOccursOn(event, day)).sort((left, right) => left.start_time.localeCompare(right.start_time) || left.title.localeCompare(right.title))
}

export function formatRadioDay(day: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) {
  return parseDay(day).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}

export function formatRadioTime(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return `${hour! % 12 || 12}:${String(minute).padStart(2, '0')} ${hour! < 12 ? 'AM' : 'PM'}`
}

export function recurrenceLabel(event: RadioEvent) {
  if (event.recurrence === 'once') return 'One-time event'
  if (event.recurrence === 'weekly') return `Every ${weekdays[event.weekday!]}`
  const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th']
  return `${event.month_weeks.map((week) => ordinals[week]).join(' & ')} ${weekdays[event.weekday!]} each month`
}

export function safeRadioLink(value: string) {
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? value : ''
  } catch { return '' }
}
