import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState
} from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

export const useVoiceRecorder = () => {
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recorderState = useAudioRecorderState(recorder);
    const [recordingUri, setRecordingUri] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const status = await AudioModule.requestRecordingPermissionsAsync();
            if (!status.granted) {
                console.warn('Microphone permission not granted');
            }

            // Set default mode for playback (Speaker)
            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: false,
                shouldRouteThroughEarpiece: false,
                interruptionMode: 'doNotMix',
                shouldPlayInBackground: true,
            });
        })();
    }, []);

    const startRecording = useCallback(async () => {
        try {
            const status = await AudioModule.getRecordingPermissionsAsync();
            if (!status.granted) {
                const request = await AudioModule.requestRecordingPermissionsAsync();
                if (!request.granted) {
                    Alert.alert('Permission to access microphone was denied');
                    return;
                }
            }

            // Enable recording and switch to earpiece/mic mode
            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: true,
                shouldRouteThroughEarpiece: false, // Try to keep speaker even here
                interruptionMode: 'doNotMix',
                shouldPlayInBackground: true,
            });

            console.log('Preparing to record...');
            await recorder.prepareToRecordAsync();

            console.log('Starting recording...');
            recorder.record();
            setRecordingUri(null);
            console.log('Recording started');
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    }, [recorder]);

    const stopRecording = useCallback(async () => {
        console.log('Stopping recording...');
        try {
            await recorder.stop();
            const uri = recorder.uri;
            setRecordingUri(uri);
            console.log('Recording stopped and stored at', uri);

            // Revert to playback-friendly mode (Speaker)
            await setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: false,
                shouldRouteThroughEarpiece: false,
                interruptionMode: 'doNotMix',
                shouldPlayInBackground: true,
            });
        } catch (err) {
            console.error('Failed to stop recording', err);
        }
    }, [recorder]);

    useEffect(() => {
        return () => {
            if (recorderState.isRecording) {
                recorder.stop();
            }
        };
    }, [recorderState.isRecording, recorder]);

    return {
        isRecording: recorderState.isRecording,
        recordingUri,
        startRecording,
        stopRecording,
    };
};
