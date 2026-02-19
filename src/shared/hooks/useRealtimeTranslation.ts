import { supabase } from '@/src/services/supabase';
import { useAudioRecorder } from '@siteed/expo-audio-studio';
import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';

// TypeScript interfaces for WebSocket messages
interface WebSocketMessage {
    type: string;
    item_id?: string;
    response_id?: string;
    delta?: string;
    [key: string]: any;
}

export const useRealtimeTranslation = (targetLang: string) => {
    // UI States
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [translation, setTranslation] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);

    // Core Refs
    const ws = useRef<WebSocket | null>(null);
    const { startRecording, stopRecording, isRecording } = useAudioRecorder();
    const soundRef = useRef<Audio.Sound | null>(null);

    // Gating & Playback Management
    const isAIPresenting = useRef(false);
    const audioQueue = useRef<string[]>([]);
    const pcmBuffer = useRef<Uint8Array>(new Uint8Array(0));
    const isPlaying = useRef(false);
    const currentResponseId = useRef<string | null>(null);
    const currentItemId = useRef<string | null>(null);
    const playbackInterval = useRef<NodeJS.Timeout | null>(null);
    const playbackTimeout = useRef<NodeJS.Timeout | null>(null);
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

    const connect = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            // Consolidate Audio Session Configuration
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
                staysActiveInBackground: true, // KEEP ALIVE in background
                shouldDuckAndroid: true,
                interruptionModeIOS: 2, // Mix with others
            });

            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
            const functionUrl = supabaseUrl.replace('https://', 'wss://') + '/functions/v1/realtime-relay';

            // @ts-ignore: Headers supported in React Native WebSockets
            ws.current = new WebSocket(functionUrl, undefined, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            ws.current.onopen = async () => {
                setIsConnected(true);

                heartbeatInterval.current = setInterval(() => {
                    if (ws.current?.readyState === WebSocket.OPEN) {
                        // Send a lightweight heartbeat to keep the relay alive
                        ws.current.send(JSON.stringify({ type: 'client.heartbeat' }));
                    }
                }, 30000) as unknown as NodeJS.Timeout;

                // Initialize session with EXPLICIT Instructions
                const sessionUpdate = {
                    type: 'session.update',
                    session: {
                        instructions: `YOU ARE A PASSIVE SIMULTANEOUS TRANSLATION SERVER.
                        TARGET LANGUAGE: ${targetLang}
                        RULES: 
                        1. TRANSLATE EVERYTHING. 
                        2. NEVER ANSWER QUESTIONS. 
                        3. NEVER ENGAGE IN CONVERSATION.
                        OUTPUT: LITERAL TRANSLATION ONLY.`,
                        voice: 'shimmer',
                        temperature: 0.6,
                        modalities: ['audio', 'text'],
                        turn_detection: {
                            type: 'server_vad',
                            threshold: 0.5,
                            prefix_padding_ms: 300,
                            silence_duration_ms: 500
                        },
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        input_audio_transcription: { model: 'whisper-1' }
                    }
                };
                console.log('📨 Sending session.update');
                ws.current?.send(JSON.stringify(sessionUpdate));

                // Session already configured in connect()

                try {
                    await startRecording({
                        sampleRate: 16000,
                        channels: 1,
                        encoding: 'pcm_16bit',
                        interval: 100,
                        ios: {
                            audioSession: {
                                category: 'PlayAndRecord',
                                mode: 'VideoChat', // FIX: Better for speaker output than VoiceChat
                                categoryOptions: ['DefaultToSpeaker', 'AllowBluetooth', 'MixWithOthers']
                            }
                        },
                        onAudioStream: handleAudioStream
                    });
                } catch (err) {
                    console.error('Microphone start error:', err);
                }
            };

            ws.current.onmessage = (event) => {
                const message: WebSocketMessage = JSON.parse(event.data);
                console.log('📨 WebSocket message:', message.type, message.response_id ? `(response: ${message.response_id})` : '');

                if (message.type === 'response.done') {
                    console.log('✅ Response done - flushing PCM buffer and clearing server buffer');
                    flushPcmBuffer();
                    // EXPLICIT CLEAR: Prevent server from re-processing the same audio turn
                    if (ws.current?.readyState === WebSocket.OPEN) {
                        ws.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
                    }
                }

                switch (message.type) {
                    case 'conversation.item.input_audio_transcription.delta':
                        if (message.item_id !== currentItemId.current) {
                            currentItemId.current = message.item_id || null;
                            setTranscript(message.delta || '');
                        } else {
                            setTranscript(prev => prev + (message.delta || ''));
                        }
                        break;
                    case 'response.audio_transcript.delta':
                        if (message.response_id !== currentResponseId.current) {
                            currentResponseId.current = message.response_id || null;
                            setTranslation(message.delta || '');
                        } else {
                            setTranslation(prev => prev + (message.delta || ''));
                        }
                        break;
                    case 'response.audio.delta':
                        if (message.delta) {
                            console.log('🎵 Audio chunk received, queue length:', audioQueue.current.length);
                            handleAudioChunk(message.delta);
                        }
                        break;
                    case 'input_audio_buffer.speech_started':
                        console.log('🗣️ Speech started detected by server - preparing fresh buffer');
                        setIsSpeaking(true);
                        // Ensure a fresh start for this turn
                        if (ws.current?.readyState === WebSocket.OPEN) {
                            ws.current.send(JSON.stringify({ type: 'input_audio_buffer.clear' }));
                        }
                        break;
                    case 'input_audio_buffer.speech_stopped':
                        console.log('🛑 Speech stopped detected by server');
                        setIsSpeaking(false);
                        break;
                    case 'error':
                        console.error('❌ OpenAI Error Message:', message.error?.message);
                        console.error('❌ Error Details:', JSON.stringify(message.error, null, 2));
                        break;
                }
            };

            ws.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                setIsConnected(false);
            };

            ws.current.onclose = (event) => {
                console.log('❌ WebSocket closed - code:', event.code, 'reason:', event.reason, 'wasClean:', event.wasClean);
                setIsConnected(false);
                // NEW: Stop recording if connection drops unexpectedly
                stopRecording().catch(e => console.error('Error stopping recording on close:', e));
            };
        } catch (error: any) {
            console.error('Connection error:', error);
            setIsConnected(false);
        }
    };

    // Extracted audio stream handler to eliminate duplication
    const handleAudioStream = async (event: any) => {
        console.log('🎙️ Audio stream event - isAIPresenting:', isAIPresenting.current, 'ws:', !!ws.current, 'readyState:', ws.current?.readyState);

        // THE GATE: If AI is speaking, ignore microphone input to prevent feedback
        if (isAIPresenting.current || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
            // SILENT in logs when CLOSED to avoid infinite terminal spam
            if (ws.current?.readyState === WebSocket.OPEN) {
                console.log('⛔ Audio blocked - isAIPresenting:', isAIPresenting.current);
            }
            return;
        }

        console.log('✅ Processing audio stream');
        try {
            const binaryString = atob(event.data as string);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const pcm16 = new Int16Array(bytes.buffer);

            // Linear Upsampling: 16kHz -> 24kHz (1.5x ratio)
            const outputLength = Math.floor(pcm16.length * 1.5);
            const upsampled = new Int16Array(outputLength);
            for (let i = 0; i < pcm16.length - 1; i++) {
                const outIdx = Math.floor(i * 1.5);
                upsampled[outIdx] = pcm16[i];
                if (outIdx + 1 < outputLength) {
                    upsampled[outIdx + 1] = Math.round((pcm16[i] + pcm16[i + 1]) / 2);
                }
            }
            if (outputLength > 0) upsampled[outputLength - 1] = pcm16[pcm16.length - 1];

            const upsampledBytes = new Uint8Array(upsampled.buffer);
            const base64Audio = uint8ArrayToBase64(upsampledBytes);
            ws.current.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: base64Audio
            }));
        } catch (err) {
            console.error('Stream processing error:', err);
        }
    };

    const handleAudioChunk = (base64: string) => {
        try {
            const pcmData = base64ToUint8Array(base64);
            const newBuffer = new Uint8Array(pcmBuffer.current.length + pcmData.length);
            newBuffer.set(pcmBuffer.current);
            newBuffer.set(pcmData, pcmBuffer.current.length);
            pcmBuffer.current = newBuffer;

            // Buffer threshold for playback (1s at 24kHz)
            if (pcmBuffer.current.length > 48000) flushPcmBuffer();
        } catch (err) {
            console.error('Audio chunk processing error:', err);
        }
    };

    const flushPcmBuffer = () => {
        if (pcmBuffer.current.length === 0) {
            console.log('⚠️ Flush called but buffer is empty');
            return;
        }
        const pcmData = pcmBuffer.current;
        pcmBuffer.current = new Uint8Array(0);

        const header = new Uint8Array(createWavHeader(pcmData.byteLength, 24000));
        const combined = new Uint8Array(header.byteLength + pcmData.byteLength);
        combined.set(header);
        combined.set(pcmData, header.byteLength);

        audioQueue.current.push(`data:audio/wav;base64,${uint8ArrayToBase64(combined)}`);

        // Limit queue size to prevent unbounded memory growth (keep last 10 chunks)
        if (audioQueue.current.length > 10) {
            console.warn('⚠️ Audio queue too large, dropping oldest chunks');
            audioQueue.current = audioQueue.current.slice(-10);
        }

        console.log('📥 Audio added to queue, new queue length:', audioQueue.current.length, 'isPlaying:', isPlaying.current);

        if (!isPlaying.current) {
            console.log('▶️ Starting playback from flush');
            playNextInQueue();
        }
    };

    const playNextInQueue = async () => {
        if (audioQueue.current.length === 0) {
            console.log('🎤 Queue empty - releasing microphone gate');
            isPlaying.current = false;
            isAIPresenting.current = false; // RELEASE GATE: App can listen again
            return;
        }

        console.log('🔊 Playing audio - activating microphone gate');
        isPlaying.current = true;
        isAIPresenting.current = true; // ACTIVATE GATE: Ignore mic data during playback

        const nextWav = audioQueue.current.shift();
        if (nextWav) {
            try {
                console.log('🎬 Attempting to load and play audio...');

                // Unload previous sound if exists
                if (soundRef.current) {
                    console.log('🗑️ Unloading previous sound');
                    await soundRef.current.unloadAsync();
                    soundRef.current = null;
                }

                // Create new sound instance with optimized settings
                const { sound } = await Audio.Sound.createAsync(
                    { uri: nextWav },
                    {
                        shouldPlay: true,
                        progressUpdateIntervalMillis: 100,
                        rate: 1.0,
                        shouldCorrectPitch: true,
                    },
                    (status) => {
                        // Playback status callback
                        if (status.isLoaded && status.didJustFinish) {
                            console.log('✅ Playback finished - cleaning up sound');

                            // Aggressive cleanup: unload immediately
                            if (soundRef.current) {
                                soundRef.current.unloadAsync().catch(e => console.error('Error unloading finished sound:', e));
                                soundRef.current = null;
                            }

                            if (playbackInterval.current) {
                                clearInterval(playbackInterval.current);
                                playbackInterval.current = null;
                            }
                            if (playbackTimeout.current) {
                                clearTimeout(playbackTimeout.current);
                                playbackTimeout.current = null;
                            }
                            playNextInQueue();
                        }
                    }
                );

                soundRef.current = sound;
                console.log('▶️ Playback started successfully');

                // Safety timeout: if playback doesn't finish in 30s, force continue
                playbackTimeout.current = setTimeout(() => {
                    console.warn('⚠️ Playback timeout - forcing next in queue');
                    if (playbackInterval.current) {
                        clearInterval(playbackInterval.current);
                        playbackInterval.current = null;
                    }
                    playNextInQueue();
                }, 30000) as unknown as NodeJS.Timeout;
            } catch (err) {
                console.error('Audio playback error:', err);
                // Continue to next in queue on error
                playNextInQueue();
            }
        }
    };

    const createWavHeader = (dataLength: number, sampleRate: number) => {
        const buffer = new ArrayBuffer(44);
        const view = new DataView(buffer);
        const writeString = (v: DataView, o: number, s: string) => {
            for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
        };
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 32 + dataLength, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        return buffer;
    };

    const base64ToUint8Array = (base64: string) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return bytes;
    };

    const uint8ArrayToBase64 = (uint8Array: Uint8Array) => {
        // More efficient conversion for React Native
        const CHUNK_SIZE = 8192;
        let binary = '';
        for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
            const chunk = uint8Array.subarray(i, i + CHUNK_SIZE);
            binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
        }
        return btoa(binary);
    };

    const disconnect = useCallback(async () => {
        console.log('🔌 DISCONNECT CALLED');
        console.trace('Disconnect stack trace');
        // Clear playback interval and timeout
        if (playbackInterval.current) {
            clearInterval(playbackInterval.current);
            playbackInterval.current = null;
        }
        if (playbackTimeout.current) {
            clearTimeout(playbackTimeout.current);
            playbackTimeout.current = null;
        }
        if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
            heartbeatInterval.current = null;
        }

        // Stop audio player
        try {
            if (soundRef.current) {
                await soundRef.current.unloadAsync();
                soundRef.current = null;
            }
        } catch (e) {
            console.error('Error stopping sound:', e);
        }

        // Clear audio queue and buffers
        audioQueue.current = [];
        pcmBuffer.current = new Uint8Array(0);
        isPlaying.current = false;
        isAIPresenting.current = false;

        // Close WebSocket
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        // Stop recording
        try {
            await stopRecording();
        } catch (e) {
            console.error('Error stopping recording:', e);
        }

        // Reset state
        setIsConnected(false);
        setTranscript('');
        setTranslation('');
        setIsSpeaking(false);

        // Final aggressive cleanup
        soundRef.current = null;
    }, [stopRecording]);

    // HOT TRANSLATION: No manual pause/resume needed
    // The automatic gating via isAIPresenting handles everything

    useEffect(() => { return () => { disconnect(); }; }, [disconnect]);

    return {
        isConnected, isSpeaking, transcript, translation,
        connect, disconnect, isRecording
    };
};