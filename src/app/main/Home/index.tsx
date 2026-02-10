import { Box, Text } from '@/src/services/config';
import { supabase } from '@/src/services/supabase';
import { useVoiceRecorder } from '@/src/shared/hooks/useVoiceRecorder';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, {
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

const getLanguageName = (code: string) => LANGUAGE_MAP[code] || code.toUpperCase();

export default function HomeScreen() {
  const { isRecording, startRecording, stopRecording, recordingUri } = useVoiceRecorder();
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcription, setTranscription] = useState<Message[]>([]);
  const [detectedLang, setDetectedLang] = useState('Auto-detect');
  const [targetLang, setTargetLang] = useState<'Arabic' | 'Finnish' | 'English'>('Finnish');

  const player = useAudioPlayer();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // Bottom Sheet Config
  const snapPoints = useMemo(() => ['50%'], []);
  const languages: Array<'Arabic' | 'Finnish' | 'English'> = ['Finnish', 'Arabic', 'English'];

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

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
      console.log('Fetching signed URL for:', path);
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

  // Pulse animation for the record button
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (isRecording) {
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
  }, [isRecording]);

  useEffect(() => {
    const processAudio = async () => {
      if (recordingUri) {
        try {
          setIsProcessing(true);

          // 1. Get current user
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error('Not authenticated');

          // 2. Prepare file for upload
          // In React Native, we need to handle the file differently for Supabase Storage's fetch
          const fileName = `${Date.now()}.m4a`;
          const filePath = `${user.id}/${fileName}`;

          const formData = new FormData();
          formData.append('file', {
            uri: recordingUri,
            name: fileName,
            type: 'audio/m4a',
          } as any);

          // 3. Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('recordings')
            .upload(filePath, formData);

          if (uploadError) throw uploadError;

          console.log('Audio uploaded successfully:', filePath);

          // 4. Call Supabase Edge Function for AI processing
          const { data: edgeData, error: edgeError } = await supabase.functions.invoke('process-audio', {
            body: {
              recordPath: filePath,
              targetLang: targetLang,
            }
          });

          if (edgeError) throw edgeError;

          // 5. Update UI and Auto-Play
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

            // Auto-play the new translation
            if (edgeData.audioUrl) {
              playTranslation(edgeData.audioUrl);
            }
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
  }, [recordingUri]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const toggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  return (
    <Box flex={1} backgroundColor="background" paddingTop="xl">
      {/* Header: Language Display */}
      <Box
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        paddingHorizontal="medium"
        paddingVertical="medium"
        borderBottomWidth={0.5}
        borderBottomColor="borderLight"
      >
        <Box backgroundColor="backgroundSecondary" style={styles.langDisplay}>
          <Text variant="caption" color="textSecondary" fontSize={10} marginBottom="nano">DETECTED</Text>
          <Text variant="subheading" color="text">{detectedLang}</Text>
        </Box>

        <Box style={styles.arrowContainer}>
          <Ionicons name="arrow-forward" size={20} color="#420080ff" />
        </Box>

        <Pressable
          onPress={handlePresentModalPress}
          style={[styles.langDisplay, { backgroundColor: '#420080ff' }]}
        >
          <Text variant="caption" color="textSecondary" fontSize={10} marginBottom="nano">TARGET</Text>
          <Box flexDirection="row" alignItems="center">
            <Text variant="subheading" color="white">{targetLang}</Text>
            <Ionicons name="chevron-down" size={14} color="gray" style={{ marginLeft: 4 }} />
          </Box>
        </Pressable>
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

      {/* Transcription Feed */}
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
                style={({ pressed }) => [
                  { opacity: pressed && msg.audioPath ? 0.7 : 1 }
                ]}
              >
                <Box
                  backgroundColor={msg.speaker === 'me' ? 'black' : 'backgroundSecondary'}
                  padding="medium"
                  borderRadius="md"
                  flexDirection="row"
                  alignItems="center"
                >
                  <Box flexShrink={1}>
                    <Text
                      variant="body"
                      color={msg.speaker === 'me' ? 'white' : 'text'}
                    >
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
        {isRecording && (
          <Box padding="small" alignSelf="center">
            <Text variant="caption" color="info" fontWeight="bold">
              LISTENING...
            </Text>
          </Box>
        )}
        {isProcessing && (
          <Box
            alignSelf="flex-start"
            maxWidth="85%"
            marginBottom="small"
            opacity={0.7}
          >
            <Box
              backgroundColor="backgroundSecondary"
              padding="medium"
              borderRadius="md"
              flexDirection="row"
              alignItems="center"
              style={{ borderStyle: 'dashed', borderWidth: 1, borderColor: '#42008033' }}
            >
              <ActivityIndicator size="small" color="#420080ff" />
              <Text
                variant="body"
                color="textSecondary"
                marginLeft="small"
                style={{ fontStyle: 'italic' }}
              >
                Talki is processing...
              </Text>
            </Box>
          </Box>
        )}
      </ScrollView>

      {/* "Smart Actions" */}
      {/* <Box padding="medium" backgroundColor="backgroundSecondary" marginHorizontal="medium" borderRadius="md" marginBottom="small">
        <Box flexDirection="row" alignItems="center" marginBottom="nano">
          <MaterialCommunityIcons name="lightning-bolt" size={16} color="#420080ff" />
          <Text variant="caption" fontWeight="bold" marginLeft="nano" color="info">SMART ACTIONS</Text>
        </Box>
        <Text variant="bodySmall" color="textSecondary">No actions found in this conversation yet.</Text>
      </Box> */}

      {/* Footer: Record Button */}
      <Box alignItems="center" paddingBottom="xxl" paddingTop="small" style={{ paddingBottom: 120 }}>
        <Pressable onPress={toggleRecording} disabled={isProcessing}>
          <Animated.View style={[
            styles.recordButton,
            pulseStyle,
            isRecording && styles.recordingActive,
            isProcessing && styles.buttonDisabled
          ]}>
            <MaterialCommunityIcons
              name={isRecording ? "stop" : "microphone"}
              size={40}
              color={isRecording ? "white" : (isProcessing ? "gray" : "black")}
            />
          </Animated.View>
        </Pressable>
        <Text variant="caption" color="textSecondary" marginTop="small">
          {isRecording ? "Tap to stop" : (isProcessing ? "Processing..." : "Tap to start translating")}
        </Text>
      </Box>
    </Box>
  );
}

const styles = StyleSheet.create({
  langDisplay: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  arrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0FF',
    justifyContent: 'center',
    alignItems: 'center',
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
  contentContainer: {
    flex: 1,
  },
});
