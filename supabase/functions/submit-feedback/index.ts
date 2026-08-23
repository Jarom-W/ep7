import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = await request.json()
    // Invisible honeypot: bots commonly fill this field.
    if (body.website) return json({ ok: true })

    const type = body.type === 'feature' ? 'feature' : 'bug'
    const subject = String(body.subject ?? '').trim().slice(0, 120)
    const message = String(body.message ?? '').trim().slice(0, 4000)
    const name = String(body.name ?? '').trim().slice(0, 120) || null
    const email = String(body.email ?? '').trim().slice(0, 254) || null
    if (!subject || message.length < 10) return json({ error: 'Please provide a summary and details.' }, 400)
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email address.' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )
    const { error: insertError } = await admin.from('feedback').insert({ type, name, email, subject, message })
    if (insertError) throw insertError

    const resendKey = Deno.env.get('RESEND_API_KEY')
    const from = Deno.env.get('FEEDBACK_FROM_EMAIL')
    if (!resendKey || !from) throw new Error('Email delivery is not configured')

    const mailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: ['jaromwardwell@gmail.com'],
        reply_to: email ?? undefined,
        subject: `[Ward site ${type === 'bug' ? 'Bug' : 'Idea'}] ${subject}`,
        text: `${type.toUpperCase()} SUBMISSION\n\nFrom: ${name ?? 'Anonymous'}${email ? ` <${email}>` : ''}\n\n${message}`,
      }),
    })
    if (!mailResponse.ok) throw new Error(`Email provider returned ${mailResponse.status}`)
    return json({ ok: true })
  } catch (error) {
    console.error(error)
    return json({ error: 'Could not submit feedback.' }, 500)
  }
})

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
