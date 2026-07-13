import { Box, Text } from '@/src/services/config';
import { supabase } from '@/src/services/supabase';
import { useRealtimeTranslation } from '@/src/shared/hooks/useRealtimeTranslation';
import { useVoiceRecorder } from '@/src/shared/hooks/useVoiceRecorder';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTrialManager } from '@/src/shared/hooks/useTrialManager';
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

import { useTranslation } from 'react-i18next';
import { I18nManager } from 'react-native';

const LANG_ABBREVIATIONS: Record<string, string> = {
  Arabic: 'AR',
  Finnish: 'FI',
  English: 'EN',
  Swedish: 'SV',
};

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { canStartSession, recordSession, presentPaywall, isPremium, sessionsUsed } = useTrialManager();
  const tabBarHeight = useBottomTabBarHeight();

  // --- State & Hooks ---
  const [translationMode, setTranslationMode] = useState<'standard' | 'live'>('live');
  const [langA, setLangA] = useState<'Arabic' | 'Finnish' | 'English' | 'Swedish'>('English');
  const [langB, setLangB] = useState<'Arabic' | 'Finnish' | 'English' | 'Swedish'>('Arabic');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<Message[]>([]);
  const [detectedLang, setDetectedLang] = useState('Auto-detect');
  const [pickingLangType, setPickingLangType] = useState<'A' | 'B'>('B');

  // Standard Mode Hook
  const {
    isRecording: isRecordingStandard,
    startRecording: startRecordingStandard,
    stopRecording: stopRecordingStandard,
    recordingUri,
    clearRecording: clearRecordingStandard
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
  } = useRealtimeTranslation(langA, langB);

  const player = useAudioPlayer();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['50%'], []);
  const languages: Array<'Arabic' | 'Finnish' | 'English' | 'Swedish'> = ['Finnish', 'Arabic', 'English', 'Swedish'];

  // Session Tracking for Trials
  const sessionStartTimeRef = useRef<number | null>(null);

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
  const handlePresentModalPress = useCallback((type: 'A' | 'B') => {
    setPickingLangType(type);
    if (isConnectedLive && translationMode === 'live') {
      Alert.alert(
        t('home.changeLangTitle'),
        t('home.changeLangDesc'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('home.change'),
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
  }, [isConnectedLive, translationMode, disconnectLive, t]);

  const handleLanguageSelect = useCallback((lang: 'Arabic' | 'Finnish' | 'English' | 'Swedish') => {
    if (pickingLangType === 'A') setLangA(lang);
    else setLangB(lang);
    bottomSheetModalRef.current?.dismiss();
  }, [pickingLangType]);

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
            body: { recordPath: filePath, targetLang: langB }
          });

          if (edgeError) throw edgeError;

          if (edgeData.message) {
            // Record trial usage for standard mode translation
            await recordSession();

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
            
            // ⚠️ FIX: Clear the recording URI from hook state so it doesn't re-process on tab switch/mount
            clearRecordingStandard();
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
  }, [recordingUri, translationMode, recordSession]);

  // --- User Actions ---
  const toggleRecording = async () => {
    // Gatekeeper Check
    if (!canStartSession) {
      await presentPaywall();
      return;
    }

    if (translationMode === 'live') {
      if (isConnectedLive) {
        // Ending a live session
        const duration = sessionStartTimeRef.current ? (Date.now() - sessionStartTimeRef.current) / 1000 : 0;
        await disconnectLive();
        sessionStartTimeRef.current = null;

        // If session was > 5 seconds, record it as a trial session
        if (duration >= 5) {
          await recordSession();
        }
      } else {
        // Starting a live session
        sessionStartTimeRef.current = Date.now();
        await connectLive();
      }
    } else {
      if (isRecordingStandard) {
        await stopRecordingStandard();
        // For standard mode, we might want to record after a certain number of translations
        // but the prompt specifically mentioned 5-minute sessions.
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
        flexDirection={I18nManager.isRTL ? "row-reverse" : "row"}
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
              {t('home.chat')}
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
              {t('home.live')}
            </Text>
          </Pressable>
        </Box>

        {/* Dynamic Header Picker */}
        {translationMode === 'live' ? (
          /* Dual Language Header (LIVE) */
          <Box flexDirection={I18nManager.isRTL ? "row-reverse" : "row"} alignItems="center">
            <Pressable
              onPress={() => handlePresentModalPress('A')}
              style={[styles.langDisplay, { backgroundColor: '#420080ff', minWidth: 60 }]}
            >
              <Box flexDirection="row" alignItems="center">
                <Text variant="subheading" color="white" fontWeight="bold">
                  {LANG_ABBREVIATIONS[langA] || langA.substring(0, 2).toUpperCase()}
                </Text>
                <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
              </Box>
            </Pressable>

            <Box marginHorizontal="small">
              <Ionicons name="swap-horizontal" size={16} color="#64748B" />
            </Box>

            <Pressable
              onPress={() => handlePresentModalPress('B')}
              style={[styles.langDisplay, { backgroundColor: '#420080ff', minWidth: 60 }]}
            >
              <Box flexDirection="row" alignItems="center">
                <Text variant="subheading" color="white" fontWeight="bold">
                  {LANG_ABBREVIATIONS[langB] || langB.substring(0, 2).toUpperCase()}
                </Text>
                <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
              </Box>
            </Pressable>
          </Box>
        ) : (
          /* Single Language Header (CHAT/STANDARD) */
          <Pressable
            onPress={() => handlePresentModalPress('B')}
            style={[styles.langDisplay, { backgroundColor: '#420080ff' }]}
          >
            <Box flexDirection="row" alignItems="center">
              <Text variant="subheading" color="white">{t(`common.${langB.toLowerCase()}`, langB)}</Text>
              <Ionicons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />
            </Box>
          </Pressable>
        )}
      </Box>

      {/* Main Content Area */}
      {translationMode === 'live' ? (
        /* LIVE DOCUMENTARY VIEW */
        <ScrollView contentContainerStyle={styles.liveContent} showsVerticalScrollIndicator={false}>

          {/* Status + Speech Indicator */}
          <Box flexDirection={I18nManager.isRTL ? "row-reverse" : "row"} alignItems="center" justifyContent="space-between" marginBottom="xl">
            <Box flexDirection={I18nManager.isRTL ? "row-reverse" : "row"} alignItems="center">
              <Animated.View style={[styles.liveDot, isConnectedLive && liveIndicatorStyle, !isConnectedLive && { backgroundColor: '#666' }]} />
              <Text variant="caption" color={isConnectedLive ? "error" : "textSecondary"} fontWeight="bold" marginLeft="nano">
                {isConnectedLive ? t('home.streaming') : t('home.offline')}
              </Text>
            </Box>
            {/* Speech Detection Indicator */}
            {isConnectedLive && isSpeakingLive && (
              <Animated.View entering={FadeInDown} style={{ flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
                <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginRight: I18nManager.isRTL ? 0 : 6, marginLeft: I18nManager.isRTL ? 6 : 0 }, pulseStyle]} />
                <Text variant="caption" fontWeight="bold" style={{ color: '#4CAF50' }}>{t('home.speaking')}</Text>
              </Animated.View>
            )}
          </Box>

          {/* Original Audio (Faded) */}
          <Box marginBottom="xl" minHeight={80} opacity={0.6}>
            <Text variant="caption" color="textSecondary" marginBottom="small" textAlign={I18nManager.isRTL ? 'right' : 'left'}>
              {t('home.originalAudio')}
            </Text>
            <Text variant="body" color="black" style={[styles.liveTranscriptText, { textAlign: I18nManager.isRTL ? 'right' : 'left' }]}>
              {transcriptLive || (isConnectedLive ? (isRecordingLive ? t('home.listening') : t('home.connecting')) : t('home.readyLive'))}
            </Text>
          </Box>

          {/* Translation Output */}
          <Animated.View entering={FadeInDown.delay(200)} style={styles.liveTranslationContainer}>
            <Box flexDirection={I18nManager.isRTL ? "row-reverse" : "row"} alignItems="center" marginBottom="medium">
              <MaterialCommunityIcons name="broadcast" size={20} color="#420080ff" />
              <Text variant="subheading" color="info" marginLeft={I18nManager.isRTL ? "none" : "small"} marginRight={I18nManager.isRTL ? "small" : "none"} fontWeight="bold">
                {t('home.voiceover')}
              </Text>
            </Box>
            <Text variant="heading2" color="black" style={[styles.liveTranslationText, { textAlign: I18nManager.isRTL ? 'right' : 'left' }]}>
              {translationLive || (isConnectedLive ? t('home.translating') : t('home.startLive'))}
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
                {t('home.emptyHome')}
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
                    flexDirection={I18nManager.isRTL ? "row-reverse" : "row"}
                    alignItems="center"
                  >
                    <Box flexShrink={1}>
                      <Text variant="body" color={msg.speaker === 'me' ? 'white' : 'text'} textAlign={I18nManager.isRTL ? 'right' : 'left'}>
                        {msg.text}
                      </Text>
                    </Box>
                    {msg.audioPath && (
                      <Box marginLeft={I18nManager.isRTL ? "none" : "small"} marginRight={I18nManager.isRTL ? "small" : "none"}>
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
              <Text variant="caption" color="info" fontWeight="bold">{t('home.listening').toUpperCase()}</Text>
            </Box>
          )}
          {isProcessing && (
            <Box alignSelf="flex-start" maxWidth="85%" marginBottom="small" opacity={0.7}>
              <Box
                backgroundColor="backgroundSecondary"
                padding="medium"
                borderRadius="md"
                flexDirection={I18nManager.isRTL ? "row-reverse" : "row"}
                alignItems="center"
                style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: '#42008033' }}
              >
                <ActivityIndicator size="small" color="#420080ff" />
                <Text variant="body" color="textSecondary" marginLeft={I18nManager.isRTL ? "none" : "small"} marginRight={I18nManager.isRTL ? "small" : "none"} style={{ fontStyle: 'italic' }}>
                  {t('home.processing')}
                </Text>
              </Box>
            </Box>
          )}
        </ScrollView>
      )}

      {/* Footer: Record Button */}
      <Box alignItems="center" paddingTop="small" style={{ paddingBottom: tabBarHeight + 20 }}>
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
        <Text variant="caption" color={translationMode === 'live' ? "textSecondary" : "textSecondary"} marginTop="small" textAlign="center">
          {translationMode === 'live'
            ? (isConnectedLive ? t('home.tapToStopSession') : t('home.tapToStartLive'))
            : (isRecordingStandard ? t('home.tapToStop') : t('home.tapToRecord'))}
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
              {t('home.selectLang')}
            </Text>
          )}
          renderItem={({ item }: { item: 'Arabic' | 'Finnish' | 'English' | 'Swedish' }) => {
            const currentSelected = pickingLangType === 'A' ? langA : langB;
            return (
              <Pressable onPress={() => handleLanguageSelect(item)}>
                <Box
                  flexDirection={I18nManager.isRTL ? "row-reverse" : "row"}
                  alignItems="center"
                  justifyContent="space-between"
                  paddingVertical="medium"
                  paddingHorizontal="medium"
                  backgroundColor={currentSelected === item ? 'backgroundTertiary' : 'transparent'}
                  borderRadius="md"
                  marginBottom="small"
                >
                  <Text
                    variant="body"
                    color={currentSelected === item ? 'info' : 'text'}
                    fontWeight={currentSelected === item ? 'bold' : 'normal'}
                  >
                    {t(`common.${item.toLowerCase()}`, item)}
                  </Text>
                  {currentSelected === item && (
                    <Ionicons name="checkmark-circle" size={20} color="#420080ff" />
                  )}
                </Box>
              </Pressable>
            );
          }}
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
