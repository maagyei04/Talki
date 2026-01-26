import { transcribeAudio } from '@/src/services/ai/assemblyAI';
import { Box, Text } from '@/src/services/config';
import { useVoiceRecorder } from '@/src/shared/hooks/useVoiceRecorder';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming
} from 'react-native-reanimated';

type Message = {
  id: string;
  text: string;
  speaker: 'me' | 'other';
  timestamp: Date;
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<Message[]>([]);
  const [detectedLang, setDetectedLang] = useState('Auto-detect');

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
    const handleTranscription = async () => {
      if (recordingUri) {
        try {
          setIsTranscribing(true);
          const { text, languageCode } = await transcribeAudio(recordingUri);

          if (languageCode) {
            setDetectedLang(getLanguageName(languageCode));
          }

          if (text) {
            const newMessage: Message = {
              id: Date.now().toString(),
              text: text,
              speaker: 'me',
              timestamp: new Date(),
            };
            setTranscription(prev => [...prev, newMessage]);
          }
        } catch (error) {
          console.error('Transcription failed:', error);
        } finally {
          setIsTranscribing(false);
        }
      }
    };

    handleTranscription();
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

        <Box backgroundColor="backgroundSecondary" style={styles.langDisplay}>
          <Text variant="caption" color="textSecondary" fontSize={10} marginBottom="nano">TARGET</Text>
          <Box flexDirection="row" alignItems="center">
            <Text variant="subheading" color="text">Soon</Text>
            <Box marginLeft="small" backgroundColor="info" paddingHorizontal="nano" borderRadius="xs">
              <Text style={{ fontSize: 8, color: 'white', fontWeight: 'bold' }}>PLAN</Text>
            </Box>
          </Box>
        </Box>
      </Box>

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
              backgroundColor={msg.speaker === 'me' ? 'black' : 'backgroundSecondary'}
              padding="medium"
              borderRadius="md"
              marginBottom="small"
              maxWidth="85%"
            >
              <Text
                variant="body"
                color={msg.speaker === 'me' ? 'white' : 'text'}
              >
                {msg.text}
              </Text>
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
        {isTranscribing && (
          <Box padding="medium" flexDirection="row" alignItems="center" alignSelf="flex-end">
            <ActivityIndicator size="small" color="#420080ff" />
            <Text variant="caption" marginLeft="small" color="textSecondary">
              Transcribing...
            </Text>
          </Box>
        )}
      </ScrollView>

      {/* "Smart Actions" */}
      <Box padding="medium" backgroundColor="backgroundSecondary" marginHorizontal="medium" borderRadius="md" marginBottom="small">
        <Box flexDirection="row" alignItems="center" marginBottom="nano">
          <MaterialCommunityIcons name="lightning-bolt" size={16} color="#420080ff" />
          <Text variant="caption" fontWeight="bold" marginLeft="nano" color="info">SMART ACTIONS</Text>
        </Box>
        <Text variant="bodySmall" color="textSecondary">No actions found in this conversation yet.</Text>
      </Box>

      {/* Footer: Record Button */}
      <Box alignItems="center" paddingBottom="xxxl" paddingTop="small" style={{ paddingBottom: 120 }}>
        <Pressable onPress={toggleRecording} disabled={isTranscribing}>
          <Animated.View style={[
            styles.recordButton,
            pulseStyle,
            isRecording && styles.recordingActive,
            isTranscribing && styles.buttonDisabled
          ]}>
            <MaterialCommunityIcons
              name={isRecording ? "stop" : "microphone"}
              size={40}
              color={isRecording ? "white" : (isTranscribing ? "gray" : "black")}
            />
          </Animated.View>
        </Pressable>
        <Text variant="caption" color="textSecondary" marginTop="small">
          {isRecording ? "Tap to stop" : (isTranscribing ? "Processing..." : "Tap to start translating")}
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
});
