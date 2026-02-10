import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Handle CORS (Preflight)
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Missing Supabase environment variables (URL or SERVICE_ROLE_KEY)')
        }

        const supabaseClient = createClient(supabaseUrl, serviceRoleKey)

        // Parse Body
        const body = await req.json().catch(() => ({}))
        const { recordPath, targetLang, conversationId } = body

        if (!recordPath) throw new Error('recordPath is required in the request body')

        // Parse Authorization
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            console.error('Missing Authorization header')
            return new Response(JSON.stringify({ error: 'No Authorization header provided' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const token = authHeader.replace('Bearer ', '')
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

        if (userError || !user) {
            console.error('Invalid token or user not found:', userError)
            return new Response(JSON.stringify({ error: 'Unauthorized: Invalid session' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        console.log(`Processing request for user: ${user.id}`)

        // 1. Download audio from storage
        const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('recordings')
            .download(recordPath)

        if (downloadError) throw downloadError

        // 2. Transcription via gpt-4o-mini-transcribe
        const openAiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openAiKey) throw new Error('OPENAI_API_KEY not set in Edge Function secrets')

        console.log('Starting transcription with gpt-4o-mini-transcribe...')
        const formData = new FormData()
        formData.append('file', new File([fileData], 'audio.m4a', { type: 'audio/m4a' }))
        formData.append('model', 'gpt-4o-mini-transcribe')

        const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${openAiKey}` },
            body: formData
        })

        if (!transcriptionResponse.ok) {
            const errorMsg = await transcriptionResponse.text()
            console.error('OpenAI Transcription Error:', errorMsg)
            throw new Error(`Transcription failed: ${errorMsg}`)
        }

        const { text: originalText } = await transcriptionResponse.json()
        console.log('Transcription successful:', originalText)

        // 3. Translation & Smart Actions via gpt-4o-mini
        console.log('Starting translation with gpt-4o-mini...')
        const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Translate the following text to ${targetLang}. Also, extract any "Smart Actions" (tasks, reminders, appointments) as a JSON array. 
            Return format: { "translation": "...", "actions": [{ "type": "...", "content": "...", "due_date": "..." }] }`
                    },
                    { role: 'user', content: originalText }
                ],
                response_format: { type: 'json_object' }
            })
        })

        if (!aiResponse.ok) {
            const errorMsg = await aiResponse.text()
            console.error('OpenAI Chat Error:', errorMsg)
            throw new Error(`Translation failed: ${errorMsg}`)
        }

        const aiResult = await aiResponse.json()
        const content = JSON.parse(aiResult.choices[0].message.content)
        console.log('Translation successful:', content.translation)

        // 4. TTS via gpt-4o-mini-tts
        console.log('Starting TTS with gpt-4o-mini-tts...')
        const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini-tts',
                input: content.translation,
                voice: 'alloy'
            })
        })

        if (!ttsResponse.ok) {
            const errorMsg = await ttsResponse.text()
            console.error('OpenAI TTS Error:', errorMsg)
            throw new Error(`Speech synthesis failed: ${errorMsg}`)
        }

        const ttsAudio = await ttsResponse.arrayBuffer()
        const ttsPath = `${user.id}/tts/${Date.now()}.mp3`

        console.log('Uploading TTS audio to storage...')
        const { error: ttsUploadError } = await supabaseClient.storage
            .from('recordings')
            .upload(ttsPath, ttsAudio, { contentType: 'audio/mpeg' })

        if (ttsUploadError) throw ttsUploadError

        // 5. Store in Database
        let currentConversationId = conversationId
        if (!currentConversationId) {
            const { data: conv } = await supabaseClient
                .from('conversations')
                .insert({ user_id: user.id, target_lang: targetLang })
                .select()
                .single()
            currentConversationId = conv.id
        }

        const { data: message } = await supabaseClient
            .from('messages')
            .insert({
                conversation_id: currentConversationId,
                speaker: 'me',
                original_text: originalText,
                translated_text: content.translation,
                audio_url: ttsPath
            })
            .select()
            .single()

        // Store smart actions if any
        if (content.actions && content.actions.length > 0) {
            await supabaseClient.from('smart_actions').insert(
                content.actions.map((action: any) => ({
                    conversation_id: currentConversationId,
                    ...action
                }))
            )
        }

        return new Response(
            JSON.stringify({
                message,
                actions: content.actions,
                audioUrl: ttsPath
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
