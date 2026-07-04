import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mints a short-lived OpenAI client_secret for a single bidirectional realtime session
// (general gpt-realtime-2 model, not the dedicated one-way gpt-realtime-translate model —
// that model has no "instructions" field and can't be told to stop answering questions when
// the spoken language matches its configured target). The client connects the returned
// secret directly to OpenAI over WebRTC — this function never touches the audio stream.
serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || "";
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
        const openAiKey = Deno.env.get('OPENAI_API_KEY') || "";

        if (!supabaseUrl || !serviceRoleKey || !openAiKey) {
            console.error("Missing environment variables");
            return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
                status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            console.error("Auth failed:", userError?.message);
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const { langA, langB } = await req.json();
        if (!langA || !langB || typeof langA !== 'string' || typeof langB !== 'string') {
            return new Response(JSON.stringify({ error: 'langA and langB are required' }), {
                status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const instructions = `You are a passive simultaneous translation engine, not a conversational assistant.
Strict rules:
1. If the speaker uses ${langA}, translate immediately and literally into ${langB}.
2. If the speaker uses ${langB}, translate immediately and literally into ${langA}.
3. Output ONLY the direct translation of what was said. Never answer questions, never add commentary or opinions, never engage in conversation, and never say anything the speaker did not say.
4. If you hear what sounds like your own generated voice (an echo of your previous translation), DO NOT translate it again. Ignore it completely.
5. If the audio is unclear, silent, or repetitive feedback, output nothing.`;

        const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openAiKey}`,
                'Content-Type': 'application/json',
                'OpenAI-Safety-Identifier': user.id,
            },
            body: JSON.stringify({
                session: {
                    type: 'realtime',
                    model: 'gpt-realtime-2',
                    instructions,
                    audio: {
                        input: {
                            transcription: { model: 'gpt-realtime-whisper' },
                            turn_detection: {
                                type: 'server_vad',
                                threshold: 0.5,
                                prefix_padding_ms: 300,
                                silence_duration_ms: 500,
                            },
                            noise_reduction: { type: 'near_field' },
                        },
                        output: { voice: 'alloy' },
                    },
                },
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error(`OpenAI client_secret error for user ${user.id}:`, err);
            return new Response(JSON.stringify({ error: 'Failed to create realtime session' }), {
                status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const session = await response.json();
        console.log(`Minted realtime client_secret for user ${user.id} (${langA} <-> ${langB})`);

        return new Response(JSON.stringify(session), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    } catch (e) {
        console.error("Session mint error:", e);
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
