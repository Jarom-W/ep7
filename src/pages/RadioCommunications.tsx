import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ExternalLink, MapPin, Pencil, Radio, Repeat2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import WalkieTalkieIcon from '../components/WalkieTalkieIcon'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { useRadioContent } from '../lib/useRadioContent'
import { calendarDays, eventsOnDay, formatRadioDay, formatRadioTime, mountainToday, recurrenceLabel, safeRadioLink, shiftMonth, weekdays } from '../lib/radioCalendar'

export default function RadioCommunications() {
  const { session } = useAuth()
  const { events, information, loading, error, refresh } = useRadioContent()
  const [adminUserId, setAdminUserId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(() => mountainToday())
  const [month, setMonth] = useState(() => mountainToday().slice(0, 7))
  const today = mountainToday()
  const days = useMemo(() => calendarDays(month), [month])
  const dayEvents = useMemo(() => new Map(days.map((day) => [day, eventsOnDay(events, day)])), [days, events])
  const selectedEvents = eventsOnDay(events, selectedDay)

  useEffect(() => {
    if (!session || !supabase) return
    let cancelled = false
    supabase.rpc('is_admin').then(({ data, error: roleError }) => {
      if (!cancelled) setAdminUserId(!roleError && data === true ? session.user.id : null)
    })
    return () => { cancelled = true }
  }, [session])

  function changeMonth(amount: number) {
    const next = shiftMonth(month, amount)
    setMonth(next)
    setSelectedDay(next === today.slice(0, 7) ? today : `${next}-01`)
  }

  return <div className="page-width interior-page radio-page">
    <div className="radio-heading">
      <div className="page-heading"><span className="eyebrow">Spanish Fork Stake</span><h1>Radio communications</h1><p>Stay connected, practice with your equipment, and find the next net, gathering, or emergency drill.</p></div>
      <div className="radio-heading-icon"><WalkieTalkieIcon /></div>
    </div>
    {session && adminUserId === session.user.id && <Link className="button secondary radio-manage-link" to="/specialist?tab=radio"><Pencil size={17} /> Manage radio events & information</Link>}
    {error && <div className="form-error" role="alert">{error} <button className="text-button" onClick={() => void refresh()}>Try again</button></div>}
    {loading ? <div className="empty-state" role="status">Loading radio calendar…</div> : !error && <>
      <section className="radio-calendar-section" aria-labelledby="radio-calendar-heading">
        <div className="section-heading inline"><div><span className="eyebrow">Tune in & take part</span><h2 id="radio-calendar-heading">Communications calendar</h2><p>All times are Mountain Time (Spanish Fork). Select a day for the full details.</p></div><CalendarDays size={30} /></div>
        <div className="radio-calendar-layout">
          <div className="radio-calendar">
            <div className="radio-calendar-toolbar">
              <h3 aria-live="polite">{formatRadioDay(`${month}-01`, { month: 'long', year: 'numeric' })}</h3>
              <div><button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft /></button><button type="button" onClick={() => { setMonth(today.slice(0, 7)); setSelectedDay(today) }}>Today</button><button type="button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight /></button></div>
            </div>
            <table className="radio-month-grid" aria-label={formatRadioDay(`${month}-01`, { month: 'long', year: 'numeric' })}>
              <thead><tr>{weekdays.map((day) => <th scope="col" key={day}><abbr title={day}>{day.slice(0, 3)}</abbr></th>)}</tr></thead>
              <tbody>{Array.from({ length: 6 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map((day) => {
                const entries = dayEvents.get(day) ?? []
                return <td key={day}><button type="button" className={`radio-day${day.slice(0, 7) !== month ? ' outside-month' : ''}${day === selectedDay ? ' selected' : ''}${day === today ? ' today' : ''}`} aria-label={`${formatRadioDay(day)}: ${entries.length} ${entries.length === 1 ? 'event' : 'events'}`} aria-pressed={day === selectedDay} aria-current={day === today ? 'date' : undefined} onClick={() => { setSelectedDay(day); if (day.slice(0, 7) !== month) setMonth(day.slice(0, 7)) }}>
                  <span className="radio-day-number">{Number(day.slice(-2))}</span>
                  <span className="radio-day-events" aria-hidden="true">{entries.slice(0, 2).map((event) => <span key={event.id} className={event.status}>{event.title}</span>)}{entries.length > 2 && <small>+{entries.length - 2} more</small>}</span>
                  {entries.length > 0 && <span className="radio-day-count" aria-hidden="true">{entries.length}</span>}
                </button></td>
              })}</tr>)}</tbody>
            </table>
          </div>
          <aside className="radio-agenda" aria-live="polite" aria-atomic="true">
            <span className="eyebrow">Selected day</span><h3>{formatRadioDay(selectedDay, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
            {selectedEvents.length ? selectedEvents.map((event) => <article className={`radio-event ${event.status}`} key={event.id}>
              <div className="radio-event-time"><Clock3 size={15} /><time>{formatRadioTime(event.start_time)}{event.end_time ? ` – ${formatRadioTime(event.end_time)}` : ''}</time></div>
              <h4>{event.title}</h4>
              {event.status !== 'scheduled' && <span className={`radio-status ${event.status}`}>{event.status === 'tentative' ? 'Proposed · awaiting confirmation' : 'Cancelled'}</span>}
              {event.frequency && <p className="radio-event-detail"><Radio size={16} /><strong>{event.frequency}</strong></p>}
              {event.location && <p className="radio-event-detail"><MapPin size={16} />{event.location}</p>}
              {event.description && <p className="radio-event-description">{event.description}</p>}
              {event.recurrence !== 'once' && <p className="radio-event-detail"><Repeat2 size={15} />{recurrenceLabel(event)}</p>}
            </article>) : <p className="radio-no-events">No events scheduled for this day. Select another day or browse ahead.</p>}
          </aside>
        </div>
      </section>
      <section className="radio-information" aria-labelledby="radio-info-heading"><div className="section-heading"><span className="eyebrow">Stay informed</span><h2 id="radio-info-heading">Stake updates & radio resources</h2></div>
        {information.length ? <div className="radio-info-grid">{information.map((item) => <article key={item.id}><h3>{item.title}</h3><p>{item.body}</p>{safeRadioLink(item.link_url) && <a href={safeRadioLink(item.link_url)} target={item.link_url.startsWith('mailto:') ? undefined : '_blank'} rel="noreferrer">{item.link_label || 'Learn more'}<ExternalLink size={15} /></a>}</article>)}</div> : <p>Updates from the specialist will appear here.</p>}
      </section>
    </>}
  </div>
}
