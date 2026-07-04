import { supabase } from '@/src/services/supabase';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import InCallManager from 'react-native-incall-manager';
import { MediaStream, RTCPeerConnection, mediaDevices } from 'react-native-webrtc';

const OPENAI_CALLS_URL = 'https://api.openai.com/v1/realtime/calls';
// How long to keep the mic muted after the AI finishes speaking, so its own tail of audio
// can't be picked back up by the mic and mistaken for new user speech.
const DEFAULT_MIC_HANGOVER_MS = 1500;

export const useRealtimeTranslation = (langA: string, langB: string) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [translation, setTranslation] = useState('');
    const [isSpeaking, setIsSpeaking] = useState(false);

    const localStream = useRef<MediaStream | null>(null);
    const pc = useRef<RTCPeerConnection | null>(null);
    const generation = useRef(0);
    const micHangoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentResponseId = useRef<string | null>(null);

    // Live session persistence
    const liveConversationId = useRef<string | null>(null);
    const pendingTranscript = useRef('');
    const pendingTranslation = useRef('');
    const liveMessageCount = useRef(0);

    const tryPersistLiveTurn = useCallback(() => {
        if (!liveConversationId.current || !pendingTranscript.current || !pendingTranslation.current) return;

        const original = pendingTranscript.current;
        const translated = pendingTranslation.current;
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
            } else {
                liveMessageCount.current += 1;
            }
        });
    }, []);

    // Temporary diagnostic logging — every line is prefixed with ms since connect() so the
    // event sequence can be reconstructed from Metro output while debugging.
    const sessionStartTime = useRef(0);
    const log = (...args: any[]) => {
        const t = sessionStartTime.current ? Date.now() - sessionStartTime.current : 0;
        console.log(`[RT +${t}ms]`, ...args);
    };

    const setLocalMicEnabled = (enabled: boolean) => {
        const tracks = localStream.current?.getAudioTracks() ?? [];
        log(`LOCAL MIC -> ${enabled ? 'ON' : 'OFF'} (tracks: ${tracks.length})`);
        tracks.forEach(t => { t.enabled = enabled; });
    };

    // NOTE: deliberately no audible chime here. The old expo-audio chime called
    // setAudioModeAsync, which reconfigured the iOS AVAudioSession behind InCallManager's
    // back and killed WebRTC's voice input unit — the mic went permanently silent after the
    // first response. Haptics are safe; anything touching the audio session is not.
    const signalYourTurn = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
    };

    // Cut the local mic the instant the model starts speaking, so its own translated audio
    // can never be picked back up by the mic and misread as new speech (the model runs
    // server-side VAD with interrupt_response enabled, so leaked audio could otherwise cause
    // it to interrupt itself). response.done is the authoritative "fully finished" signal —
    // far more precise than guessing from a gap in transcript deltas.
    const handleServerEvent = (raw: string) => {
        let msg: any;
        try { msg = JSON.parse(raw); } catch { return; }

        switch (msg.type) {
            case 'conversation.item.input_audio_transcription.delta':
                log(`INPUT delta="${msg.delta}"`);
                if (msg.delta) setTranscript(prev => prev + msg.delta);
                break;

            case 'conversation.item.input_audio_transcription.completed':
                log(`INPUT completed transcript="${msg.transcript}"`);
                if (msg.transcript) {
                    setTranscript(msg.transcript);
                    pendingTranscript.current = msg.transcript;
                    tryPersistLiveTurn();
                }
                break;

            case 'response.audio.delta':
                // The instant audio starts coming in, cut the mic to prevent echoes
                setLocalMicEnabled(false);
                break;

            case 'response.output_audio_transcript.delta':
                log(`OUTPUT delta="${msg.delta}" response_id=${msg.response_id}`);
                if (msg.response_id && msg.response_id !== currentResponseId.current) {
                    currentResponseId.current = msg.response_id;
                    setTranslation(msg.delta || '');
                } else {
                    setTranslation(prev => prev + (msg.delta || ''));
                }
                pendingTranslation.current += msg.delta || '';
                if (micHangoverTimer.current) { clearTimeout(micHangoverTimer.current); micHangoverTimer.current = null; }
                setLocalMicEnabled(false);
                break;

            case 'response.output_audio_transcript.done':
                log(`OUTPUT done transcript="${msg.transcript}"`);
                if (msg.transcript) {
                    setTranslation(msg.transcript);
                    pendingTranslation.current = msg.transcript;
                    tryPersistLiveTurn();
                }
                break;

            case 'response.done':
                // Calculate hangover based on translation length. Average speech is ~15 chars per second.
                // We add 1.5 seconds base delay + length-based delay to ensure the WebRTC queue finishes playing.
                const chars = pendingTranslation.current.length || 0;
                const estimatedPlaybackMs = chars > 0 ? (chars * 60) + 1000 : DEFAULT_MIC_HANGOVER_MS;
                
                log(`RESPONSE DONE — mic re-enable in ${estimatedPlaybackMs}ms`);
                if (micHangoverTimer.current) clearTimeout(micHangoverTimer.current);
                micHangoverTimer.current = setTimeout(() => {
                    setLocalMicEnabled(true);
                    signalYourTurn();
                }, estimatedPlaybackMs);
                break;

            case 'input_audio_buffer.speech_started':
                log('SPEECH STARTED');
                setIsSpeaking(true);
                setTranscript('');
                setTranslation('');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                break;

            case 'input_audio_buffer.speech_stopped':
                log('SPEECH STOPPED');
                setIsSpeaking(false);
                Haptics.selectionAsync();
                break;

            case 'error':
                console.error('❌ Realtime session error:', msg.error?.message || msg.error);
                break;

            default:
                log(`UNHANDLED "${msg.type}":`, JSON.stringify(msg).slice(0, 200));
                break;
        }
    };

    // --- Public API ---

    const connect = async () => {
        const myGeneration = ++generation.current;
        sessionStartTime.current = Date.now();
        log(`connect() called, langA=${langA} langB=${langB}`);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            liveMessageCount.current = 0;
            pendingTranscript.current = '';
            pendingTranslation.current = '';
            currentResponseId.current = null;

            const { data: conv, error: convError } = await supabase
                .from('conversations')
                .insert({ user_id: session.user.id, target_lang: langB, mode: 'live', lang_a: langA })
                .select()
                .single();
            if (!convError && conv) {
                liveConversationId.current = conv.id;
            } else {
                console.error('Failed to create live conversation:', convError?.message);
            }

            localStream.current = await mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            }) as unknown as MediaStream;
            setIsRecording(true);

            // Use 'video' media type in InCallManager to activate iOS Voice Chat mode, which enables hardware AEC natively.
            InCallManager.start({ media: 'video' });
            InCallManager.setForceSpeakerphoneOn(true);

            const { data, error } = await supabase.functions.invoke('realtime-session', {
                body: { langA, langB },
            });
            if (error || !data?.value) {
                throw new Error(`Failed to mint realtime token: ${error?.message || 'no client secret returned'}`);
            }
            const clientSecret: string = data.value;

            const connection = new RTCPeerConnection();
            localStream.current.getAudioTracks().forEach(track => {
                connection.addTrack(track, localStream.current!);
            });

            const dc = connection.createDataChannel('oai-events');
            (dc as any).addEventListener('message', (event: any) => handleServerEvent(event.data));

            (connection as any).addEventListener('connectionstatechange', () => {
                if (connection.connectionState === 'failed' || connection.connectionState === 'closed') {
                    console.error(`❌ Realtime connection ${connection.connectionState}`);
                    disconnect();
                }
            });

            const offer = await connection.createOffer();
            await connection.setLocalDescription(offer);

            const sdpResponse = await fetch(OPENAI_CALLS_URL, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${clientSecret}`,
                    'Content-Type': 'application/sdp',
                },
                body: offer.sdp,
            });

            if (!sdpResponse.ok) {
                throw new Error(`OpenAI WebRTC handshake failed: ${await sdpResponse.text()}`);
            }

            const answerSdp = await sdpResponse.text();
            await connection.setRemoteDescription({ type: 'answer', sdp: answerSdp });

            if (myGeneration !== generation.current) {
                // Session was torn down while the handshake was in flight.
                try { dc.close(); } catch { }
                try { connection.close(); } catch { }
                return;
            }

            pc.current = connection;
            setIsConnected(true);
        } catch (error: any) {
            console.error('Connect error:', error);
            await disconnect();
        }
    };

    const disconnect = useCallback(async () => {
        generation.current++;
        if (micHangoverTimer.current) { clearTimeout(micHangoverTimer.current); micHangoverTimer.current = null; }

        try { pc.current?.close(); } catch { }
        pc.current = null;

        localStream.current?.getTracks().forEach(t => t.stop());
        localStream.current = null;

        try { InCallManager.stop(); } catch { }

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
        setIsRecording(false);
        setTranscript('');
        setTranslation('');
        setIsSpeaking(false);
    }, []);

    useEffect(() => { return () => { disconnect(); }; }, [disconnect]);

    return { isConnected, isSpeaking, transcript, translation, connect, disconnect, isRecording };
};
