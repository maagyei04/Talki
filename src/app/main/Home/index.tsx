import { Box, Text } from '@/src/services/config';
import { supabase } from '@/src/services/supabase';
import { useRealtimeTranslation } from '@/src/shared/hooks/useRealtimeTranslation';
import { useVoiceRecorder } from '@/src/shared/hooks/useVoiceRecorder';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal
} from '@gorhom/bottom-sheet';
import { useAudioPlayer } from 'expo-audio';

type Message = {
  id: string;
  text: string;
  speaker: 'me' | 'other';
  timestamp: Date;
  audioPath?: string;
};

const LANGUAGE_MAP: Record<string, string> = {
  ar: 'Arabic',
  bn: 'Bengali',
  zh: 'Chinese',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  fi: 'Finnish',
  fr: 'French',
  de: 'German',
  el: 'Greek',
  he: 'Hebrew',
  hi: 'Hindi',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  ku: 'Kurdish',
  ms: 'Malay',
  no: 'Norwegian',
  pl: 'Polish',
  pt: 'Portuguese',
  pa: 'Punjabi',
  ru: 'Russian',
  so: 'Somali',
  es: 'Spanish',
  sv: 'Swedish',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  vi: 'Vietnamese',
};

export default function HomeScreen() {
  // --- State & Hooks ---
  const [translationMode, setTranslationMode] = useState<'standard' | 'live'>('live');
  const [targetLang, setTargetLang] = useState<'Arabic' | 'Finnish' | 'English'>('Finnish');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<Message[]>([]);
  const [detectedLang, setDetectedLang] = useState('Auto-detect');
  const [showHeadphonePrompt, setShowHeadphonePrompt] = useState(true);

  // Standard Mode Hook
  const {
    isRecording: isRecordingStandard,
    startRecording: startRecordingStandard,
    stopRecording: stopRecordingStandard,
    recordingUri
  } = useVoiceRecorder();

  // Live Mode Hook
  const {
    isConnected: isConnectedLive,
    isSpeaking: isSpeakingLive,
    transcript: transcriptLive,
    translation: translationLive,
    connect: connectLive,
    disconnect: disconnectLive,
    isRecording: isRecordingLive
  } = useRealtimeTranslation(targetLang);

  const player = useAudioPlayer();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%'], []);
  const languages: Array<'Arabic' | 'Finnish' | 'English'> = ['Finnish', 'Arabic', 'English'];

  // --- Animations ---
  const pulseScale = useSharedValue(1);
  const liveOpacity = useSharedValue(1);

  useEffect(() => {
    if (isRecordingStandard || (translationMode === 'live' && isConnectedLive)) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1);
    }
  }, [isRecordingStandard, isConnectedLive, translationMode]);

  useEffect(() => {
    if (translationMode === 'live' && isConnectedLive) {
      liveOpacity.value = withRepeat(withTiming(0.4, { duration: 800 }), -1, true);
    } else {
      liveOpacity.value = 1;
    }
  }, [isConnectedLive, translationMode]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const liveIndicatorStyle = useAnimatedStyle(() => ({
    opacity: liveOpacity.value
  }));

  // --- Callbacks ---
  const handlePresentModalPress = useCallback(() => {
    if (isConnectedLive && translationMode === 'live') {
      Alert.alert(
        'Change Language?',
        'Changing the language will restart your live session. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Change',
            style: 'destructive',
            onPress: async () => {
              await disconnectLive();
              bottomSheetModalRef.current?.present();
            }
          }
        ]
      );
    } else {
      bottomSheetModalRef.current?.present();
    }
  }, [isConnectedLive, translationMode, disconnectLive]);

  const handleLanguageSelect = useCallback((lang: 'Arabic' | 'Finnish' | 'English') => {
    setTargetLang(lang);
    bottomSheetModalRef.current?.dismiss();
  }, []);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const playTranslation = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('recordings')
        .createSignedUrl(path, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        player.replace(data.signedUrl);
        player.play();
      }
    } catch (error) {
      console.error('Failed to play audio:', error);
      Alert.alert('Playback Error', 'Could not play translation audio');
    }
  };

  // --- Standard Mode Processing ---
  useEffect(() => {
    const processAudio = async () => {
      if (recordingUri && translationMode === 'standard') {
        try {
          setIsProcessing(true);
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');

          const fileName = `${Date.now()}.m4a`;
          const filePath = `${user.id}/${fileName}`;
          const formData = new FormData();
          formData.append('file', {
            uri: recordingUri,
            name: fileName,
            type: 'audio/m4a',
          } as any);

          const { error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(filePath, formData);

          if (uploadError) throw uploadError;

          const { data: edgeData, error: edgeError } = await supabase.functions.invoke('process-audio', {
            body: { recordPath: filePath, targetLang }
          });

          if (edgeError) throw edgeError;

          if (edgeData.message) {
            const newMessage: Message = {
              id: `${edgeData.message.id}-trans`,
              text: edgeData.message.translated_text,
              speaker: 'other',
              timestamp: new Date(edgeData.message.created_at),
              audioPath: edgeData.audioUrl
            };

            setTranscription(prev => [...prev, {
              id: edgeData.message.id,
              text: edgeData.message.original_text,
              speaker: 'me',
              timestamp: new Date(edgeData.message.created_at)
            }, newMessage]);

            if (edgeData.audioUrl) playTranslation(edgeData.audioUrl);
          }
        } catch (error: any) {
          console.error('Processing failed:', error);
          Alert.alert('Error', error.message || 'Failed to process audio');
        } finally {
          setIsProcessing(false);
        }
      }
    };
    processAudio();
  }, [recordingUri, translationMode]);

  // --- User Actions ---
  const toggleRecording = async () => {
    if (translationMode === 'live') {
      if (isConnectedLive) {
        await disconnectLive();
      } else {
        await connectLive();
      }
    } else {
      if (isRecordingStandard) {
        await stopRecordingStandard();
      } else {
        await startRecordingStandard();
      }
    }
  };

  const toggleMode = async () => {
    // Stop any active recordings/sessions before switching
    if (isRecordingStandard) await stopRecordingStandard();
    if (isConnectedLive) await disconnectLive();

    setTranslationMode(prev => prev === 'standard' ? 'live' : 'standard');
  };

  return (
    <Box flex={1} backgroundColor="background">
      {/* Header: Controls & Languages */}
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal="medium"
        paddingTop="xxxl"
        paddingBottom="medium"
        borderBottomWidth={0.5}
        borderBottomColor="borderLight"
        backgroundColor="background"
      >
        {/* Mode Switcher (Segmented Control) */}
        <Box
          flexDirection="row"
          backgroundColor="backgroundSecondary"
          padding="nano"
          borderRadius="round"
          style={styles.segmentedContainer}
        >
          <Pressable
            onPress={() => translationMode !== 'standard' && toggleMode()}
            style={[
              styles.segmentButton,
              translationMode === 'standard' && styles.activeSegment
            ]}
          >
            <MaterialCommunityIcons
              name="chat-processing-outline"
              size={14}
              color={translationMode === 'standard' ? "white" : "#64748B"}
            />
            <Text
              variant="caption"
              fontWeight="bold"
              marginLeft="nano"
              style={[
                styles.segmentText,
                translationMode === 'standard' && styles.activeSegmentText
              ]}
            >
              CHAT
            </Text>
          </Pressable>

          <Pressable
            onPress={() => translationMode !== 'live' && toggleMode()}
            style={[
              styles.segmentButton,
              translationMode === 'live' && styles.activeSegment
            ]}
          >
            <MaterialCommunityIcons
              name="broadcast"
              size={14}
              color={translationMode === 'live' ? "white" : "#64748B"}
            />
            <Text
              variant="caption"
              fontWeight="bold"
              marginLeft="nano"
              style={[
                styles.segmentText,
                translationMode === 'live' && styles.activeSegmentText
              ]}
            >
              LIVE
            </Text>
          </Pressable>
        </Box>

        {/* Target Language */}
        <Pressable
          onPress={handlePresentModalPress}
          style={[styles.langDisplay, { backgroundColor: '#420080ff' }]}
        >
          <Box flexDirection="row" alignItems="center">
            <Text variant="subheading" color="white">{targetLang}</Text>
            <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
          </Box>
        </Pressable>
      </Box>

      {/* Main Content Area */}
      {translationMode === 'live' ? (
        /* LIVE DOCUMENTARY VIEW */
        <ScrollView contentContainerStyle={styles.liveContent} showsVerticalScrollIndicator={false}>
          {/* Headphone Recommendation */}
          {showHeadphonePrompt && (
            <Animated.View entering={FadeInDown} style={{ marginBottom: 16 }}>
              <Box
                padding="medium"
                borderRadius="md"
                flexDirection="row"
                alignItems="center"
                style={{
                  backgroundColor: 'rgba(66, 0, 128, 0.1)',
                  borderWidth: 1,
                  borderColor: 'rgba(66, 0, 128, 0.2)'
                }}
              >
                <Ionicons name="headset-outline" size={24} color="#420080ff" />
                <Box flex={1} marginLeft="small">
                  <Text variant="caption" color="info" fontWeight="bold">
                    For best results, use headphones or AirPods
                  </Text>
                </Box>
                <Pressable onPress={() => setShowHeadphonePrompt(false)} hitSlop={8}>
                  <Ionicons name="close-circle" size={20} color="rgba(66, 0, 128, 0.5)" />
                </Pressable>
              </Box>
            </Animated.View>
          )}

          {/* Status + Speech Indicator */}
          <Box flexDirection="row" alignItems="center" justifyContent="space-between" marginBottom="xl">
            <Box flexDirection="row" alignItems="center">
              <Animated.View style={[styles.liveDot, isConnectedLive && liveIndicatorStyle, !isConnectedLive && { backgroundColor: '#666' }]} />
              <Text variant="caption" color={isConnectedLive ? "error" : "textSecondary"} fontWeight="bold" marginLeft="nano">
                {isConnectedLive ? "STREAMING" : "OFFLINE"}
              </Text>
            </Box>
            {/* Speech Detection Indicator */}
            {isConnectedLive && isSpeakingLive && (
              <Animated.View entering={FadeInDown} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginRight: 6 }, pulseStyle]} />
                <Text variant="caption" fontWeight="bold" style={{ color: '#4CAF50' }}>SPEAKING</Text>
              </Animated.View>
            )}
          </Box>

          {/* Original Audio (Faded) */}
          <Box marginBottom="xl" minHeight={80} opacity={0.6}>
            <Text variant="caption" color="textSecondary" marginBottom="small">ORIGINAL AUDIO</Text>
            <Text variant="body" color="black" style={styles.liveTranscriptText}>
              {transcriptLive || (isConnectedLive ? (isRecordingLive ? "Listening..." : "Connecting...") : "Ready for simultaneous flow")}
            </Text>
          </Box>

          {/* Translation Output */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.liveTranslationContainer}>
            <Box flexDirection="row" alignItems="center" marginBottom="medium">
              <MaterialCommunityIcons name="broadcast" size={20} color="#420080ff" />
              <Text variant="subheading" color="info" marginLeft="small" fontWeight="bold">VOICEOVER</Text>
            </Box>
            <Text variant="heading2" color="black" style={styles.liveTranslationText}>
              {translationLive || (isConnectedLive ? "Translating live..." : "Start session to begin")}
            </Text>
          </Animated.View>
        </ScrollView>
      ) : (
        /* STANDARD CHAT VIEW */
        <ScrollView
          contentContainerStyle={transcription.length === 0 ? styles.emptyScrollContent : styles.scrollContent}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {transcription.length === 0 ? (
            <Box flex={1} justifyContent="center" alignItems="center" opacity={0.5}>
              <MaterialCommunityIcons name="microphone-outline" size={64} color="black" />
              <Text variant="body" marginTop="medium" textAlign="center" color="textSecondary">
                Tap the button below and speak{'\n'}to start your conversation
              </Text>
            </Box>
          ) : (
            transcription.map((msg) => (
              <Box
                key={msg.id}
                alignSelf={msg.speaker === 'me' ? 'flex-end' : 'flex-start'}
                maxWidth="85%"
                marginBottom="small"
              >
                <Pressable
                  onPress={() => msg.audioPath && playTranslation(msg.audioPath)}
                  style={({ pressed }) => [{ opacity: pressed && msg.audioPath ? 0.7 : 1 }]}
                >
                  <Box
                    backgroundColor={msg.speaker === 'me' ? 'black' : 'backgroundSecondary'}
                    padding="medium"
                    borderRadius="md"
                    flexDirection="row"
                    alignItems="center"
                  >
                    <Box flexShrink={1}>
                      <Text variant="body" color={msg.speaker === 'me' ? 'white' : 'text'}>
                        {msg.text}
                      </Text>
                    </Box>
                    {msg.audioPath && (
                      <Box marginLeft="small">
                        <Ionicons
                          name="volume-medium"
                          size={20}
                          color={msg.speaker === 'me' ? 'white' : '#420080ff'}
                        />
                      </Box>
                    )}
                  </Box>
                </Pressable>
              </Box>
            ))
          )}
          {isRecordingStandard && (
            <Box padding="small" alignSelf="center">
              <Text variant="caption" color="info" fontWeight="bold">LISTENING...</Text>
            </Box>
          )}
          {isProcessing && (
            <Box alignSelf="flex-start" maxWidth="85%" marginBottom="small" opacity={0.7}>
              <Box
                backgroundColor="backgroundSecondary"
                padding="medium"
                borderRadius="md"
                flexDirection="row"
                alignItems="center"
                style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: '#42008033' }}
              >
                <ActivityIndicator size="small" color="#420080ff" />
                <Text variant="body" color="textSecondary" marginLeft="small" style={{ fontStyle: 'italic' }}>
                  Talki is processing...
                </Text>
              </Box>
            </Box>
          )}
        </ScrollView>
      )}

      {/* Footer: Record Button */}
      <Box alignItems="center" paddingBottom="xxl" paddingTop="small" style={{ paddingBottom: 110 }}>
        {/* Main Record/Stop Button */}
        <Pressable onPress={toggleRecording} disabled={isProcessing}>
          <Animated.View style={[
            styles.recordButton,
            pulseStyle,
            (isRecordingStandard || isConnectedLive) && styles.recordingActive,
            isProcessing && styles.buttonDisabled,
            translationMode === 'live' && { borderColor: isConnectedLive ? '#ff4444' : 'rgba(255,255,255,0.3)', backgroundColor: isConnectedLive ? '#ff4444' : 'transparent' }
          ]}>
            <MaterialCommunityIcons
              name={(isRecordingStandard || isConnectedLive) ? "stop" : "microphone"}
              size={40}
              color={(isRecordingStandard || isConnectedLive) ? "white" : (translationMode === 'live' ? "black" : "black")}
            />
          </Animated.View>
        </Pressable>
        <Text variant="caption" color={translationMode === 'live' ? "textSecondary" : "textSecondary"} marginTop="small">
          {translationMode === 'live'
            ? (isConnectedLive ? "Tap to stop session" : "Tap to start live flow")
            : (isRecordingStandard ? "Tap to stop" : "Tap to record message")}
        </Text>
      </Box>

      {/* Language Picker Bottom Sheet */}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={{ backgroundColor: '#CBD5E1' }}
        backgroundStyle={{ borderRadius: 24 }}
      >
        <BottomSheetFlatList
          data={languages}
          keyExtractor={(item: string) => item}
          ListHeaderComponent={() => (
            <Text variant="subheading" color="text" marginBottom="medium" textAlign="center">
              Select Target Language
            </Text>
          )}
          renderItem={({ item }: { item: 'Arabic' | 'Finnish' | 'English' }) => (
            <Pressable onPress={() => handleLanguageSelect(item)}>
              <Box
                flexDirection="row"
                alignItems="center"
                justifyContent="space-between"
                paddingVertical="medium"
                paddingHorizontal="medium"
                backgroundColor={targetLang === item ? 'backgroundTertiary' : 'transparent'}
                borderRadius="md"
                marginBottom="small"
              >
                <Text
                  variant="body"
                  color={targetLang === item ? 'info' : 'text'}
                  fontWeight={targetLang === item ? 'bold' : 'normal'}
                >
                  {item}
                </Text>
                {targetLang === item && (
                  <Ionicons name="checkmark-circle" size={20} color="#420080ff" />
                )}
              </Box>
            </Pressable>
          )}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        />
      </BottomSheetModal>
    </Box>
  );
}

const styles = StyleSheet.create({
  langDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeToggle: {
    height: 40,
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  liveContent: {
    padding: 24,
    paddingTop: 30,
    paddingBottom: 100,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
  },
  liveTranscriptText: {
    fontSize: 18,
    lineHeight: 26,
    fontFamily: 'Poppins_400Regular',
  },
  liveTranslationContainer: {
    backgroundColor: 'rgba(66, 0, 128, 0.05)',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(66, 0, 128, 0.1)',
    minHeight: 200,
  },
  liveTranslationText: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: 'bold',
    color: 'black',
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  recordingActive: {
    backgroundColor: '#420080ff',
    borderColor: '#420080ff',
  },
  buttonDisabled: {
    borderColor: 'gray',
    opacity: 0.5,
  },
  segmentedContainer: {
    width: 140,
    height: 36,
    alignItems: 'center',
  },
  segmentButton: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  activeSegment: {
    backgroundColor: '#420080ff',
  },
  segmentText: {
    color: '#64748B',
    fontSize: 11,
  },
  activeSegmentText: {
    color: 'white',
  },
  arrowContainer: {
    display: 'none',
  }
});
