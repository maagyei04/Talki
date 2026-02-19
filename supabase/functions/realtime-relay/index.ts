import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    // 1. Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || "";
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
        const openAiKey = Deno.env.get('OPENAI_API_KEY') || "";

        if (!supabaseUrl || !serviceRoleKey || !openAiKey) {
            console.error("Missing environment variables");
            return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
        }

        // 2. Validate WebSocket Upgrade
        const upgradeValue = req.headers.get("upgrade") || "";
        if (upgradeValue.toLowerCase() !== "websocket") {
            return new Response("Expected Upgrade: websocket", { status: 426, headers: corsHeaders });
        }

        // 3. Authenticate User BEFORE upgrading
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            console.error("Auth failed:", userError?.message);
            return new Response("Unauthorized", { status: 401, headers: corsHeaders });
        }

        console.log(`User ${user.id} authenticated. Upgrading and connecting to OpenAI...`);

        // Now upgrade to WebSocket for the client
        const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

        // 4. Connect to OpenAI Realtime API
        // For environments where you cannot set headers, OpenAI supports passing the key as a subprotocol
        const url = `wss://api.openai.com/v1/realtime?model=gpt-4o-mini-realtime-preview`;
        const openAiSocket = new WebSocket(url, [
            'realtime',
            'openai-insecure-api-key.' + openAiKey,
            'openai-beta.realtime-v1'
        ]);

        const messageQueue: string[] = [];
        let openAiReady = false;
        let audioDeltaCount = 0;

        openAiSocket.onopen = () => {
            console.log("Realtime connection established with OpenAI");
            openAiReady = true;
            while (messageQueue.length > 0) {
                const msg = messageQueue.shift();
                if (msg) openAiSocket.send(msg);
            }
        };

        openAiSocket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            // diagnostic logging for audio flow
            if (data.type === 'response.audio.delta') {
                audioDeltaCount++;
                if (audioDeltaCount % 20 === 0) {
                    console.log(`Forwarded ${audioDeltaCount} audio deltas to user ${user.id}`);
                }
            } else if (data.type !== 'input_audio_buffer.append' && data.type !== 'input_audio_buffer.committed') {
                console.log(`OpenAI -> Client: ${data.type}`);
            }

            if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(event.data);
            }
        };

        openAiSocket.onclose = (event) => {
            console.error(`❌ OpenAI CLOSED for user ${user.id}!`);
            console.error(`   Code: ${event.code}`);
            console.error(`   Reason: "${event.reason}" (empty=${!event.reason})`);
            console.error(`   WasClean: ${event.wasClean}`);
            if (clientSocket.readyState <= WebSocket.OPEN) clientSocket.close(event.code, event.reason || 'OpenAI disconnected');
        };

        openAiSocket.onerror = (error) => {
            console.error("❌ OpenAI WebSocket Error:", error);
            if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(JSON.stringify({ type: 'error', error: { message: 'OpenAI connection failed' } }));
            }
            if (clientSocket.readyState <= WebSocket.OPEN) clientSocket.close();
        };

        // 5. Proxy Client messages to OpenAI
        let clientMessageCount = 0;
        clientSocket.onmessage = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);

                // NEW: Handle heartbeats silently at the relay level
                if (data.type === 'client.heartbeat') {
                    return;
                }

                if (data.type !== 'input_audio_buffer.append') {
                    clientMessageCount++;
                    console.log(`Client ${user.id} -> OpenAI (#${clientMessageCount}): ${data.type}`);
                }
                if (openAiReady && openAiSocket.readyState === WebSocket.OPEN) {
                    openAiSocket.send(event.data);
                } else {
                    messageQueue.push(event.data);
                }
            } catch (err) {
                console.error(`Error processing client message for ${user.id}:`, err);
            }
        };

        clientSocket.onclose = (event) => {
            console.log(`Client ${user.id} disconnected. Code: ${event.code}, Reason: ${event.reason}`);
            if (openAiSocket.readyState <= WebSocket.OPEN) openAiSocket.close(event.code, event.reason);
        };

        clientSocket.onerror = (error: Event) => {
            console.error(`Client ${user.id} WebSocket Error:`, error);
            if (openAiSocket.readyState <= WebSocket.OPEN) openAiSocket.close();
        };

        return response;
    } catch (e) {
        console.error("Relay Error:", e);
        return new Response("Internal Server Error", { status: 500, headers: corsHeaders });
    }
});
