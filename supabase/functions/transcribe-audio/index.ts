import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

        // The audio is uploaded to storage: get the path from request
        const { storagePath } = await req.json()
        if (!storagePath) {
            return new Response(JSON.stringify({ error: 'storagePath is required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            })
        }

        // Download the audio file from Supabase storage
        const { data: fileData, error: downloadError } = await supabaseClient.storage
            .from('recordings')
            .download(storagePath)

        if (downloadError) throw downloadError

        // Transcribe via Whisper
        const formData = new FormData()
        formData.append('file', new File([fileData], 'audio.m4a', { type: 'audio/m4a' }))
        formData.append('model', 'whisper-1')

        const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${openAiKey}` },
            body: formData,
        })

        if (!whisperRes.ok) {
            const err = await whisperRes.text()
            throw new Error(`Whisper error: ${err}`)
        }

        const { text } = await whisperRes.json()

        // Clean up the temp storage file
        await supabaseClient.storage.from('recordings').remove([storagePath])

        return new Response(JSON.stringify({ text }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }
})
