import { FormEvent, useEffect, useState } from 'react'
import { Bug, FileUp, KeyRound, Link2, Loader2, LogIn, LogOut, MapPin, Newspaper, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { BlockCaptain, BlockHousehold, DocumentRecord, FamilyProfile } from '../types'
import { blockDetails } from '../data/blockDetails'

type FeedbackRecord = { id: string; type: string; name: string | null; email: string | null; subject: string; message: string; status: string; created_at: string }
type MinisteringGrant = { id: string; grantee_user_id: string; target_household_id: string; can_write: boolean }

export default function Specialist() {
  const [session, setSession] = useState<Session | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<'documents' | 'map' | 'access' | 'feedback'>('documents')
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [captains, setCaptains] = useState<BlockCaptain[]>([])
  const [households, setHouseholds] = useState<BlockHousehold[]>([])
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([])
  const [profiles, setProfiles] = useState<FamilyProfile[]>([])
  const [grants, setGrants] = useState<MinisteringGrant[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) { setAuthorized(false); setChecking(false); return }
    setChecking(true)
    supabase.rpc('is_admin').then(({ data }) => { setAuthorized(Boolean(data)); setChecking(false) })
  }, [session])

  async function loadAdminData() {
    if (!supabase) return
    const [docs, captainRows, householdRows, feedbackRows, profileRows, grantRows] = await Promise.all([
      supabase.from('documents').select('*').order('published_at', { ascending: false }),
      supabase.from('block_captains').select('*').order('block_id'),
      supabase.from('block_households').select('*').order('block_id'),
      supabase.from('feedback').select('*').order('created_at', { ascending: false }),
      supabase.from('family_profiles').select('*').order('household_name'),
      supabase.from('ministering_access').select('*').order('created_at', { ascending: false }),
    ])
    setDocuments((docs.data as DocumentRecord[]) ?? [])
    setCaptains((captainRows.data as BlockCaptain[]) ?? [])
    setHouseholds((householdRows.data as BlockHousehold[]) ?? [])
    setFeedback((feedbackRows.data as FeedbackRecord[]) ?? [])
    setProfiles((profileRows.data as FamilyProfile[]) ?? [])
    setGrants((grantRows.data as MinisteringGrant[]) ?? [])
  }

  useEffect(() => { if (authorized) void loadAdminData() }, [authorized])

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    const { error } = await supabase.auth.signInWithPassword({ email: String(form.get('email')), password: String(form.get('password')) })
    setMessage(error?.message ?? '')
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setMessage('Uploading…')
    const form = new FormData(event.currentTarget)
    const file = form.get('file') as File
    const kind = String(form.get('kind')) as 'newsletter' | 'plan'
    if (!file || file.type !== 'application/pdf') { setMessage('Please choose a PDF file.'); return }
    const path = `${kind}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`
    const { error: uploadError } = await supabase.storage.from('preparedness-documents').upload(path, file, { contentType: 'application/pdf' })
    if (uploadError) { setMessage(uploadError.message); return }
    if (kind === 'plan') await supabase.from('documents').delete().eq('kind', 'plan')
    const { error } = await supabase.from('documents').insert({ title: String(form.get('title')), description: String(form.get('description') || ''), kind, file_path: path, published_at: String(form.get('published_at')) || new Date().toISOString() })
    setMessage(error?.message ?? 'Published successfully.')
    if (!error) { event.currentTarget.reset(); await loadAdminData() }
  }

  async function addMapRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    const recordType = String(form.get('record_type'))
    const payload = { block_id: String(form.get('block_id')).toUpperCase(), name: String(form.get('name')), address: String(form.get('address') || '') || null, is_public: form.get('is_public') === 'on' }
    const result = recordType === 'captain'
      ? await supabase.from('block_captains').insert({ ...payload, phone: String(form.get('phone') || '') || null, building_id: String(form.get('building_id') || '').toUpperCase() || null })
      : await supabase.from('block_households').insert({ block_id: payload.block_id, display_name: payload.name, address: payload.address, building_id: String(form.get('building_id') || '').toUpperCase() || null, is_public: payload.is_public })
    setMessage(result.error?.message ?? 'Map record saved.')
    if (!result.error) { event.currentTarget.reset(); await loadAdminData() }
  }

  async function remove(table: 'documents' | 'block_captains' | 'block_households', id: string) {
    if (!supabase || !window.confirm('Remove this record?')) return
    await supabase.from(table).delete().eq('id', id)
    await loadAdminData()
  }

  async function editMapRecord(table: 'block_captains' | 'block_households', item: BlockCaptain | BlockHousehold) {
    if (!supabase) return
    const blockId = window.prompt('Block letter (A–R)', item.block_id)?.trim().toUpperCase()
    if (!blockId || !/^[A-R]$/.test(blockId)) { setMessage('Enter one block letter from A through R.'); return }
    const currentName = 'name' in item ? item.name : item.display_name
    const name = window.prompt('Public name or label', currentName)
    if (name === null || !name.trim()) return
    const address = window.prompt('Address (leave blank for none)', item.address ?? '')
    if (address === null) return
    const visible = window.confirm('Show this record in the signed-in ward directory? Choose Cancel to keep it restricted to administrators.')
    const phone = table === 'block_captains' ? window.prompt('Captain phone (leave blank for none)', 'phone' in item ? item.phone ?? '' : '') : null
    if (table === 'block_captains' && phone === null) return
    const buildingId = window.prompt(`Map structure ID (for example ${blockId}-1)`, 'building_id' in item ? item.building_id ?? '' : '')
    if (buildingId === null) return
    const values = table === 'block_captains'
      ? { block_id: blockId, name: name.trim(), address: address.trim() || null, phone: phone?.trim() || null, building_id: buildingId?.trim().toUpperCase() || null, is_public: visible }
      : { block_id: blockId, display_name: name.trim(), address: address.trim() || null, building_id: buildingId.trim().toUpperCase() || null, is_public: visible }
    const { error } = await supabase.from(table).update(values).eq('id', item.id)
    setMessage(error?.message ?? 'Map record updated.')
    if (!error) await loadAdminData()
  }

  async function grantMinisteringAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || !session) return
    const form = new FormData(event.currentTarget)
    const { error } = await supabase.from('ministering_access').upsert({ grantee_user_id: String(form.get('grantee_user_id')), target_household_id: String(form.get('target_household_id')), can_write: form.get('can_write') === 'on', granted_by: session.user.id }, { onConflict: 'grantee_user_id,target_household_id' })
    setMessage(error?.message ?? 'Ministering access saved.')
    if (!error) await loadAdminData()
  }

  async function linkProfileToHousehold(userId: string, householdId: string) {
    if (!supabase) return
    const household = households.find((item) => item.id === householdId)
    const { error } = await supabase.from('family_profiles').update({ household_id: householdId || null, block_id: household?.block_id, address: household?.address }).eq('user_id', userId)
    setMessage(error?.message ?? 'Account linked to map household.')
    if (!error) await loadAdminData()
  }

  if (!isSupabaseConfigured) return <div className="page-width interior-page"><div className="page-heading"><span className="eyebrow">Specialist access</span><h1>Connect Supabase to sign in</h1><p>Copy <code>.env.example</code> to <code>.env.local</code> and add the project URL and public anon key.</p></div></div>
  if (checking) return <div className="full-loader"><Loader2 className="spin" /> Checking access…</div>
  if (!session) return <div className="page-width interior-page auth-page"><form className="login-card" onSubmit={signIn}><div className="login-icon"><ShieldCheck /></div><span className="eyebrow">Restricted access</span><h1>Specialist sign in</h1><p>Only the ward emergency preparedness specialist can manage public content.</p><label><span>Email address</span><input required type="email" name="email" autoComplete="username" /></label><label><span>Password</span><input required type="password" name="password" autoComplete="current-password" /></label>{message && <p className="form-error">{message}</p>}<button className="button primary">Sign in <LogIn size={17} /></button></form></div>
  if (!authorized) return <div className="page-width interior-page"><div className="access-denied"><ShieldCheck /><h1>This account is not an administrator.</h1><p>Authentication succeeded, but the account has not been granted the specialist role.</p><button className="button secondary" onClick={() => supabase?.auth.signOut()}>Sign out</button></div></div>

  return <div className="page-width interior-page admin-page">
    <div className="admin-header"><div><span className="eyebrow">Authenticated workspace</span><h1>Specialist dashboard</h1><p>Manage the public information neighbors see.</p></div><button className="button secondary" onClick={() => supabase?.auth.signOut()}><LogOut size={16} /> Sign out</button></div>
    <div className="admin-tabs"><button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}><Newspaper /> Documents</button><button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}><MapPin /> Block map</button><button className={tab === 'access' ? 'active' : ''} onClick={() => setTab('access')}><KeyRound /> Household access</button><button className={tab === 'feedback' ? 'active' : ''} onClick={() => setTab('feedback')}><Bug /> Feedback {feedback.filter((item) => item.status === 'new').length > 0 && <i>{feedback.filter((item) => item.status === 'new').length}</i>}</button></div>
    {message && <div className="admin-message">{message}<button onClick={() => setMessage('')}>×</button></div>}
    {tab === 'documents' && <div className="admin-grid">
      <form className="admin-form" onSubmit={uploadDocument}><h2><FileUp /> Publish a PDF</h2><label><span>Document type</span><select name="kind"><option value="newsletter">Monthly newsletter</option><option value="plan">Standing emergency plan</option></select></label><label><span>Title</span><input required name="title" placeholder="August 2026 Preparedness Newsletter" /></label><label><span>Short description</span><textarea name="description" rows={3} /></label><label><span>Publication date</span><input name="published_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label className="file-field"><FileUp /><span><b>Choose PDF</b><small>PDF files only</small></span><input required name="file" type="file" accept="application/pdf" /></label><button className="button primary">Upload & publish</button></form>
      <div className="admin-list"><h2>Published documents</h2>{documents.map((document) => <div className="admin-list-row" key={document.id}><Newspaper /><span><b>{document.title}</b><small>{document.kind} · {new Date(document.published_at).toLocaleDateString()}</small></span><button onClick={() => remove('documents', document.id)} aria-label="Delete"><Trash2 /></button></div>)}</div>
    </div>}
    {tab === 'map' && <div className="admin-grid">
      <form className="admin-form" onSubmit={addMapRecord}><h2><Plus /> Add map record</h2><label><span>Record type</span><select name="record_type"><option value="captain">Block captain</option><option value="household">Household</option></select></label><label><span>Block</span><select name="block_id">{'ABCDEFGHIJKLMNOPQR'.split('').map((letter) => <option key={letter}>{letter}</option>)}</select></label><label><span>Name or family label</span><input required name="name" /></label><label><span>Address</span><input name="address" /></label><label><span>Phone (captains only)</span><input name="phone" type="tel" /></label><label><span>Map structure ID</span><input name="building_id" list="map-building-ids" placeholder="Example: G-4" pattern="[A-Ra-r]-([1-9]|1[0-9]|2[0-9]|30)" /><datalist id="map-building-ids">{Object.values(blockDetails).flatMap((detail) => detail.buildings).map((building) => <option key={building.id} value={building.id}>{building.addresses.map((item) => item.label).join(', ')}</option>)}</datalist><small>Links a captain or family to the exact code-drawn structure.</small></label><label className="check-label"><input name="is_public" type="checkbox" defaultChecked /><span><b>Show in the signed-in directory</b><small>The map itself is unavailable to signed-out visitors.</small></span></label><button className="button primary">Save map record</button></form>
      <div className="admin-list"><h2>Map directory</h2>{captains.map((item) => <div className="admin-list-row" key={item.id}><ShieldCheck /><span><b>Block {item.block_id}: {item.name}</b><small>Captain · {item.is_public ? 'Public' : 'Private'} · {item.address || 'No address'}</small></span><div className="row-actions"><button onClick={() => editMapRecord('block_captains', item)} aria-label="Edit"><Pencil /></button><button onClick={() => remove('block_captains', item.id)} aria-label="Delete"><Trash2 /></button></div></div>)}{households.map((item) => <div className="admin-list-row" key={item.id}><Users /><span><b>Block {item.block_id}: {item.display_name}</b><small>Household · {item.is_public ? 'Public' : 'Private'} · {item.address || 'No address'}</small></span><div className="row-actions"><button onClick={() => editMapRecord('block_households', item)} aria-label="Edit"><Pencil /></button><button onClick={() => remove('block_households', item.id)} aria-label="Delete"><Trash2 /></button></div></div>)}</div>
    </div>}
    {tab === 'access' && <div className="admin-grid access-admin-grid">
      <div className="admin-stack">
        <form className="admin-form" onSubmit={grantMinisteringAccess}><h2><KeyRound /> Grant ministering access</h2><label><span>Ministering account</span><select required name="grantee_user_id" defaultValue=""><option value="" disabled>Select an account</option>{profiles.map((profile) => <option key={profile.user_id} value={profile.user_id}>{profile.household_name || profile.address || profile.user_id}</option>)}</select></label><label><span>Household they minister to</span><select required name="target_household_id" defaultValue=""><option value="" disabled>Select a household</option>{households.map((household) => <option key={household.id} value={household.id}>Block {household.block_id} · {household.display_name} · {household.address}</option>)}</select></label><label className="check-label"><input name="can_write" type="checkbox" /><span><b>Allow updates</b><small>When off, the assigned account may read protected needs but cannot change them.</small></span></label><button className="button primary">Save access</button></form>
        <div className="admin-form"><h2><Link2 /> Link accounts to their homes</h2><p className="admin-help">This determines which household can edit its own protected needs.</p>{profiles.map((profile) => <label key={profile.user_id}><span>{profile.household_name || 'Unnamed account'} <small>{profile.address || 'No address reported'}</small></span><select value={profile.household_id ?? ''} onChange={(event) => void linkProfileToHousehold(profile.user_id, event.target.value)}><option value="">Not linked</option>{households.map((household) => <option key={household.id} value={household.id}>Block {household.block_id} · {household.display_name} · {household.address}</option>)}</select></label>)}</div>
      </div>
      <div className="admin-list"><h2>Active ministering permissions</h2>{grants.length ? grants.map((grant) => { const grantee = profiles.find((profile) => profile.user_id === grant.grantee_user_id); const target = households.find((household) => household.id === grant.target_household_id); return <div className="admin-list-row" key={grant.id}><KeyRound /><span><b>{grantee?.household_name || grantee?.address || 'Account'}</b><small>{grant.can_write ? 'Can read and update' : 'Read only'} · {target?.display_name || 'Unknown household'} · Block {target?.block_id}</small></span><button onClick={async () => { await supabase?.from('ministering_access').delete().eq('id', grant.id); await loadAdminData() }} aria-label="Revoke access"><Trash2 /></button></div> }) : <div className="empty-state">No ministering permissions have been granted.</div>}</div>
    </div>}
    {tab === 'feedback' && <div className="feedback-admin"><h2>Bug reports & feature ideas</h2>{feedback.length ? feedback.map((item) => <article key={item.id}><div><span className={`feedback-type ${item.type}`}>{item.type}</span><time>{new Date(item.created_at).toLocaleString()}</time></div><h3>{item.subject}</h3><p>{item.message}</p><small>{item.name || 'Anonymous'}{item.email ? ` · ${item.email}` : ''}</small><button onClick={async () => { await supabase?.from('feedback').update({ status: item.status === 'new' ? 'resolved' : 'new' }).eq('id', item.id); await loadAdminData() }}>{item.status === 'new' ? 'Mark resolved' : 'Reopen'}</button></article>) : <div className="empty-state">No feedback yet.</div>}</div>}
  </div>
}
