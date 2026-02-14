import { supabase } from '@/src/services/supabase';
import { useAudioRecorder } from '@siteed/expo-audio-studio';
import { useCallback, useEffect, useRef, useState } from 'react';

export const useRealtimeTranslation = (targetLang: string) => {
    const [isConnected, setIsConnected] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [translation, setTranslation] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);

    const ws = useRef<WebSocket | null>(null);
    const { startRecording, stopRecording, isRecording } = useAudioRecorder();

    const connect = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

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

                // Initialize session with instructions
                const sessionUpdate = {
                    type: 'session.update',
                    session: {
                        instructions: `You are a simultaneous translator for a live documentary. 
                        Translate everything the user says into ${targetLang}. 
                        Keep translations natural and authoritative. 
                        Respond with audio. Use the 'ash' voice. 
                        Output format should be pcm16 at 24kHz.`,
                        voice: 'ash',
                        turn_detection: { type: 'server_vad' },
                        input_audio_format: 'pcm16',
                        output_audio_format: 'pcm16',
                        input_audio_transcription: { model: 'whisper-1' }
                    }
                };
                ws.current?.send(JSON.stringify(sessionUpdate));

                // Start audio streaming from mic
                try {
                    await startRecording({
                        sampleRate: 16000,
                        channels: 1,
                        encoding: 'pcm_16bit',
                        interval: 100, // Send chunks every 100ms
                        onAudioStream: async (event) => {
                            if (ws.current?.readyState === WebSocket.OPEN) {
                                ws.current.send(JSON.stringify({
                                    type: 'input_audio_buffer.append',
                                    audio: event.data // This is the base64 chunk
                                }));
                            }
                        }
                    });
                    console.log('Mic streaming started');
                } catch (err) {
                    console.error('Failed to start mic streaming:', err);
                }
            };

            ws.current.onmessage = (event) => {
                const message = JSON.parse(event.data);

                switch (message.type) {
                    case 'response.audio_transcription.delta':
                        setTranscript(prev => prev + message.delta);
                        break;
                    case 'response.audio_transcription.completed':
                        setTranscript(message.transcript);
                        break;
                    case 'response.text.delta':
                        setTranslation(prev => prev + message.delta);
                        break;
                    case 'response.audio.delta':
                        // Handle audio playback (Base64 PCM16 24kHz)
                        handleAudioChunk(message.delta);
                        break;
                    case 'input_audio_buffer.speech_started':
                        setIsSpeaking(true);
                        setTranscript('');
                        setTranslation('');
                        break;
                    case 'input_audio_buffer.speech_stopped':
                        setIsSpeaking(false);
                        break;
                    case 'error':
                        console.error('Realtime API Error:', message.error);
                        break;
                }
            };

            ws.current.onerror = (e) => {
                console.error('WebSocket Error:', e);
            };

            ws.current.onclose = () => {
                console.log('WebSocket Closed');
                setIsConnected(false);
                stopRecording();
            };

        } catch (error) {
            console.error('Connection failed:', error);
        }
    };

    const handleAudioChunk = (base64Chunk: string) => {
        // Playback logic will go here
        // We might need to accumulate chunks or use a specific streaming player
    };

    const disconnect = useCallback(async () => {
        await stopRecording();
        ws.current?.close();
        ws.current = null;
        setIsConnected(false);
    }, [stopRecording]);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        isSpeaking,
        transcript,
        translation,
        connect,
        disconnect,
        isRecording
    };
};
