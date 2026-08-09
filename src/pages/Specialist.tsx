import { FormEvent, useEffect, useState } from 'react'
import { Bug, FileUp, Loader2, LogIn, LogOut, MapPin, Newspaper, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { BlockCaptain, BlockHousehold, DocumentRecord } from '../types'

type FeedbackRecord = { id: string; type: string; name: string | null; email: string | null; subject: string; message: string; status: string; created_at: string }

export default function Specialist() {
  const [session, setSession] = useState<Session | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [tab, setTab] = useState<'documents' | 'map' | 'feedback'>('documents')
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [captains, setCaptains] = useState<BlockCaptain[]>([])
  const [households, setHouseholds] = useState<BlockHousehold[]>([])
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([])
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
    const [docs, captainRows, householdRows, feedbackRows] = await Promise.all([
      supabase.from('documents').select('*').order('published_at', { ascending: false }),
      supabase.from('block_captains').select('*').order('block_id'),
      supabase.from('block_households').select('*').order('block_id'),
      supabase.from('feedback').select('*').order('created_at', { ascending: false }),
    ])
    setDocuments((docs.data as DocumentRecord[]) ?? [])
    setCaptains((captainRows.data as BlockCaptain[]) ?? [])
    setHouseholds((householdRows.data as BlockHousehold[]) ?? [])
    setFeedback((feedbackRows.data as FeedbackRecord[]) ?? [])
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
      ? await supabase.from('block_captains').insert({ ...payload, phone: String(form.get('phone') || '') || null })
      : await supabase.from('block_households').insert({ block_id: payload.block_id, display_name: payload.name, address: payload.address, is_public: payload.is_public })
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
    const visible = window.confirm('Show this record publicly? Choose Cancel to keep it private.')
    const phone = table === 'block_captains' ? window.prompt('Captain phone (leave blank for none)', 'phone' in item ? item.phone ?? '' : '') : null
    if (table === 'block_captains' && phone === null) return
    const values = table === 'block_captains'
      ? { block_id: blockId, name: name.trim(), address: address.trim() || null, phone: phone?.trim() || null, is_public: visible }
      : { block_id: blockId, display_name: name.trim(), address: address.trim() || null, is_public: visible }
    const { error } = await supabase.from(table).update(values).eq('id', item.id)
    setMessage(error?.message ?? 'Map record updated.')
    if (!error) await loadAdminData()
  }

  if (!isSupabaseConfigured) return <div className="page-width interior-page"><div className="page-heading"><span className="eyebrow">Specialist access</span><h1>Connect Supabase to sign in</h1><p>Copy <code>.env.example</code> to <code>.env.local</code> and add the project URL and public anon key.</p></div></div>
  if (checking) return <div className="full-loader"><Loader2 className="spin" /> Checking access…</div>
  if (!session) return <div className="page-width interior-page auth-page"><form className="login-card" onSubmit={signIn}><div className="login-icon"><ShieldCheck /></div><span className="eyebrow">Restricted access</span><h1>Specialist sign in</h1><p>Only the ward emergency preparedness specialist can manage public content.</p><label><span>Email address</span><input required type="email" name="email" autoComplete="username" /></label><label><span>Password</span><input required type="password" name="password" autoComplete="current-password" /></label>{message && <p className="form-error">{message}</p>}<button className="button primary">Sign in <LogIn size={17} /></button></form></div>
  if (!authorized) return <div className="page-width interior-page"><div className="access-denied"><ShieldCheck /><h1>This account is not an administrator.</h1><p>Authentication succeeded, but the account has not been granted the specialist role.</p><button className="button secondary" onClick={() => supabase?.auth.signOut()}>Sign out</button></div></div>

  return <div className="page-width interior-page admin-page">
    <div className="admin-header"><div><span className="eyebrow">Authenticated workspace</span><h1>Specialist dashboard</h1><p>Manage the public information neighbors see.</p></div><button className="button secondary" onClick={() => supabase?.auth.signOut()}><LogOut size={16} /> Sign out</button></div>
    <div className="admin-tabs"><button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}><Newspaper /> Documents</button><button className={tab === 'map' ? 'active' : ''} onClick={() => setTab('map')}><MapPin /> Block map</button><button className={tab === 'feedback' ? 'active' : ''} onClick={() => setTab('feedback')}><Bug /> Feedback {feedback.filter((item) => item.status === 'new').length > 0 && <i>{feedback.filter((item) => item.status === 'new').length}</i>}</button></div>
    {message && <div className="admin-message">{message}<button onClick={() => setMessage('')}>×</button></div>}
    {tab === 'documents' && <div className="admin-grid">
      <form className="admin-form" onSubmit={uploadDocument}><h2><FileUp /> Publish a PDF</h2><label><span>Document type</span><select name="kind"><option value="newsletter">Monthly newsletter</option><option value="plan">Standing emergency plan</option></select></label><label><span>Title</span><input required name="title" placeholder="August 2026 Preparedness Newsletter" /></label><label><span>Short description</span><textarea name="description" rows={3} /></label><label><span>Publication date</span><input name="published_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label className="file-field"><FileUp /><span><b>Choose PDF</b><small>PDF files only</small></span><input required name="file" type="file" accept="application/pdf" /></label><button className="button primary">Upload & publish</button></form>
      <div className="admin-list"><h2>Published documents</h2>{documents.map((document) => <div className="admin-list-row" key={document.id}><Newspaper /><span><b>{document.title}</b><small>{document.kind} · {new Date(document.published_at).toLocaleDateString()}</small></span><button onClick={() => remove('documents', document.id)} aria-label="Delete"><Trash2 /></button></div>)}</div>
    </div>}
    {tab === 'map' && <div className="admin-grid">
      <form className="admin-form" onSubmit={addMapRecord}><h2><Plus /> Add map record</h2><label><span>Record type</span><select name="record_type"><option value="captain">Block captain</option><option value="household">Household</option></select></label><label><span>Block</span><select name="block_id">{'ABCDEFGHIJKLMNOPQR'.split('').map((letter) => <option key={letter}>{letter}</option>)}</select></label><label><span>Name or public label</span><input required name="name" /></label><label><span>Address</span><input name="address" placeholder="Only shown publicly when allowed" /></label><label><span>Phone (captains only)</span><input name="phone" type="tel" /></label><label className="check-label"><input name="is_public" type="checkbox" /><span><b>Show this record publicly</b><small>Confirm the person has approved publishing their details.</small></span></label><button className="button primary">Save map record</button></form>
      <div className="admin-list"><h2>Map directory</h2>{captains.map((item) => <div className="admin-list-row" key={item.id}><ShieldCheck /><span><b>Block {item.block_id}: {item.name}</b><small>Captain · {item.is_public ? 'Public' : 'Private'} · {item.address || 'No address'}</small></span><div className="row-actions"><button onClick={() => editMapRecord('block_captains', item)} aria-label="Edit"><Pencil /></button><button onClick={() => remove('block_captains', item.id)} aria-label="Delete"><Trash2 /></button></div></div>)}{households.map((item) => <div className="admin-list-row" key={item.id}><Users /><span><b>Block {item.block_id}: {item.display_name}</b><small>Household · {item.is_public ? 'Public' : 'Private'} · {item.address || 'No address'}</small></span><div className="row-actions"><button onClick={() => editMapRecord('block_households', item)} aria-label="Edit"><Pencil /></button><button onClick={() => remove('block_households', item.id)} aria-label="Delete"><Trash2 /></button></div></div>)}</div>
    </div>}
    {tab === 'feedback' && <div className="feedback-admin"><h2>Bug reports & feature ideas</h2>{feedback.length ? feedback.map((item) => <article key={item.id}><div><span className={`feedback-type ${item.type}`}>{item.type}</span><time>{new Date(item.created_at).toLocaleString()}</time></div><h3>{item.subject}</h3><p>{item.message}</p><small>{item.name || 'Anonymous'}{item.email ? ` · ${item.email}` : ''}</small><button onClick={async () => { await supabase?.from('feedback').update({ status: item.status === 'new' ? 'resolved' : 'new' }).eq('id', item.id); await loadAdminData() }}>{item.status === 'new' ? 'Mark resolved' : 'Reopen'}</button></article>) : <div className="empty-state">No feedback yet.</div>}</div>}
  </div>
}
