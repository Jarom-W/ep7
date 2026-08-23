import { useCallback, useEffect, useState } from 'react'
import { Activity, ArrowRight, BookOpen, Boxes, CheckCircle2, Clock3, Cloud, Droplets, Flame, Gauge, LockKeyhole, RefreshCw, Sparkles, Users, Utensils, Waves } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type BlockStat = { block_id: string; households: number | null; score: number | null }
type WardStats = {
  households: number
  people: number | null
  privacy_threshold_met: boolean
  readiness_score: number | null
  average_food_days: number | null
  average_water_days: number | null
  stored_water_gallons: number | null
  stored_calories: number | null
  ready_recipes: number | null
  updated_this_week: number | null
  water_3_pct: number | null
  water_7_pct: number | null
  water_14_pct: number | null
  food_3_pct: number | null
  food_7_pct: number | null
  food_14_pct: number | null
  blocks: BlockStat[]
}

const emptyStats: WardStats = { households: 0, people: null, privacy_threshold_met: false, readiness_score: null, average_food_days: null, average_water_days: null, stored_water_gallons: null, stored_calories: null, ready_recipes: null, updated_this_week: null, water_3_pct: null, water_7_pct: null, water_14_pct: null, food_3_pct: null, food_7_pct: null, food_14_pct: null, blocks: 'ABCDEFGHIJKLMNOPQR'.split('').map((block_id) => ({ block_id, households: null, score: null })) }

export default function Home() {
  const { session } = useAuth()
  const [stats, setStats] = useState<WardStats>(emptyStats)
  const [loading, setLoading] = useState(true)
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null)
  const [queryError, setQueryError] = useState(false)

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase.rpc('ward_progress_stats')
    if (data) setStats(data as WardStats)
    setQueryError(Boolean(error))
    setRefreshedAt(new Date())
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(refresh, 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const score = stats.readiness_score ?? 0
  const targetPeople = Math.max(stats.people ?? 0, 1)
  const caloriesPerPerson = stats.stored_calories ? Math.round(stats.stored_calories / targetPeople) : 0

  return <div className="ward-dashboard">
    <section className="dashboard-masthead">
      <div className="page-width dashboard-titlebar">
        <div><span className="dashboard-kicker">Anonymous ward overview</span><h1>Ward preparedness dashboard</h1><p>See privacy-protected progress across participating households, then return to your own plan for the details only your family can access.</p></div>
        <div className="dashboard-commands">
          <button onClick={refresh} disabled={loading}><RefreshCw className={loading ? 'spin' : ''} /> Refresh</button>
          <Link to="/planner">{session ? 'Update my plan' : 'Add my household'} <ArrowRight /></Link>
          <small>{refreshedAt ? `Updated ${refreshedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Connecting to ward data…'}</small>
        </div>
      </div>
      <div className="page-width dashboard-ticker">
        <span><Cloud /> Anonymous totals only</span><span><Users /> <b>{stats.households}</b> participating {stats.households === 1 ? 'household' : 'households'}</span><span><Activity /> <b>{value(stats.updated_this_week)}</b> plans updated this week</span><span><LockKeyhole /> Individual plans stay private</span>
      </div>
    </section>

    {!isSupabaseConfigured && <div className="page-width dashboard-notice"><Cloud /><p><b>Dashboard preview:</b> connect Supabase to activate live ward progress.</p></div>}
    {queryError && <div className="page-width dashboard-notice"><Cloud /><p><b>Dashboard data is not available yet.</b> Run the family accounts and progress migration in Supabase, then refresh.</p></div>}
    {!stats.privacy_threshold_met && isSupabaseConfigured && <div className="page-width threshold-notice"><LockKeyhole /><div><b>The privacy shield is working.</b><p>{Math.max(0, 3 - stats.households)} more participating {Math.max(0, 3 - stats.households) === 1 ? 'family' : 'families'} needed before preparedness totals appear. We never display statistics that could reveal one household’s plan.</p></div><Link to="/account?mode=signup">Join privately <ArrowRight /></Link></div>}

    <section className="page-width dashboard-get-started">
      <div><span className="eyebrow">How to get started</span><h2>Three steps, then improve at your own pace.</h2></div>
      <ol><li><span>1</span><div><b>Create or sign in to your household account.</b><p>Your private plan and map access follow you across devices.</p></div></li><li><span>2</span><div><b>Add water, supplies, and meals you actually use.</b><p>Custom items and family recipes are welcome.</p></div></li><li><span>3</span><div><b>Choose a few wishlist meals.</b><p>The planner calculates the combined supplies still needed.</p></div></li></ol>
      <Link className="button primary" to={session ? '/planner' : '/account?mode=signup'}>{session ? 'Continue my plan' : 'Create my plan'} <ArrowRight /></Link>
    </section>

    <section className="page-width command-grid">
      <article className="readiness-dial-card dashboard-card">
        <div className="card-label"><Gauge /> Ward readiness index <span>14-day target</span></div>
        <div className="readiness-dial">
          <svg viewBox="0 0 220 220" role="img" aria-label={`Ward readiness score ${score} out of 100`}>
            <circle className="dial-track" cx="110" cy="110" r="88" />
            <circle className="dial-progress" cx="110" cy="110" r="88" pathLength="100" strokeDasharray={`${score} 100`} />
            <circle className="dial-core" cx="110" cy="110" r="68" />
          </svg>
          <div><strong>{stats.readiness_score ?? '—'}</strong><span>out of 100</span></div>
        </div>
        <p>{stats.privacy_threshold_met ? readinessMessage(score) : 'Aggregate score unlocks at three participating households.'}</p>
        <div className="score-legend"><span><i className="starting" /> Starting</span><span><i className="building" /> Building</span><span><i className="ready" /> Ready</span></div>
      </article>

      <article className="resource-deck dashboard-card">
        <div className="card-label"><Waves /> Resource runway <span>Ward average</span></div>
        <div className="runway-grid">
          <ResourceGauge icon={<Droplets />} label="Water" days={stats.average_water_days} color="blue" />
          <ResourceGauge icon={<Flame />} label="Food energy" days={stats.average_food_days} color="orange" />
        </div>
        <div className="resource-totals">
          <div><Droplets /><span><b>{formatNumber(stats.stored_water_gallons)}</b><small>gallons stored</small></span></div>
          <div><Boxes /><span><b>{formatCompact(stats.stored_calories)}</b><small>tracked calories</small></span></div>
          <div><Utensils /><span><b>{formatNumber(stats.ready_recipes)}</b><small>meal types ready</small></span></div>
        </div>
      </article>

      <article className="participation-card dashboard-card">
        <div className="card-label"><Users /> Preparedness network <span>Growing together</span></div>
        <div className="people-number"><strong>{stats.people ?? '—'}</strong><span>people represented</span></div>
        <div className="people-field" aria-hidden="true">{Array.from({ length: 36 }, (_, index) => <i key={index} className={stats.people && index < Math.min(36, stats.people) ? 'lit' : ''} style={{ animationDelay: `${index * 30}ms` }} />)}</div>
        <div className="participation-foot"><span><Activity /> {value(stats.updated_this_week)} active this week</span><Link to={session ? '/planner' : '/account?mode=signup'}>{session ? 'Check in' : 'Join the effort'} <ArrowRight /></Link></div>
      </article>
    </section>

    <section className="page-width dashboard-row">
      <article className="milestone-card dashboard-card">
        <div className="card-label"><CheckCircle2 /> Household milestones <span>Percentage of participating families</span></div>
        <div className="milestone-head"><span>Resource</span><span>3 days</span><span>7 days</span><span>14 days</span></div>
        <MilestoneRow label="Water" icon={<Droplets />} values={[stats.water_3_pct, stats.water_7_pct, stats.water_14_pct]} tone="water" />
        <MilestoneRow label="Food" icon={<Utensils />} values={[stats.food_3_pct, stats.food_7_pct, stats.food_14_pct]} tone="food" />
        <div className="milestone-callout"><Sparkles /><p><b>Next collective win</b><span>{nextMilestone(stats)}</span></p></div>
      </article>

      <article className="block-pulse-card dashboard-card">
        <div className="card-label"><Activity /> Block pulse <span>Shown only with 3+ families per block</span></div>
        <div className="block-pulse-grid">{stats.blocks.map((block) => <Link to={`/block-map?block=${block.block_id}`} key={block.block_id} className={block.score === null ? 'private' : block.score >= 70 ? 'strong' : block.score >= 40 ? 'building' : 'starting'}><b>{block.block_id}</b><span>{block.score === null ? <LockKeyhole /> : `${block.score}%`}</span><i style={{ height: `${block.score ?? 8}%` }} /></Link>)}</div>
        <div className="pulse-legend"><span><i /> Starting</span><span><i /> Building</span><span><i /> Strong</span><span><LockKeyhole /> Protected</span></div>
      </article>
    </section>

    <section className="page-width insight-strip">
      <div><span className="eyebrow">The signal behind the numbers</span><h2>Every jar, gallon, and conversation makes the whole neighborhood steadier.</h2></div>
      <div className="insight-stat"><strong>{caloriesPerPerson ? formatCompact(caloriesPerPerson) : '—'}</strong><span>tracked calories per represented person</span></div>
      <Link className="button primary" to="/planner">Strengthen my plan <ArrowRight /></Link>
    </section>

    <section className="page-width dashboard-shortcuts">
      <Link to="/recipes"><BookOpen /><span><b>Turn supplies into meals</b><small>See recipes your pantry can make</small></span><ArrowRight /></Link>
      <Link to="/block-map"><Users /><span><b>Know your block</b><small>Find your captain and nearby households</small></span><ArrowRight /></Link>
      <Link to="/library"><Clock3 /><span><b>Read the current plan</b><small>Know what happens before it happens</small></span><ArrowRight /></Link>
    </section>
  </div>
}

function ResourceGauge({ icon, label, days, color }: { icon: React.ReactNode; label: string; days: number | null; color: string }) {
  const percent = Math.min(100, ((days ?? 0) / 14) * 100)
  return <div className={`resource-gauge ${color}`}><div className="tank"><div className="tank-fill" style={{ height: `${percent}%` }}><i /><i /></div><strong>{days === null ? '—' : days.toFixed(1)}<small> days</small></strong></div><span>{icon}{label}</span></div>
}

function MilestoneRow({ label, icon, values, tone }: { label: string; icon: React.ReactNode; values: Array<number | null>; tone: string }) {
  return <div className={`milestone-row ${tone}`}><b>{icon}{label}</b>{values.map((amount, index) => <div key={index}><span style={{ '--amount': `${amount ?? 0}%` } as React.CSSProperties} /><strong>{amount === null ? '—' : `${amount}%`}</strong></div>)}</div>
}

function value(valueToFormat: number | null) { return valueToFormat === null ? '—' : valueToFormat.toLocaleString() }
function formatNumber(valueToFormat: number | null) { return valueToFormat === null ? '—' : Math.round(valueToFormat).toLocaleString() }
function formatCompact(valueToFormat: number | null) { return valueToFormat === null ? '—' : new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(valueToFormat) }
function readinessMessage(score: number) { return score >= 80 ? 'Strong foundations. Keep supplies rotated and help a neighbor begin.' : score >= 55 ? 'Momentum is building. The next few household check-ins can move us quickly.' : 'Every plan starts somewhere. Water and three familiar meals are the fastest first wins.' }
function nextMilestone(stats: WardStats) {
  if (!stats.privacy_threshold_met) return 'Invite two other families to begin—the shared measures will then unlock.'
  const candidates = [
    { label: 'families reaching three days of water', value: stats.water_3_pct ?? 0 },
    { label: 'families reaching three days of food', value: stats.food_3_pct ?? 0 },
    { label: 'families reaching seven days of water', value: stats.water_7_pct ?? 0 },
    { label: 'families reaching seven days of food', value: stats.food_7_pct ?? 0 },
  ].sort((a, b) => b.value - a.value)
  return `${candidates[0]?.value ?? 0}% of participating ${candidates[0]?.label ?? 'families have checked in'}. Let’s reach the next ten.`
}
