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

    // 2. Validate WebSocket Upgrade
    const upgrade = req.headers.get("upgrade") || "";
    if (upgrade.toLowerCase() !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    try {
        const { socket: clientSocket, response } = Deno.upgradeWebSocket(req);

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || "";
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || "";
        const openAiKey = Deno.env.get('OPENAI_API_KEY') || "";

        if (!supabaseUrl || !serviceRoleKey || !openAiKey) {
            console.error("Missing environment variables (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or OPENAI_API_KEY)");
            return new Response("Internal Server Error", { status: 500 });
        }

        // 3. Authenticate User (extract token from headers)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error("No Authorization header provided");
            return new Response("Unauthorized", { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            console.error("User authentication failed:", userError?.message);
            return new Response("Unauthorized", { status: 401 });
        }

        console.log(`User ${user.id} authenticated. Establishing connection to OpenAI...`);

        // 4. Connect to OpenAI Realtime API
        const url = "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01";
        const openAiSocket = new WebSocket(url, [
            "realtime",
            "openai-insecure-api-key." + openAiKey,
            "openai-beta.realtime-v1"
        ]);

        openAiSocket.onopen = () => {
            console.log("Realtime connection established with OpenAI");
        };

        openAiSocket.onmessage = (event) => {
            if (clientSocket.readyState === WebSocket.OPEN) {
                clientSocket.send(event.data);
            }
        };

        openAiSocket.onclose = () => {
            console.log("OpenAI disconnected");
            if (clientSocket.readyState <= WebSocket.OPEN) clientSocket.close();
        };

        openAiSocket.onerror = (error) => {
            console.error("OpenAI WebSocket Error:", error);
            if (clientSocket.readyState <= WebSocket.OPEN) clientSocket.close();
        };

        // 5. Proxy Client messages to OpenAI
        clientSocket.onmessage = (event) => {
            if (openAiSocket.readyState === WebSocket.OPEN) {
                openAiSocket.send(event.data);
            }
        };

        clientSocket.onclose = () => {
            console.log("Mobile client disconnected");
            if (openAiSocket.readyState <= WebSocket.OPEN) openAiSocket.close();
        };

        clientSocket.onerror = (error) => {
            console.error("Client WebSocket Error:", error);
            if (openAiSocket.readyState <= WebSocket.OPEN) openAiSocket.close();
        };

        return response;
    } catch (e) {
        console.error("Deployment or Upgrade Error:", e);
        return new Response("Internal Server Error", { status: 500 });
    }
});
