import { supabase } from '@/src/services/supabase';
import { useAudioRecorder } from '@siteed/expo-audio-studio';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

export const useRealtimeTranslation = (targetLang: string) => {
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [translation, setTranslation] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    const ws = useRef<WebSocket | null>(null);
    const { startRecording, stopRecording, isRecording } = useAudioRecorder();
    const player = useAudioPlayer();
    const audioQueue = useRef<string[]>([]);
    const pcmBuffer = useRef<Uint8Array>(new Uint8Array(0));
    const isPlaying = useRef(false);
    const currentResponseId = useRef<string | null>(null);
    const currentItemId = useRef<string | null>(null);
    const playbackInterval = useRef<NodeJS.Timeout | null>(null);

    const connect = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            // Enforce audio routing to speaker (not earpiece) even when recording
            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: true,
                shouldRouteThroughEarpiece: false,
                interruptionMode: 'doNotMix',
                shouldPlayInBackground: true,
            });

            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
            const functionUrl = supabaseUrl.replace('https://', 'wss://') + '/functions/v1/realtime-relay';

            console.log('Connecting to Realtime Relay:', functionUrl);

            // @ts-ignore: WebSocket in React Native supports a third argument for headers
            ws.current = new WebSocket(functionUrl, undefined, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            ws.current.onopen = async () => {
                console.log('WebSocket Connected');
                setIsConnected(true);

                // Initialize session with EXPLICIT instructions
                const sessionUpdate = {
                    type: 'session.update',
                    session: {
                        instructions: `YOU ARE A PASSIVE SIMULTANEOUS TRANSLATION SERVER.
                        TARGET LANGUAGE: ${targetLang}
                        
                        CORE RULES:
                        1. TRANSLATE EVERYTHING. 
                        2. NEVER ANSWER QUESTIONS. 
                        3. NEVER ENGAGE IN CONVERSATION.
                        4. IF THE USER ASKS "Where are you?", YOU TRANSLATE IT. DO NOT ANSWER.
                        5. IF THE USER SAYS "Hello", YOU TRANSLATE "Hello".
                        
                        OUTPUT: LITERAL TRANSLATION ONLY.`,
                        voice: 'shimmer',
                        temperature: 0.6,
                        modalities: ['audio', 'text'], // Must include text or be text-only per API rules
                        turn_detection: {
                            type: 'server_vad',
                            threshold: 0.6, // Higher to suppress feedback triggers
                            prefix_padding_ms: 300,
                            silence_duration_ms: 600
                        },
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        input_audio_transcription: { model: 'whisper-1' }
                    }
                };
                ws.current?.send(JSON.stringify(sessionUpdate));

                // Start audio streaming from mic
                try {
                    console.log('Starting mic stream (16kHz)...');
                    await startRecording({
                        sampleRate: 16000,
                        channels: 1,
                        encoding: 'pcm_16bit',
                        interval: 100,
                        ios: {
                            audioSession: {
                                category: 'PlayAndRecord',
                                mode: 'VoiceChat', // Hardware echo cancellation
                                categoryOptions: ['DefaultToSpeaker', 'AllowBluetooth']
                            }
                        },
                        android: {
                            audioFocusStrategy: 'communication'
                        },
                        onAudioStream: async (event) => {
                            const audioData = event.data as string;
                            if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !audioData) return;

                            try {
                                // Decode base64 to Int16 PCM samples
                                const binaryString = atob(event.data);
                                const bytes = new Uint8Array(binaryString.length);
                                for (let i = 0; i < binaryString.length; i++) {
                                    bytes[i] = binaryString.charCodeAt(i);
                                }
                                const pcm16 = new Int16Array(bytes.buffer);

                                // Upsample 16kHz -> 24kHz using linear interpolation
                                // For every 2 input samples, generate 3 output samples (1.5x ratio)
                                const outputLength = Math.floor(pcm16.length * 1.5);
                                const upsampled = new Int16Array(outputLength);

                                for (let i = 0; i < pcm16.length - 1; i++) {
                                    const outIdx = Math.floor(i * 1.5);
                                    upsampled[outIdx] = pcm16[i];

                                    // Linear interpolation for the middle sample
                                    if (outIdx + 1 < outputLength) {
                                        upsampled[outIdx + 1] = Math.round((pcm16[i] + pcm16[i + 1]) / 2);
                                    }
                                }
                                // Last sample
                                if (outputLength > 0) {
                                    upsampled[outputLength - 1] = pcm16[pcm16.length - 1];
                                }

                                // Re-encode to base64
                                const upsampledBytes = new Uint8Array(upsampled.buffer);
                                let binary = '';
                                for (let i = 0; i < upsampledBytes.length; i++) {
                                    binary += String.fromCharCode(upsampledBytes[i]);
                                }

                                ws.current.send(JSON.stringify({
                                    type: 'input_audio_buffer.append',
                                    audio: btoa(binary)
                                }));
                            } catch (err) {
                                console.error('Upsampling error:', err);
                            }
                        }
                    });
                } catch (err) {
                    console.error('Mic error:', err);
                }
            };

            ws.current.onmessage = (event) => {
                const message = JSON.parse(event.data);

                // Detailed logging for diagnostics
                if (message.type === 'response.done') {
                    console.log('Response Done Details:', JSON.stringify(message.response.status_details || message.response.status));
                    flushPcmBuffer(); // Play remaining audio
                }

                if (message.type !== 'input_audio_buffer.append' && message.type !== 'input_audio_buffer.committed' && message.type !== 'response.audio.delta') {
                    console.log('App <- Relay:', message.type);
                }

                switch (message.type) {
                    // USER SPEECH (Input)
                    case 'conversation.item.input_audio_transcription.delta':
                        if (message.item_id !== currentItemId.current) {
                            setTranscript(message.delta);
                            currentItemId.current = message.item_id;
                        } else {
                            setTranscript(prev => prev + message.delta);
                        }
                        break;
                    case 'conversation.item.input_audio_transcription.completed':
                        console.log('User said:', message.transcript);
                        setTranscript(message.transcript);
                        break;

                    // TRANSLATION (Output)
                    case 'response.text.delta':
                        setTranslation(prev => prev + message.delta);
                        break;
                    case 'response.audio_transcript.delta':
                        if (message.response_id !== currentResponseId.current) {
                            setTranslation(message.delta);
                            currentResponseId.current = message.response_id;
                        } else {
                            setTranslation(prev => prev + message.delta);
                        }
                        break;

                    case 'response.audio.delta':
                        handleAudioChunk(message.delta);
                        break;

                    case 'input_audio_buffer.speech_started':
                        setIsSpeaking(true);
                        // REMOVED: setTranscript(''); - Stay on screen until new transcription starts
                        // REMOVED: setTranslation(''); - Stay on screen until new response starts
                        // DON'T clear audio queue/buffer - let translation finish playing
                        break;
                    case 'input_audio_buffer.speech_stopped':
                        console.log('Speech stopped - clearing buffer for next utterance');
                        setIsSpeaking(false);
                        // Clear the input buffer to prevent echo/feedback from confusing VAD
                        if (ws.current?.readyState === WebSocket.OPEN) {
                            ws.current.send(JSON.stringify({
                                type: 'input_audio_buffer.clear'
                            }));
                        }
                        break;
                    case 'error':
                        console.error('Realtime API Error:', JSON.stringify(message.error));
                        break;
                }
            };

            ws.current.onerror = (e) => {
                console.error('WebSocket Error:', e);
            };

            ws.current.onclose = async () => {
                console.log('WebSocket Closed');
                setIsConnected(false);
                try {
                    await stopRecording();
                } catch (e) {
                    // Ignore
                }
            };

        } catch (error: any) {
            console.error('Connection failed:', error);
            setIsConnected(false);
        }
    };

    const handleAudioChunk = (base64: string) => {
        try {
            const pcmData = base64ToUint8Array(base64);

            // Buffer PCM data instead of playing tiny chunks
            const newBuffer = new Uint8Array(pcmBuffer.current.length + pcmData.length);
            newBuffer.set(pcmBuffer.current);
            newBuffer.set(pcmData, pcmBuffer.current.length);
            pcmBuffer.current = newBuffer;

            // Accumulate ~500ms of audio for smoother playback (24kHz * 2 bytes = 48KB/sec, so 24KB = 500ms)
            // 24000 samples * 2 bytes = 48000 bytes. pcmData is Uint8Array (bytes).
            if (pcmBuffer.current.length > 24000) {
                flushPcmBuffer();
            }
        } catch (e) {
            console.error('Error processing audio chunk:', e);
        }
    };

    const flushPcmBuffer = () => {
        if (pcmBuffer.current.length === 0) return;

        const pcmData = pcmBuffer.current;
        pcmBuffer.current = new Uint8Array(0);

        const header = new Uint8Array(createWavHeader(pcmData.byteLength, 24000));
        const combined = new Uint8Array(header.byteLength + pcmData.byteLength);
        combined.set(header);
        combined.set(pcmData, header.byteLength);

        const wavDataUri = `data:audio/wav;base64,${uint8ArrayToBase64(combined)}`;
        audioQueue.current.push(wavDataUri);

        if (!isPlaying.current) {
            playNextInQueue();
        }
    };

    const playNextInQueue = async () => {
        if (audioQueue.current.length === 0) {
            isPlaying.current = false;
            return;
        }

        isPlaying.current = true;
        const nextWav = audioQueue.current.shift();
        if (nextWav) {
            try {
                player.replace(nextWav);
                player.play();

                if (playbackInterval.current) clearInterval(playbackInterval.current);

                playbackInterval.current = setInterval(() => {
                    if (!player.playing && player.isLoaded) {
                        if (playbackInterval.current) {
                            clearInterval(playbackInterval.current);
                            playbackInterval.current = null;
                        }
                        isPlaying.current = false;
                        playNextInQueue();
                    }
                }, 16);
            } catch (e) {
                console.warn('Playback error:', e);
                isPlaying.current = false;
                playNextInQueue();
            }
        }
    };

    const createWavHeader = (dataLength: number, sampleRate: number) => {
        const buffer = new ArrayBuffer(44);
        const view = new DataView(buffer);
        const writeString = (view: DataView, offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
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
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    };

    const uint8ArrayToBase64 = (uint8Array: Uint8Array) => {
        let binary = '';
        const len = uint8Array.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binary);
    };

    const disconnect = useCallback(async () => {
        if (playbackInterval.current) {
            clearInterval(playbackInterval.current);
            playbackInterval.current = null;
        }
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
        try {
            await stopRecording();
        } catch (e) {
            // Ignore
        }
        setIsConnected(false);
        setIsPaused(false);
    }, [stopRecording]);

    const pause = useCallback(async () => {
        if (!isConnected || isPaused) return;
        try {
            await stopRecording();
            setIsPaused(true);
            console.log('[Realtime] Session paused');
        } catch (e) {
            console.error('[Realtime] Pause error:', e);
        }
    }, [isConnected, isPaused, stopRecording]);

    const resume = useCallback(async () => {
        if (!isConnected || !isPaused || !ws.current) return;
        try {
            console.log('[Realtime] Resuming...');
            await startRecording({
                sampleRate: 16000,
                channels: 1,
                encoding: 'pcm_16bit',
                interval: 100,
                ios: {
                    audioSession: {
                        category: 'PlayAndRecord',
                        mode: 'VoiceChat',
                        categoryOptions: ['DefaultToSpeaker', 'AllowBluetooth']
                    }
                },
                android: {
                    audioFocusStrategy: 'communication'
                },
                onAudioStream: async (event) => {
                    const audioData = event.data as string;
                    if (!ws.current || ws.current.readyState !== WebSocket.OPEN || !audioData) return;

                    try {
                        const binaryString = atob(event.data);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const pcm16 = new Int16Array(bytes.buffer);

                        const outputLength = Math.floor(pcm16.length * 1.5);
                        const upsampled = new Int16Array(outputLength);

                        for (let i = 0; i < pcm16.length - 1; i++) {
                            const outIdx = Math.floor(i * 1.5);
                            upsampled[outIdx] = pcm16[i];
                            if (outIdx + 1 < outputLength) {
                                upsampled[outIdx + 1] = Math.round((pcm16[i] + pcm16[i + 1]) / 2);
                            }
                        }
                        if (outputLength > 0) {
                            upsampled[outputLength - 1] = pcm16[pcm16.length - 1];
                        }

                        const upsampledBytes = new Uint8Array(upsampled.buffer);
                        let binary = '';
                        for (let i = 0; i < upsampledBytes.length; i++) {
                            binary += String.fromCharCode(upsampledBytes[i]);
                        }

                        ws.current.send(JSON.stringify({
                            type: 'input_audio_buffer.append',
                            audio: btoa(binary)
                        }));
                    } catch (err) {
                        console.error('Upsampling error:', err);
                    }
                }
            });
            setIsPaused(false);
            console.log('[Realtime] Resumed');
        } catch (e) {
            console.error('[Realtime] Resume error:', e);
        }
    }, [isConnected, isPaused, startRecording]);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        isSpeaking,
        isPaused,
        transcript,
        translation,
        connect,
        disconnect,
        pause,
        resume,
        isRecording
    };
};
