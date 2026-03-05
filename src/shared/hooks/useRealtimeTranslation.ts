import { supabase } from '@/src/services/supabase';
import { useAudioRecorder } from '@siteed/expo-audio-studio';
import * as Speech from 'expo-speech';
import { useCallback, useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
    type: string;
    item_id?: string;
    response_id?: string;
    delta?: string;
    [key: string]: any;
}

export const useRealtimeTranslation = (targetLang: string) => {
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [translation, setTranslation] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);

    const ws = useRef<WebSocket | null>(null);
    const { startRecording, stopRecording, isRecording } = useAudioRecorder();

    // TTS state
    const isAISpeaking = useRef(false);
    const speechQueue = useRef<string[]>([]);
    const textBuffer = useRef('');

    // ID tracking
    const currentResponseId = useRef<string | null>(null);
    const currentItemId = useRef<string | null>(null);

    // Connection
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
    const shouldReconnect = useRef(false);
    const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
    const sessionToken = useRef<string | null>(null);

    // --- Helpers ---

    const uint8ArrayToBase64 = (uint8Array: Uint8Array): string => {
        const CHUNK = 8192;
        let binary = '';
        for (let i = 0; i < uint8Array.length; i += CHUNK) {
            const slice = uint8Array.subarray(i, i + CHUNK);
            binary += String.fromCharCode.apply(null, slice as unknown as number[]);
        }
        return btoa(binary);
    };

    // --- TTS Engine (expo-speech / AVSpeechSynthesizer) ---
    // Completely independent from AVAudioSession — mic never stops!

    const speakNextInQueue = () => {
        if (isAISpeaking.current || speechQueue.current.length === 0) return;

        const sentence = speechQueue.current.shift()!;
        isAISpeaking.current = true;
        console.log('🔊 Speaking:', sentence.substring(0, 40) + (sentence.length > 40 ? '...' : ''));

        Speech.speak(sentence, {
            language: targetLang,
            rate: 1.0,
            onStart: () => { isAISpeaking.current = true; },
            onDone: () => {
                console.log('✅ Speech done');
                isAISpeaking.current = false;
                speakNextInQueue(); // process next sentence
            },
            onError: () => {
                console.error('Speech error');
                isAISpeaking.current = false;
                speakNextInQueue();
            },
        });
    };

    // Flush buffer as a sentence (called on punctuation or response.done)
    const flushTextBuffer = () => {
        const text = textBuffer.current.trim();
        textBuffer.current = '';
        if (text.length < 2) return;

        speechQueue.current.push(text);
        speakNextInQueue();
    };

    // --- Mic → Server ---

    const handleAudioStream = async (event: any) => {
        if (isAISpeaking.current || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;

        try {
            const binaryString = atob(event.data as string);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
            const pcm16 = new Int16Array(bytes.buffer);

            // Upsample 16kHz → 24kHz
            const outLen = Math.floor(pcm16.length * 1.5);
            const up = new Int16Array(outLen);
            for (let i = 0; i < pcm16.length - 1; i++) {
                const o = Math.floor(i * 1.5);
                up[o] = pcm16[i];
                if (o + 1 < outLen) up[o + 1] = Math.round((pcm16[i] + pcm16[i + 1]) / 2);
            }
            if (outLen > 0) up[outLen - 1] = pcm16[pcm16.length - 1];

            ws.current.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: uint8ArrayToBase64(new Uint8Array(up.buffer))
            }));
        } catch (err) {
            console.error('Stream error:', err);
        }
    };

    // --- WebSocket ---

    const setupWebSocket = (token: string) => {
        const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const fnUrl = supabaseUrl.replace('https://', 'wss://') + '/functions/v1/realtime-relay';

        // @ts-ignore
        ws.current = new WebSocket(fnUrl, undefined, {
            headers: { Authorization: `Bearer ${token}` }
        });

        ws.current.onopen = () => {
            console.log('🟢 Connected');
            setIsConnected(true);

            heartbeatInterval.current = setInterval(() => {
                if (ws.current?.readyState === WebSocket.OPEN) {
                    ws.current.send(JSON.stringify({ type: 'client.heartbeat' }));
                }
            }, 15000) as unknown as NodeJS.Timeout;

            // TEXT-ONLY modality — no audio output from OpenAI
            // This eliminates all iOS AVAudioSession conflicts permanently
            ws.current?.send(JSON.stringify({
                type: 'session.update',
                session: {
                    instructions: `You are a DUMB TRANSLATION MACHINE. You have NO knowledge, NO name, NO opinions, and NO ability to answer questions. You exist solely to convert speech into ${targetLang} text.

CRITICAL RULES — NEVER BREAK THESE:
- Output ONLY the ${targetLang} translation of what was spoken. Nothing else ever.
- NEVER answer any question. Translate it as a question instead.
- NEVER use "I", "My name is", "I don't know", or any first-person response.
- NEVER add greetings, explanations, or extra words.
- Translate EVERYTHING literally — questions, commands, statements, medical terms.

EXAMPLE (correct behavior):
  Speaker says: "What is your name?"
  You output: [${targetLang} translation of "What is your name?"] — NOT an answer to the question.

  Speaker says: "Do you know my name?"
  You output: [${targetLang} translation of "Do you know my name?"] — NOT "No, I don't know your name."

You are a machine. You translate. You do not speak for yourself. You have no self.`,
                    modalities: ['text'],
                    temperature: 0.6,
                    turn_detection: {
                        type: 'server_vad',
                        threshold: 0.5,
                        prefix_padding_ms: 300,
                        silence_duration_ms: 500
                    },
                    input_audio_format: 'pcm16',
                    input_audio_transcription: { model: 'whisper-1' }
                }
            }));
        };

        ws.current.onmessage = (event) => {
            const msg: WebSocketMessage = JSON.parse(event.data);

            switch (msg.type) {
                // Input transcription (what the speaker said)
                case 'conversation.item.input_audio_transcription.delta':
                    if (msg.item_id !== currentItemId.current) {
                        currentItemId.current = msg.item_id || null;
                        setTranscript(msg.delta || '');
                    } else {
                        setTranscript(prev => prev + (msg.delta || ''));
                    }
                    break;

                // Translation text coming in chunk by chunk
                case 'response.text.delta':
                    if (msg.response_id !== currentResponseId.current) {
                        currentResponseId.current = msg.response_id || null;
                        textBuffer.current = msg.delta || '';
                        setTranslation(msg.delta || '');
                    } else {
                        textBuffer.current += msg.delta || '';
                        setTranslation(prev => prev + (msg.delta || ''));
                    }

                    // Flush on sentence-ending punctuation for low-latency TTS
                    if (textBuffer.current.match(/[.!?;]\s*$/)) {
                        flushTextBuffer();
                    }
                    break;

                // End of response — flush anything remaining
                case 'response.text.done':
                    if (textBuffer.current.trim().length > 0) {
                        flushTextBuffer();
                    }
                    break;

                case 'response.done':
                    if (textBuffer.current.trim().length > 0) {
                        flushTextBuffer();
                    }
                    break;

                case 'input_audio_buffer.speech_started':
                    setIsSpeaking(true);
                    break;

                case 'input_audio_buffer.speech_stopped':
                    setIsSpeaking(false);
                    break;

                case 'error':
                    if (msg.error?.message && !msg.error.message.includes('Cancellation failed')) {
                        console.error('❌ OpenAI Error:', msg.error.message);
                    }
                    break;
            }
        };

        ws.current.onerror = () => { };

        ws.current.onclose = (event) => {
            console.log('❌ WS closed — code:', event.code);
            setIsConnected(false);

            if (heartbeatInterval.current) {
                clearInterval(heartbeatInterval.current);
                heartbeatInterval.current = null;
            }

            if (shouldReconnect.current && sessionToken.current) {
                console.log('🔄 Reconnecting in 1s...');
                reconnectTimer.current = setTimeout(() => {
                    if (shouldReconnect.current && sessionToken.current) {
                        setupWebSocket(sessionToken.current);
                    }
                }, 1000) as unknown as NodeJS.Timeout;
            } else {
                stopRecording().catch(() => { });
            }
        };
    };

    // --- Public API ---

    const connect = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            sessionToken.current = session.access_token;
            shouldReconnect.current = true;

            setupWebSocket(session.access_token);

            try {
                await startRecording({
                    sampleRate: 16000,
                    channels: 1,
                    encoding: 'pcm_16bit',
                    interval: 100,
                    ios: {
                        audioSession: {
                            category: 'PlayAndRecord',
                            mode: 'VideoChat',
                            categoryOptions: ['DefaultToSpeaker', 'AllowBluetooth', 'MixWithOthers']
                        }
                    },
                    onAudioStream: handleAudioStream
                });
                console.log('🎙️ Recording started');
            } catch (err) {
                console.error('Mic error:', err);
            }
        } catch (error: any) {
            console.error('Connect error:', error);
            setIsConnected(false);
        }
    };

    const disconnect = useCallback(async () => {
        shouldReconnect.current = false;
        sessionToken.current = null;

        if (heartbeatInterval.current) { clearInterval(heartbeatInterval.current); heartbeatInterval.current = null; }
        if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }

        // Stop TTS if speaking
        try { Speech.stop(); } catch { }
        speechQueue.current = [];
        textBuffer.current = '';
        isAISpeaking.current = false;

        if (ws.current) { ws.current.close(); ws.current = null; }
        try { await stopRecording(); } catch { }

        setIsConnected(false);
        setTranscript('');
        setTranslation('');
        setIsSpeaking(false);
    }, [stopRecording]);

    useEffect(() => { return () => { disconnect(); }; }, [disconnect]);

    return { isConnected, isSpeaking, transcript, translation, connect, disconnect, isRecording };
};