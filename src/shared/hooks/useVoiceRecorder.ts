import { 
  AudioModule, 
  RecordingPresets, 
  useAudioRecorder, 
  setAudioModeAsync, 
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

            setAudioModeAsync({
                playsInSilentMode: true,
                allowsRecording: true,
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
