import { type FormEvent, useEffect, useState } from 'react'
import { Check, Cloud, Eye, EyeOff, LockKeyhole, LogIn, LogOut, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup' | 'forgot'

function profileMessage(errorMessage: string) {
  return errorMessage.includes("'address' column") || errorMessage.includes('schema cache')
    ? 'The deployed database is missing the latest family profile update. Apply the pending Supabase migrations, then try again.'
    : errorMessage
}

export default function Account() {
  const { session, loading } = useAuth()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [householdName, setHouseholdName] = useState('')
  const [address, setAddress] = useState('')
  const [blockId, setBlockId] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    if (!session || !supabase) return
    supabase.from('family_profiles').select('household_name, address, block_id').eq('user_id', session.user.id).maybeSingle().then(({ data, error }) => {
      if (error) setMessage(profileMessage(error.message))
      setHouseholdName(data?.household_name ?? String(session.user.user_metadata.household_name ?? ''))
      setAddress(data?.address ?? String(session.user.user_metadata.address ?? ''))
      setBlockId(data?.block_id ?? String(session.user.user_metadata.block_id ?? ''))
    })
  }, [session])

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setMessage('')
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` })
      setMessage(error?.message ?? 'Check your email for a password reset link.')
    } else if (mode === 'signup') {
      const password = String(form.get('password'))
      const name = String(form.get('household_name'))
      const address = String(form.get('address')).trim()
      const blockId = String(form.get('block_id')).toUpperCase()
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { household_name: name, address, block_id: blockId } } })
      setMessage(error?.message ?? (data.session ? 'Your account is ready and you are signed in.' : 'Account created, but Confirm Email is still enabled in the hosted Supabase project. Disable it under Authentication → Providers → Email to allow immediate sign-in.'))
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: String(form.get('password')) })
      setMessage(error?.message ?? '')
    }
    setBusy(false)
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !session) return
    setBusy(true)
    if (!address.trim() || !blockId) { setMessage('Address and block are required for private directory access.'); setBusy(false); return }
    const { error } = await supabase.from('family_profiles').upsert({ user_id: session.user.id, household_name: householdName.trim() || null, address: address.trim(), block_id: blockId })
    setMessage(error ? profileMessage(error.message) : 'Profile saved.')
    setBusy(false)
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault()
    if (!supabase || newPassword.length < 8) return
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setMessage(error?.message ?? 'Password updated.')
    if (!error) setNewPassword('')
    setBusy(false)
  }

  if (loading) return <div className="full-loader">Loading account…</div>
  if (!isSupabaseConfigured) return <Navigate to="/planner" replace />

  if (session) return <div className="page-width interior-page account-page">
    <div className="account-welcome"><span className="eyebrow">Your private space</span><h1>Welcome back.</h1><p>{session.user.email}</p></div>
    <div className="account-grid">
      <section className="account-panel">
        <div className="panel-title"><Cloud /><div><h2>Cloud sync is on</h2><p>Your household plan follows you to any signed-in device.</p></div></div>
        <form onSubmit={saveProfile}>
          <label><span>Household display name <small>private</small></span><input value={householdName} maxLength={80} onChange={(event) => setHouseholdName(event.target.value)} placeholder="The Rivera household" /></label>
          <label><span>Home address <small>required to connect your private map household</small></span><input required value={address} maxLength={180} onChange={(event) => setAddress(event.target.value)} placeholder="496 N 500 E" autoComplete="street-address" /></label>
          <label><span>Ward block <small>required for directory access and anonymous block totals</small></span><select required value={blockId} onChange={(event) => setBlockId(event.target.value)}><option value="">Select your block</option>{'ABCDEFGHIJKLMNOPQR'.split('').map((block) => <option key={block} value={block}>Block {block}</option>)}</select></label>
          {message && <p className="account-message">{message}</p>}
          <div className="button-row"><button className="button primary" disabled={busy}>Save profile</button><button type="button" className="button secondary" onClick={() => supabase?.auth.signOut()}><LogOut size={16} /> Sign out</button></div>
        </form>
        <form className="password-form" onSubmit={updatePassword}><label><span>Change password</span><input type="password" value={newPassword} minLength={8} autoComplete="new-password" onChange={(event) => setNewPassword(event.target.value)} placeholder="New password, 8+ characters" /></label><button className="button secondary" disabled={busy || newPassword.length < 8}>Update password</button></form>
      </section>
      <PrivacyPromise />
    </div>
  </div>

  return <div className="page-width interior-page auth-family-page">
    <div className="family-auth-copy">
      <span className="eyebrow">Preparedness that follows you</span>
      <h1>{mode === 'signup' ? 'Save your family’s progress.' : mode === 'forgot' ? 'Reset your password.' : 'Pick up where you left off.'}</h1>
      <p>Create a family account to privately sync household plans, custom pantry items, favorite meals, and your ward directory access across devices.</p>
      <PrivacyPromise />
    </div>
    <form className="family-auth-form" onSubmit={submitAuth}>
      <div className="auth-mode-icon">{mode === 'signup' ? <UserPlus /> : <LogIn />}</div>
      <h2>{mode === 'signup' ? 'Create family account' : mode === 'forgot' ? 'Password help' : 'Family sign in'}</h2>
      {mode === 'signup' && <div className="no-confirm-note"><Check /><span><b>No confirmation step.</b> Create your account and begin planning immediately—no inbox visit required.</span></div>}
      {mode === 'signup' && <label><span>Household name <small>optional</small></span><input name="household_name" maxLength={80} autoComplete="organization" placeholder="The Rivera household" /></label>}
      {mode === 'signup' && <><label><span>Home address</span><input required name="address" maxLength={180} autoComplete="street-address" placeholder="496 N 500 E" /></label><label><span>Ward block</span><select required name="block_id" defaultValue=""><option value="" disabled>Select your block</option>{'ABCDEFGHIJKLMNOPQR'.split('').map((block) => <option key={block} value={block}>Block {block}</option>)}</select></label></>}
      <label><span>Email address</span><div className="input-with-icon"><Mail /><input required name="email" type="email" autoComplete="email" /></div></label>
      {mode !== 'forgot' && <label><span>Password</span><div className="input-with-icon"><LockKeyhole /><input required name="password" type={showPassword ? 'text' : 'password'} minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff /> : <Eye />}</button></div>{mode === 'signup' && <small>At least 8 characters; a password manager is best.</small>}</label>}
      {message && <p className="account-message">{message}</p>}
      <button className="button primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}</button>
      <div className="auth-switch">{mode !== 'signin' && <button type="button" onClick={() => { setMode('signin'); setMessage('') }}>Already have an account? Sign in</button>}{mode === 'signin' && <><button type="button" onClick={() => { setMode('signup'); setMessage('') }}>Create a family account</button><button type="button" onClick={() => { setMode('forgot'); setMessage('') }}>Forgot password?</button></>}</div>
    </form>
  </div>
}

function PrivacyPromise() {
  return <aside className="privacy-promise"><div><ShieldCheck /><span><b>Your data belongs to you.</b><small>Plain-language privacy promise</small></span></div><ul><li><Check /> Your pantry, meal wishlist, and household plan are readable only by your signed-in family.</li><li><Check /> We never sell your information or use it for advertising.</li><li><Check /> Family names and addresses require a signed-in ward account.</li><li><Check /> Needs and special circumstances are visible only to your household, the specialist, and ministering accounts the specialist explicitly authorizes.</li></ul></aside>
}
