import { supabase } from '@/src/services/supabase';
import { useAudioRecorder } from '@siteed/expo-audio-studio';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
    type: string;
    item_id?: string;
    response_id?: string;
    delta?: string;
    [key: string]: any;
}

export const useRealtimeTranslation = (langA: string, langB: string) => {
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [translation, setTranslation] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);

    const ws = useRef<WebSocket | null>(null);
    const { startRecording, stopRecording, isRecording } = useAudioRecorder();

    // Audio & State tracking
    const isAISpeaking = useRef(false);
    const audioDeltas = useRef<string[]>([]);
    const audioPlayer = useRef<Audio.Sound | null>(null);

    // ID tracking
    const currentResponseId = useRef<string | null>(null);
    const currentItemId = useRef<string | null>(null);
    const textBuffer = useRef('');

    // Live session persistence
    const liveConversationId = useRef<string | null>(null);
    const pendingTranscript = useRef<string>('');    // buffered input (me)
    const pendingTranslation = useRef<string>('');   // buffered output (AI)
    const liveMessageCount = useRef<number>(0);      // tracks turns saved this session

    // Helper to persist only when we have both sides of a turn
    const tryPersistLiveTurn = useCallback(() => {
        if (!liveConversationId.current || !pendingTranscript.current || !pendingTranslation.current) {
            console.log('⏳ Buffer incomplete, waiting for other side of turn...', {
                hasTranscript: !!pendingTranscript.current,
                hasTranslation: !!pendingTranslation.current
            });
            return;
        }

        console.log('💾 Saving live turn to Supabase...');
        const original = pendingTranscript.current;
        const translated = pendingTranslation.current;

        // Clear immediately to prevent double-save if another event fires
        pendingTranscript.current = '';
        pendingTranslation.current = '';

        supabase.from('messages').insert({
            conversation_id: liveConversationId.current,
            speaker: 'me',
            original_text: original,
            translated_text: translated,
            audio_url: null,
        }).then(({ error }) => {
            if (error) {
                console.error('❌ Live message save error:', error.message);
                // Put them back if it failed due to some transient issue? 
                // Actually RLS is the likely cause here, so we won't retry automatically.
            } else {
                console.log('✅ Live message saved');
                liveMessageCount.current += 1;
            }
        });
    }, []);

    // Connection
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);
    const shouldReconnect = useRef(false);
    const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
    const sessionToken = useRef<string | null>(null);

    const playChime = async () => {
        try {
            const soundAsset = require('@assets/audio/blip.mp3');
            const { sound } = await Audio.Sound.createAsync(soundAsset, { shouldPlay: true, volume: 0.4 });
            isAISpeaking.current = true; // Lock mic while chime is playing
            sound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    sound.unloadAsync();
                    // 500ms post-speech lockout — keeps the mic gated briefly after
                    // the chime ends to prevent "ghost" triggers from the AI's own audio tail
                    setTimeout(() => {
                        isAISpeaking.current = false;
                    }, 500);
                }
            });
        } catch (err) {
            console.error('Chime failed:', err);
            isAISpeaking.current = false;
        }
    };

    const playOpenAIAudio = async () => {
        if (audioDeltas.current.length === 0) return;
        isAISpeaking.current = true;

        try {
            // Concatenate base64 deltas
            const fullBase64 = audioDeltas.current.join('');
            audioDeltas.current = []; // Clear for next run

            // Create WAV header for PCM16 24kHz Mono
            const writeWavHeader = (length: number) => {
                const buffer = new ArrayBuffer(44);
                const view = new DataView(buffer);
                const writeString = (offset: number, string: string) => {
                    for (let i = 0; i < string.length; i++) {
                        view.setUint8(offset + i, string.charCodeAt(i));
                    }
                };
                writeString(0, 'RIFF');
                view.setUint32(4, 36 + length, true);
                writeString(8, 'WAVE');
                writeString(12, 'fmt ');
                view.setUint32(16, 16, true);
                view.setUint16(20, 1, true); // PCM
                view.setUint16(22, 1, true); // Mono
                view.setUint32(24, 24000, true); // Sample Rate (OpenAI default)
                view.setUint32(28, 24000 * 2, true); // Byte Rate
                view.setUint16(32, 2, true); // Block Align
                view.setUint16(34, 16, true); // Bits per sample
                writeString(36, 'data');
                view.setUint32(40, length, true);
                return buffer;
            };

            const binaryString = atob(fullBase64);
            const pcmLength = binaryString.length;
            const headerBuffer = writeWavHeader(pcmLength);

            const fullBuffer = new Uint8Array(44 + pcmLength);
            fullBuffer.set(new Uint8Array(headerBuffer), 0);
            for (let i = 0; i < pcmLength; i++) {
                fullBuffer[44 + i] = binaryString.charCodeAt(i);
            }

            const base64Wav = uint8ArrayToBase64(fullBuffer);
            const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
            const fileUri = `${cacheDir}speech_${Date.now()}.wav`;
            await FileSystem.writeAsStringAsync(fileUri, base64Wav, { encoding: FileSystem.EncodingType.Base64 });

            const { sound } = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: true });
            audioPlayer.current = sound;

            sound.setOnPlaybackStatusUpdate(async (status) => {
                if (status.isLoaded && status.didJustFinish) {
                    isAISpeaking.current = false;
                    await sound.unloadAsync();
                    playChime(); // Play chime after audio finishes
                }
            });
        } catch (error) {
            console.error('Playback error:', error);
            isAISpeaking.current = false;
        }
    };

    const uint8ArrayToBase64 = (uint8Array: Uint8Array): string => {
        const CHUNK = 8192;
        let binary = '';
        for (let i = 0; i < uint8Array.length; i += CHUNK) {
            const slice = uint8Array.subarray(i, i + CHUNK);
            binary += String.fromCharCode.apply(null, slice as unknown as number[]);
        }
        return btoa(binary);
    };

    // --- WebSocket ---

    // --- Mic → Server ---

    const handleAudioStream = async (event: any) => {
        if (isAISpeaking.current || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
            if (isAISpeaking.current) {
                // Mic Gating: Ignore input while AI is speaking
            }
            return;
        }

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
            // playChime(); // Optional: chime on start if desired

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
                    instructions: `You are a high-speed, professional TRANSLATION BRIDGE. 
                    
                    PERSONA:
                    - You are a passive passthrough module.
                    - When speaking ${langA}, you take on the identity of a NATIVE ${langA} speaker with a perfect, natural regional accent.
                    - When speaking ${langB}, you take on the identity of a NATIVE ${langB} speaker with a perfect, natural regional accent.
                    - You NEVER speak the SAME language as the input.
                    - You NEVER answer questions. You only TRANSLATE them.
                    - You NEVER engage in conversation.
                    - You MUST be a literal translator. No conversational filler.
                    
                    LANGUAGE RESTRICTION:
                    - You ONLY handle ${langA} and ${langB}.
                    - If you hear any other language (e.g. Chinese, Spanish, or noise), IGNORE IT COMPLETELY. 
                    - Treats non-${langA}/non-${langB} audio as background noise/silence.
                    
                    BIDIRECTIONAL LOGIC:
                    - You are a bridge between ${langA} and ${langB}.
                    - IF the user speaks ${langA}, you MUST translate it into ${langB}.
                    - IF the user speaks ${langB}, you MUST translate it into ${langA}.
                    - Continuously listen for both languages and swap the target language automatically based on what you hear.
                    
                    EXAMPLES:
                    1. Input (${langA}): "Where is the nearest pharmacy?"
                       Output: "(Precise translation into ${langB})"
                    2. Input (${langB}): "My stomach hurts."
                       Output: "(Precise translation into ${langA})"
                    3. Input (Question): "What is your name?"
                       Output: "Translation of 'What is your name?' into target language"
                    
                    CRITICAL: 
                    - Output ONLY the plain translation.
                    - NEVER include language tags, brackets, or codes like [en] or [ar] in your response.
                    - DO NOT provide help, DO NOT answer questions, DO NOT provide medical advice.
                    - TRANSLATE EVERYTHING LITERALLY.
                    `,
                    modalities: ['text', 'audio'],
                    voice: 'shimmer',
                    temperature: 0.6,
                    turn_detection: {
                        type: 'server_vad',
                        // Lowered from 0.8 → 0.7: 0.8 might have been too aggressive.
                        threshold: 0.7,
                        prefix_padding_ms: 300,
                        // Extended from 1000 → 1200ms: gives more breathing room
                        // before the model decides the speaker has finished
                        silence_duration_ms: 1200
                    },
                    input_audio_format: 'pcm16',
                    input_audio_transcription: {
                        model: 'whisper-1',
                    }
                }
            }));
        };

        ws.current.onmessage = (event) => {
            const msg: WebSocketMessage = JSON.parse(event.data);
            if (msg.type !== 'input_audio_buffer.append') {
                console.log('📡 WS Event:', msg.type);
            }
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

                case 'conversation.item.input_audio_transcription.completed':
                    console.log('🎤 Input transcription completed:', msg.transcript);
                    setTranscript(msg.transcript || '');
                    pendingTranscript.current = msg.transcript || '';
                    tryPersistLiveTurn();
                    break;

                case 'response.text.delta':
                case 'response.audio_transcript.delta':
                    if (msg.response_id !== currentResponseId.current) {
                        currentResponseId.current = msg.response_id || null;
                        setTranslation(msg.delta || '');
                    } else {
                        setTranslation(prev => prev + (msg.delta || ''));
                    }
                    break;

                case 'response.audio_transcript.done':
                    if (msg.transcript) {
                        console.log('🤖 AI translation completed:', msg.transcript);
                        setTranslation(msg.transcript);
                        pendingTranslation.current = msg.transcript;
                        tryPersistLiveTurn();
                    }
                    break;

                case 'response.audio.delta':
                    if (msg.delta) audioDeltas.current.push(msg.delta);
                    break;

                case 'response.audio.done':
                    playOpenAIAudio(); // Play the accumulated audio
                    break;

                case 'input_audio_buffer.speech_started':
                    console.log('🎙️ Speech started');
                    setIsSpeaking(true);
                    setTranscript(''); // Clear previous for a fresh 'Live' feel
                    setTranslation('');
                    audioDeltas.current = []; // Clear any stale audio deltas
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    // If AI is still speaking from previous turn, stop it
                    if (audioPlayer.current) {
                        audioPlayer.current.stopAsync().catch(() => { });
                        isAISpeaking.current = false;
                    }
                    break;

                case 'input_audio_buffer.speech_stopped':
                    console.log('🛑 Speech stopped');
                    setIsSpeaking(false);
                    Haptics.selectionAsync();
                    break;

                case 'response.done':
                    // Final cleanup or state reset if needed
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

            // Create a new live conversation row for this session
            liveMessageCount.current = 0;
            pendingTranscript.current = '';
            pendingTranslation.current = '';
            const { data: conv, error: convError } = await supabase
                .from('conversations')
                .insert({ user_id: session.user.id, target_lang: langB, mode: 'live', lang_a: langA })
                .select()
                .single();
            if (!convError && conv) {
                liveConversationId.current = conv.id;
                console.log('📝 Live conversation created:', conv.id);
            } else {
                console.error('Failed to create live conversation:', convError?.message);
            }

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

        if (audioPlayer.current) {
            try { await audioPlayer.current.stopAsync(); await audioPlayer.current.unloadAsync(); } catch { }
            audioPlayer.current = null;
        }

        isAISpeaking.current = false;
        audioDeltas.current = [];

        if (ws.current) { ws.current.close(); ws.current = null; }
        try { await stopRecording(); } catch { }

        // Clean up empty live session (no turns were spoken)
        if (liveConversationId.current && liveMessageCount.current === 0) {
            supabase.from('conversations').delete()
                .eq('id', liveConversationId.current)
                .then(() => console.log('🗑️ Empty live session removed'));
        }
        liveConversationId.current = null;
        liveMessageCount.current = 0;
        pendingTranscript.current = '';
        pendingTranslation.current = '';

        setIsConnected(false);
        setTranscript('');
        setTranslation('');
        setIsSpeaking(false);
    }, [stopRecording]);

    useEffect(() => { return () => { disconnect(); }; }, [disconnect]);

    return { isConnected, isSpeaking, transcript, translation, connect, disconnect, isRecording };
};