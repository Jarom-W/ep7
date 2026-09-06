import { useState, type FormEvent } from 'react'
import { CalendarPlus, ExternalLink, Pencil, Save, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { RadioEvent, RadioInformation } from '../types'
import { supabase } from '../lib/supabase'
import { useRadioContent } from '../lib/useRadioContent'
import { dayKey, formatRadioDay, formatRadioTime, mountainToday, parseDay, recurrenceLabel, safeRadioLink, weekdays } from '../lib/radioCalendar'

export default function RadioAdmin() {
  const { events, information, loading, error, refresh } = useRadioContent()
  const [eventToEdit, setEventToEdit] = useState<RadioEvent | null>(null)
  const [infoToEdit, setInfoToEdit] = useState<RadioInformation | null>(null)
  const [eventVersion, setEventVersion] = useState(0)
  const [infoVersion, setInfoVersion] = useState(0)
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function remove(table: 'radio_events' | 'radio_information', item: RadioEvent | RadioInformation) {
    const scope = 'recurrence' in item && item.recurrence !== 'once' ? 'the whole recurring series' : 'this item'
    if (!supabase || !window.confirm(`Delete “${item.title}” (${scope})? This cannot be undone.`)) return
    setDeleting(true)
    setMessage('')
    try {
      const { error: deleteError } = await supabase.from(table).delete().eq('id', item.id)
      if (deleteError) throw deleteError
      if (eventToEdit?.id === item.id) setEventToEdit(null)
      if (infoToEdit?.id === item.id) setInfoToEdit(null)
      setMessage('Deleted successfully.')
      await refresh()
    } catch { setMessage('Could not delete this item. Please try again.') }
    finally { setDeleting(false) }
  }

  function editEvent(event: RadioEvent) {
    setEventToEdit(event)
    window.requestAnimationFrame(() => document.getElementById('radio-event-editor')?.scrollIntoView({ block: 'start' }))
  }

  function editInformation(item: RadioInformation) {
    setInfoToEdit(item)
    window.requestAnimationFrame(() => document.getElementById('radio-info-editor')?.scrollIntoView({ block: 'start' }))
  }

  return <div className="radio-admin">
    <div className="radio-admin-heading"><p>Publish events and update the information shown on the Stake Radio Communications page. All event times use Mountain Time.</p><Link to="/radio" className="button secondary">View radio page <ExternalLink size={16} /></Link></div>
    {error && <div className="form-error" role="alert">{error} <button onClick={() => void refresh()}>Try again</button></div>}
    {message && <p className="admin-message" role="status">{message}</p>}
    {loading ? <p role="status">Loading radio content…</p> : <>
      <div className="admin-grid">
        <RadioEventEditor key={`${eventToEdit?.id ?? 'new'}-${eventVersion}`} event={eventToEdit} onCancel={() => { setEventToEdit(null); setEventVersion((value) => value + 1) }} onSaved={async () => { setEventToEdit(null); setEventVersion((value) => value + 1); setMessage('Radio event saved.'); await refresh() }} />
        <div className="admin-list"><h2>Events & recurring nets</h2><p className="admin-help">Editing a recurring event updates the entire series. To change just one meeting, skip its date in the series and add a one-time event.</p>
          {events.map((event) => <article className="radio-admin-row" key={event.id}><div><h3>{event.title}</h3><p>{formatRadioDay(event.start_date, { month: 'short', day: 'numeric', year: 'numeric' })} · {formatRadioTime(event.start_time)}</p><p>{recurrenceLabel(event)}{event.repeat_until ? ` · through ${formatRadioDay(event.repeat_until, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}</p>{event.status !== 'scheduled' && <span className={`radio-status ${event.status}`}>{event.status === 'tentative' ? 'Proposed' : 'Cancelled'}</span>}</div><div className="radio-admin-row-actions"><button type="button" aria-label={`Edit ${event.title}`} onClick={() => editEvent(event)}><Pencil size={15} /> Edit</button><button type="button" disabled={deleting} aria-label={`Delete ${event.title}`} onClick={() => void remove('radio_events', event)}><Trash2 size={15} /> Delete</button></div></article>)}
          {!events.length && <div className="empty-state">No radio events yet. Add the first event here.</div>}
        </div>
      </div>
      <div className="admin-grid radio-info-admin">
        <RadioInformationEditor key={`${infoToEdit?.id ?? 'new'}-${infoVersion}`} item={infoToEdit} onCancel={() => { setInfoToEdit(null); setInfoVersion((value) => value + 1) }} onSaved={async () => { setInfoToEdit(null); setInfoVersion((value) => value + 1); setMessage('Radio information saved.'); await refresh() }} />
        <div className="admin-list"><h2>Page information & resource links</h2>{information.map((item) => <article className="radio-admin-row" key={item.id}><div><h3>{item.title}</h3><p className="radio-info-excerpt">{item.body}</p><small>Display order: {item.sort_order}</small></div><div className="radio-admin-row-actions"><button type="button" aria-label={`Edit ${item.title}`} onClick={() => editInformation(item)}><Pencil size={15} /> Edit</button><button type="button" disabled={deleting} aria-label={`Delete ${item.title}`} onClick={() => void remove('radio_information', item)}><Trash2 size={15} /> Delete</button></div></article>)}</div>
      </div>
    </>}
  </div>
}

function RadioEventEditor({ event, onCancel, onSaved }: { event: RadioEvent | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [recurrence, setRecurrence] = useState<RadioEvent['recurrence']>(event?.recurrence ?? 'once')
  const [startDate, setStartDate] = useState(event?.start_date ?? mountainToday())
  const [weeks, setWeeks] = useState<number[]>(event?.month_weeks.length ? event.month_weeks : [1])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    if (!supabase || busy) return
    const form = new FormData(submitEvent.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const startTime = String(form.get('start_time'))
    const endTime = String(form.get('end_time') || '')
    const repeatUntil = recurrence === 'once' ? null : String(form.get('repeat_until') || '') || null
    const skippedDates = recurrence === 'once' ? [] : [...new Set(String(form.get('skipped_dates') || '').split(/[\s,]+/).filter(Boolean))]
    setError('')
    if (!title) { setError('Please enter an event title.'); return }
    if (endTime && endTime <= startTime) { setError('The end time must be later than the start time on the same day.'); return }
    if (repeatUntil && repeatUntil < startDate) { setError('The repeat end date must be on or after the start date.'); return }
    if (recurrence === 'monthly' && !weeks.length) { setError('Choose at least one week of the month.'); return }
    if (skippedDates.some((day) => !/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(parseDay(day).getTime()) || dayKey(parseDay(day)) !== day)) { setError('Use valid YYYY-MM-DD dates, separated by commas, for skipped dates.'); return }
    const payload: Omit<RadioEvent, 'id'> = {
      title, description: String(form.get('description') || '').trim(), start_date: startDate,
      start_time: startTime, end_time: endTime || null, recurrence,
      weekday: recurrence === 'once' ? null : Number(form.get('weekday')),
      month_weeks: recurrence === 'monthly' ? [...weeks].sort() : [], repeat_until: repeatUntil, skipped_dates: skippedDates,
      frequency: String(form.get('frequency') || '').trim(), location: String(form.get('location') || '').trim(),
      status: String(form.get('status')) as RadioEvent['status'],
    }
    setBusy(true)
    try {
      const result = event ? await supabase.from('radio_events').update(payload).eq('id', event.id) : await supabase.from('radio_events').insert(payload)
      if (result.error) throw result.error
      await onSaved()
    } catch { setError('Could not save this event. Check your connection and specialist access, then try again.') }
    finally { setBusy(false) }
  }

  return <form className="admin-form radio-editor" id="radio-event-editor" onSubmit={save}>
    <h2><CalendarPlus /> {event ? 'Edit radio event' : 'Add radio event'}</h2>
    <fieldset disabled={busy}>
      <label><span>Event title</span><input name="title" required maxLength={160} defaultValue={event?.title} /></label>
      <label><span>Details</span><textarea name="description" rows={4} maxLength={4000} defaultValue={event?.description} /></label>
      <div className="form-row"><label><span>{recurrence === 'once' ? 'Event date' : 'Series starts on or after'}</span><input type="date" name="start_date" required value={startDate} onChange={(change) => setStartDate(change.target.value)} /></label><label><span>Status</span><select name="status" defaultValue={event?.status ?? 'scheduled'}><option value="scheduled">Scheduled</option><option value="tentative">Proposed / tentative</option><option value="cancelled">Cancelled</option></select></label></div>
      <div className="form-row"><label><span>Start time (Mountain)</span><input type="time" name="start_time" required defaultValue={event?.start_time.slice(0, 5) ?? '19:30'} /></label><label><span>End time (optional)</span><input type="time" name="end_time" defaultValue={event?.end_time?.slice(0, 5)} /></label></div>
      <label><span>Repeats</span><select value={recurrence} onChange={(change) => setRecurrence(change.target.value as RadioEvent['recurrence'])}><option value="once">Does not repeat</option><option value="weekly">Every week</option><option value="monthly">Selected weeks each month</option></select></label>
      {recurrence !== 'once' && <>
        <label><span>Day of the week</span><select name="weekday" defaultValue={event?.weekday ?? parseDay(startDate).getUTCDay()}>{weekdays.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></label>
        {recurrence === 'monthly' && <fieldset className="radio-week-picker"><legend>Weeks of the month</legend>{['1st', '2nd', '3rd', '4th', '5th'].map((week, index) => <label key={week}><input type="checkbox" checked={weeks.includes(index + 1)} onChange={(change) => setWeeks((current) => change.target.checked ? [...current, index + 1] : current.filter((value) => value !== index + 1))} /><span>{week}</span></label>)}</fieldset>}
        <label><span>Repeat through (optional)</span><input type="date" name="repeat_until" min={startDate} defaultValue={event?.repeat_until ?? ''} /><small>Leave blank to continue each month.</small></label>
        <label><span>Skip these dates (optional)</span><input name="skipped_dates" defaultValue={event?.skipped_dates.join(', ')} placeholder="2026-12-27, 2027-01-10" /><small>Use YYYY-MM-DD, separated by commas.</small></label>
      </>}
      <label><span>Location</span><input name="location" maxLength={300} defaultValue={event?.location} placeholder="On the radio, or a building and address" /></label>
      <label><span>Frequency & radio settings</span><input name="frequency" maxLength={200} defaultValue={event?.frequency} placeholder="146.640 MHz · simplex" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><button className="button primary" disabled={busy}><Save size={17} />{busy ? 'Saving…' : 'Save event'}</button><button type="button" className="button secondary" onClick={onCancel}>{event ? 'Cancel edit' : 'Clear form'}</button></div>
    </fieldset>
  </form>
}

function RadioInformationEditor({ item, onCancel, onSaved }: { item: RadioInformation | null; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    const form = new FormData(event.currentTarget)
    const payload: Omit<RadioInformation, 'id'> = {
      title: String(form.get('title') || '').trim(), body: String(form.get('body') || '').trim(),
      link_url: String(form.get('link_url') || '').trim(), link_label: String(form.get('link_label') || '').trim(),
      sort_order: Number(form.get('sort_order')),
    }
    setError('')
    if (!payload.title || !payload.body) { setError('Please enter a title and information.'); return }
    if (payload.link_url && !safeRadioLink(payload.link_url)) { setError('Use an https://, http://, or mailto: link.'); return }
    setBusy(true)
    try {
      const result = item ? await supabase.from('radio_information').update(payload).eq('id', item.id) : await supabase.from('radio_information').insert(payload)
      if (result.error) throw result.error
      await onSaved()
    } catch { setError('Could not save this information. Check your connection and specialist access, then try again.') }
    finally { setBusy(false) }
  }
  return <form className="admin-form radio-editor" id="radio-info-editor" onSubmit={save}>
    <h2><Pencil />{item ? 'Edit page information' : 'Add page information'}</h2>
    <fieldset disabled={busy}>
      <label><span>Title</span><input required name="title" maxLength={160} defaultValue={item?.title} /></label>
      <label><span>Information</span><textarea required name="body" rows={7} maxLength={6000} defaultValue={item?.body} /></label>
      <label><span>Resource link (optional)</span><input name="link_url" defaultValue={item?.link_url} placeholder="https://… or mailto:…" /></label>
      <label><span>Link text</span><input name="link_label" maxLength={120} defaultValue={item?.link_label} placeholder="Learn more" /></label>
      <label><span>Display order</span><input type="number" name="sort_order" required step="1" min="-100000" max="100000" defaultValue={item?.sort_order ?? 10} /><small>Smaller numbers appear first.</small></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><button className="button primary" disabled={busy}><Save size={17} />{busy ? 'Saving…' : 'Save information'}</button><button type="button" className="button secondary" onClick={onCancel}>{item ? 'Cancel edit' : 'Clear form'}</button></div>
    </fieldset>
  </form>
}
