import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarDays, eventOccursOn, eventsOnDay, mountainToday, shiftMonth, formatRadioTime, safeRadioLink } from '../src/lib/radioCalendar.ts'

const stakeNet = {
  id: 'stake', title: 'Stake Net', description: '', start_date: '2026-08-23', start_time: '19:30:00', end_time: null,
  recurrence: 'monthly', weekday: 0, month_weeks: [2, 4], repeat_until: null, skipped_dates: [],
  location: 'On the radio', frequency: '146.640 MHz · simplex', status: 'scheduled',
}

test('stake net follows the second and fourth Sundays, including five-Sunday months', () => {
  const september = calendarDays('2026-09').filter((day) => day.startsWith('2026-09') && eventOccursOn(stakeNet, day))
  assert.deepEqual(september, ['2026-09-13', '2026-09-27'])
  const november = calendarDays('2026-11').filter((day) => day.startsWith('2026-11') && eventOccursOn(stakeNet, day))
  assert.deepEqual(november, ['2026-11-08', '2026-11-22'])
  assert.equal(eventOccursOn(stakeNet, '2026-08-09'), false)
  assert.equal(eventOccursOn(stakeNet, '2026-08-23'), true)
})

test('Mapleton uses simplex on the first Sunday and repeater on every other Sunday', () => {
  const simplex = { ...stakeNet, month_weeks: [1] }
  const repeater = { ...stakeNet, month_weeks: [2, 3, 4, 5] }
  for (const day of ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29']) {
    assert.equal(eventOccursOn(simplex, day), day === '2026-11-01')
    assert.equal(eventOccursOn(repeater, day), day !== '2026-11-01')
  }
  assert.equal(eventOccursOn(repeater, '2026-11-02'), false)
})

test('weekly nets, inclusive end dates, and skipped occurrences', () => {
  const ladies = { ...stakeNet, recurrence: 'weekly', weekday: 2, repeat_until: '2026-09-15', skipped_dates: ['2026-09-08'] }
  assert.equal(eventOccursOn(ladies, '2026-09-01'), true)
  assert.equal(eventOccursOn(ladies, '2026-09-08'), false)
  assert.equal(eventOccursOn(ladies, '2026-09-15'), true)
  assert.equal(eventOccursOn(ladies, '2026-09-22'), false)
})

test('one-time events and proposed/cancelled status remain visible on their actual date', () => {
  const drill = { ...stakeNet, id: 'drill', title: 'Drill', start_date: '2026-09-24', start_time: '18:00', end_time: '20:30', recurrence: 'once', status: 'tentative' }
  assert.deepEqual(eventsOnDay([drill, stakeNet], '2026-09-24'), [drill])
  assert.equal(eventOccursOn(drill, '2026-10-24'), false)
  assert.equal(eventOccursOn({ ...drill, status: 'cancelled' }, '2026-09-24'), true)
  const meet = { ...drill, id: 'meet', start_date: '2026-08-23', start_time: '15:45' }
  assert.deepEqual(eventsOnDay([stakeNet, meet], '2026-08-23').map((event) => event.id), ['meet', 'stake'])
})

test('calendar navigation crosses years, leap days, and daylight-saving boundaries', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01')
  assert.equal(shiftMonth('2027-01', -1), '2026-12')
  assert.equal(calendarDays('2028-02').length, 42)
  assert.ok(calendarDays('2028-02').includes('2028-02-29'))
  assert.equal(eventOccursOn({ ...stakeNet, start_date: '2026-01-01' }, '2026-03-08'), true)
  assert.equal(mountainToday(new Date('2026-09-07T02:00:00Z')), '2026-09-06')
  assert.equal(mountainToday(new Date('2026-11-01T06:30:00Z')), '2026-11-01')
  assert.equal(formatRadioTime('19:30:00'), '7:30 PM')
  assert.equal(formatRadioTime('00:00:00'), '12:00 AM')
})

test('resource links permit web/email URLs and reject executable schemes', () => {
  assert.equal(safeRadioLink('https://www.ucares.org/'), 'https://www.ucares.org/')
  assert.equal(safeRadioLink('mailto:allencarter1@gmail.com'), 'mailto:allencarter1@gmail.com')
  assert.equal(safeRadioLink('javascript:alert(1)'), '')
  assert.equal(safeRadioLink('data:text/html,hello'), '')
  assert.equal(safeRadioLink('not a URL'), '')
})
