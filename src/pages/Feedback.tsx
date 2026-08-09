import { FormEvent, useState } from 'react'
import { Bug, CheckCircle2, Lightbulb, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Feedback() {
  const [type, setType] = useState<'bug' | 'feature'>('bug')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus('sending')
    const form = new FormData(event.currentTarget)
    const payload = { type, name: form.get('name'), email: form.get('email'), subject: form.get('subject'), message: form.get('message'), website: form.get('website') }
    if (!supabase) { setStatus('error'); return }
    const { error } = await supabase.functions.invoke('submit-feedback', { body: payload })
    setStatus(error ? 'error' : 'sent')
    if (!error) event.currentTarget.reset()
  }

  return <div className="page-width interior-page feedback-page">
    <div className="page-heading"><span className="eyebrow">Help make this useful</span><h1>Report a bug or share an idea</h1><p>Tell the preparedness specialist what is not working or what would make this resource better.</p></div>
    <div className="feedback-layout">
      <div className="feedback-intro"><span>We read every note</span><h2>What did you notice?</h2><p>Clear details help reproduce bugs and understand new ideas. Please don’t include private household, health, or financial information.</p><div><b>For urgent emergencies</b><p>Do not use this form. Call 911 when there is immediate danger, then follow the ward emergency plan.</p></div></div>
      {status === 'sent' ? <div className="success-panel"><CheckCircle2 /><h2>Thank you.</h2><p>Your message was sent to the emergency preparedness specialist.</p><button className="button primary" onClick={() => setStatus('idle')}>Send another</button></div> :
      <form className="feedback-form" onSubmit={submit}>
        <fieldset><legend>What kind of message is this?</legend><div className="type-picker"><button type="button" className={type === 'bug' ? 'active' : ''} onClick={() => setType('bug')}><Bug /><span><b>Bug report</b><small>Something isn’t working</small></span></button><button type="button" className={type === 'feature' ? 'active' : ''} onClick={() => setType('feature')}><Lightbulb /><span><b>Feature idea</b><small>A way to improve the site</small></span></button></div></fieldset>
        <div className="form-row"><label><span>Your name <small>optional</small></span><input name="name" autoComplete="name" /></label><label><span>Email <small>optional</small></span><input name="email" type="email" autoComplete="email" /></label></div>
        <label><span>Short summary</span><input name="subject" required maxLength={120} placeholder={type === 'bug' ? 'Example: Water total does not update' : 'Example: Add a printable shopping list'} /></label>
        <label><span>Details</span><textarea name="message" required minLength={10} maxLength={4000} rows={7} placeholder="What happened, what did you expect, or how would your idea help?" /></label>
        <label className="honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        {status === 'error' && <p className="form-error">The form is not connected yet or could not send. Please try again later, or email jaromwardwell@gmail.com.</p>}
        <button className="button primary" disabled={status === 'sending'}>{status === 'sending' ? 'Sending…' : <>Send feedback <Send size={17} /></>}</button>
      </form>}
    </div>
  </div>
}
