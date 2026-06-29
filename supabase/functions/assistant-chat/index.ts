import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are Talki Assistant, a private session intelligence tool built into the Talki translation app.

You have been given the user's recent conversation history as context. Your job is to answer questions about past sessions, generate summaries, and surface key information.

Rules you must always follow:
- Be Professional, Empathetic, and Concise. Never be chatty or conversational.
- Respond in at most 3 short paragraphs. When listing facts, use bullet points.
- If asked to summarize, always use exactly 3 bullet points.
- If you don't have relevant context to answer a question, say so clearly and briefly.
- Never fabricate information not present in the session history provided.
- Treat all session content with strict confidentiality — you are like a high-end medical or legal assistant.`

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const openAiKey = Deno.env.get('OPENAI_API_KEY')!

        const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

        // Validate auth
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'No Authorization header' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
        if (userError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        const body = await req.json()
        const { messages, conversationHistory } = body

        // Build the context block from user's history
        let historyContext = ''
        if (conversationHistory && conversationHistory.length > 0) {
            historyContext = '\n\n--- USER SESSION HISTORY (most recent first) ---\n'
            for (const session of conversationHistory) {
                historyContext += `\n[Session: ${session.date} | Mode: ${session.mode} | Languages: ${session.lang_pair}]\n`
                if (session.turns && session.turns.length > 0) {
                    for (const turn of session.turns) {
                        historyContext += `  Original: "${turn.original_text}"\n`
                        historyContext += `  Translated: "${turn.translated_text}"\n`
                    }
                } else {
                    historyContext += '  (No turns recorded)\n'
                }
            }
            historyContext += '\n--- END OF HISTORY ---\n'
        } else {
            historyContext = '\n\n(No session history is available yet for this user.)\n'
        }

        const systemWithContext = SYSTEM_PROMPT + historyContext

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                    { role: 'system', content: systemWithContext },
                    ...messages,
                ],
                max_tokens: 600,
                temperature: 0.3, // Low temperature for factual, consistent responses
            })
        })

        if (!response.ok) {
            const err = await response.text()
            throw new Error(`OpenAI error: ${err}`)
        }

        const data = await response.json()
        const reply = data.choices[0].message.content

        return new Response(JSON.stringify({ reply }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
