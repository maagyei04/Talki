import { Box, Text } from '@/src/services/config';
import { supabase } from '@/src/services/supabase';
import { AssistantMessage, useAssistant } from '@/src/shared/hooks/useAssistant';
import { useVoiceRecorder } from '@/src/shared/hooks/useVoiceRecorder';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTrialManager } from '@/src/shared/hooks/useTrialManager';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  I18nManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const ACCENT = '#420080ff';
const ACCENT_LIGHT = 'rgba(66,0,128,0.08)';

// ─── Suggested Prompts ─────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  '💊 What did the doctor mention about my prescription?',
  '📋 Summarize my last 3 sessions',
  '🗂️ What topics came up most in my sessions?',
  '📅 What happened in my most recent session?',
];

// ─── Typing Indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  const dot1 = useSharedValue(0.3);
  const dot2 = useSharedValue(0.3);
  const dot3 = useSharedValue(0.3);

  useEffect(() => {
    const animate = (v: ReturnType<typeof useSharedValue<number>>, delay: number) => {
      v.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 300 }),
          withTiming(0.3, { duration: 300 })
        ),
        -1,
        false
      );
    };
    setTimeout(() => animate(dot1, 0), 0);
    setTimeout(() => animate(dot2, 0), 200);
    setTimeout(() => animate(dot3, 0), 400);
  }, []);

  const d1Style = useAnimatedStyle(() => ({ opacity: dot1.value }));
  const d2Style = useAnimatedStyle(() => ({ opacity: dot2.value }));
  const d3Style = useAnimatedStyle(() => ({ opacity: dot3.value }));

  return (
    <View style={styles.typingContainer}>
      <View style={styles.assistantAvatar}>
        <Text fontSize={12}>✨</Text>
      </View>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, d1Style]} />
        <Animated.View style={[styles.typingDot, d2Style]} />
        <Animated.View style={[styles.typingDot, d3Style]} />
      </View>
    </View>
  );
}

function MarkdownText({ text, style }: { text: string; style: any }) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={[style, { fontFamily: 'Poppins_700Bold' }]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message, index }: { message: AssistantMessage; index: number }) {
  const isUser = message.role === 'user';
  const time = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 20).springify()}
      style={[styles.messageRow, isUser ? styles.rowUser : styles.rowAssistant]}
    >
      {!isUser && (
        <View style={styles.assistantAvatar}>
          <Text fontSize={12}>✨</Text>
        </View>
      )}

      <View style={[
        styles.bubble,
        isUser ? styles.bubbleUser : styles.bubbleAssistant,
        { maxWidth: '78%' }
      ]}>
        <MarkdownText
          text={message.content}
          style={[styles.bubbleText, isUser ? styles.textUser : styles.textAssistant]}
        />
        <Text style={[styles.timeText, { color: isUser ? 'rgba(255,255,255,0.6)' : '#94A3B8' }]}>
          {time}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  return (
    <Animated.View entering={FadeIn} style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name="robot-outline" size={40} color={ACCENT} />
      </View>
      <Text style={styles.emptyTitle}>Talki Assistant</Text>
      <Text style={styles.emptySubtitle}>
        Ask me anything about your past sessions, or request a summary.
      </Text>

      <View style={styles.suggestionsContainer}>
        {SUGGESTED_PROMPTS.map((p, i) => (
          <Pressable
            key={i}
            onPress={() => onPrompt(p.substring(2).trim())}
            style={({ pressed }) => [styles.suggestionChip, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.suggestionText}>{p}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

import { useTranslation } from 'react-i18next';

// ─── Assistant Chat Screen ─────────────────────────────────────────────────────

export default function AssistantChatScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { canStartSession, presentPaywall, recordSession } = useTrialManager();
  const {
    messages,
    isThinking,
    sendMessage,
    generateSmartSummary,
    loadHistoryContext,
    clearMessages,
  } = useAssistant();

  const {
    isRecording,
    startRecording,
    stopRecording,
    recordingUri,
    clearRecording,
  } = useVoiceRecorder();

  const [inputText, setInputText] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const listRef = useRef<FlatList>(null);

  // Suggested prompts mapped from translation keys
  const translatedPrompts = [
    t('assistant.chat.suggestions.prescription'),
    t('assistant.chat.suggestions.summarize'),
    t('assistant.chat.suggestions.topics'),
    t('assistant.chat.suggestions.recent'),
  ];

  // ─── Empty State ───────────────────────────────────────────────────────────────

  const renderEmptyState = () => (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <Animated.View entering={FadeIn} style={styles.emptyContainer}>
        <View style={styles.emptyIcon}>
          <MaterialCommunityIcons name="robot-outline" size={40} color={ACCENT} />
        </View>
        <Text style={styles.emptyTitle}>{t('assistant.chat.emptyTitle')}</Text>
        <Text style={styles.emptySubtitle}>{t('assistant.chat.emptySubtitle')}</Text>

        <View style={styles.suggestionsContainer}>
          {translatedPrompts.map((p, i) => (
            <Pressable
              key={i}
              onPress={() => sendMessage(p)}
              style={({ pressed }) => [styles.suggestionChip, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.suggestionText}>{p}</Text>
            </Pressable>
          ))}
        </View>
      </Animated.View>
    </TouchableWithoutFeedback>
  );

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, isThinking]);

  // Transcribe voice recording when it completes
  useEffect(() => {
    if (!recordingUri) return;
    const transcribeAndSend = async () => {
      setIsTranscribing(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');

        const fileName = `assistant_${Date.now()}.m4a`;
        const storagePath = `${user.id}/assistant/${fileName}`;
        const formData = new FormData();
        formData.append('file', {
          uri: recordingUri,
          name: fileName,
          type: 'audio/m4a',
        } as any);

        const { error: uploadErr } = await supabase.storage
          .from('recordings')
          .upload(storagePath, formData);
        if (uploadErr) throw uploadErr;

        const { data: { session } } = await supabase.auth.getSession();
        const { data, error } = await supabase.functions.invoke('transcribe-audio', {
          body: { storagePath },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });

        if (error) throw error;

        const text = data?.text;
        if (text) {
          setInputText('');
          await sendMessage(text);
          await recordSession();
        }
      } catch (err: any) {
        Alert.alert('Voice Error', 'Could not transcribe your voice. Please try typing.');
        console.error('Transcription error:', err.message);
      } finally {
        setIsTranscribing(false);
        clearRecording();
      }
    };
    transcribeAndSend();
  }, [recordingUri, recordSession, sendMessage]);

  const handleSend = useCallback(async () => {
    if (!canStartSession) {
      await presentPaywall();
      return;
    }
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    await sendMessage(text);
    await recordSession();
  }, [inputText, sendMessage, canStartSession, router, recordSession]);

  const handleMic = useCallback(async () => {
    if (!canStartSession && !isRecording) {
      await presentPaywall();
      return;
    }
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording, canStartSession, router]);

  const handleSmartSummary = useCallback(async () => {
    if (!canStartSession) {
      await presentPaywall();
      return;
    }
    const history = await loadHistoryContext();
    if (!history || history.length === 0) {
      Alert.alert(t('common.cancel'), t('assistant.chat.noSessions'));
      return;
    }

    const options = history.slice(0, 10).map((s, i) =>
      `${s.date} · ${s.lang_pair} · ${s.turns.length} turns`
    );

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [t('common.cancel'), ...options], cancelButtonIndex: 0, title: t('assistant.chat.pickSession') },
        async (buttonIdx) => {
          if (buttonIdx > 0) {
            await generateSmartSummary(buttonIdx - 1);
            await recordSession();
          }
        }
      );
    } else {
      Alert.alert(t('assistant.chat.smartSummary'), `${t('assistant.chat.summarize')}?`, [
        { text: t('common.cancel'), style: 'cancel' },
        { 
          text: t('assistant.chat.summarize'), 
          onPress: async () => {
            await generateSmartSummary(0);
            await recordSession();
          } 
        },
      ]);
    }
  }, [loadHistoryContext, generateSmartSummary, t, recordSession, canStartSession, presentPaywall]);

  const handleClearChat = useCallback(() => {
    Alert.alert(t('assistant.chat.clearChat'), t('assistant.chat.clearChatConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.clear'), style: 'destructive', onPress: clearMessages },
    ]);
  }, [clearMessages, t]);

  const handleBack = () => router.back();

  const isBusy = isThinking || isTranscribing;

  return (
    <Box flex={1} backgroundColor="background">
      {/* Header */}
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Box
          paddingHorizontal="small"
          paddingTop="xxxl"
          paddingBottom="small"
          borderBottomWidth={0.5}
          borderBottomColor="borderLight"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Box flexDirection="row" alignItems="center">
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons name={I18nManager.isRTL ? "chevron-forward" : "chevron-back"} size={24} color="#1E293B" />
            </TouchableOpacity>
            <Box marginLeft="small">
              <Text variant="subheading" color="text" fontWeight="bold">{t('assistant.title')}</Text>
              <Text variant="captionSmall" color="textSecondary">{t('assistant.subtitle')}</Text>
            </Box>
          </Box>

          <Box flexDirection="row" alignItems="center">
            <TouchableOpacity onPress={handleSmartSummary} style={styles.summaryBtn}>
              <MaterialCommunityIcons name="lightning-bolt" size={15} color={ACCENT} />
              <Text style={styles.summaryBtnText}>{t('assistant.chat.smartSummary')}</Text>
            </TouchableOpacity>

            {messages.length > 0 && (
              <TouchableOpacity onPress={handleClearChat} style={{ marginLeft: 10, padding: 6 }}>
                <Ionicons name="trash-outline" size={18} color="#CBD5E1" />
              </TouchableOpacity>
            )}
          </Box>
        </Box>
      </TouchableWithoutFeedback>

      {/* Messages */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {messages.length === 0 && !isThinking ? (
          renderEmptyState()
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={item => item.id}
            renderItem={({ item, index }) => <MessageBubble message={item} index={index} />}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              <>
                {isThinking && <TypingIndicator />}
                <View style={{ height: 20 }} />
              </>
            }
          />
        )}

        {/* Input Bar */}
        <View style={styles.inputBar}>
          {isTranscribing ? (
            <View style={styles.transcribingBadge}>
              <ActivityIndicator size="small" color={ACCENT} />
              <Text style={{ color: ACCENT, fontSize: 12, marginLeft: 6, fontWeight: '600' }}>
                {t('assistant.chat.transcribing')}
              </Text>
            </View>
          ) : (
            <TextInput
              style={styles.textInput}
              placeholder={t('assistant.chat.placeholder')}
              placeholderTextColor="#94A3B8"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!isBusy}
              textAlign={I18nManager.isRTL ? 'right' : 'left'}
            />
          )}

          <TouchableOpacity
            onPress={handleMic}
            style={[styles.micBtn, isRecording && styles.micBtnActive]}
            disabled={isThinking || isTranscribing}
          >
            {isRecording
              ? <Ionicons name="stop" size={18} color="#fff" />
              : <Ionicons name="mic" size={18} color={ACCENT} />
            }
          </TouchableOpacity>

          {inputText.trim().length > 0 && (
            <TouchableOpacity onPress={handleSend} style={styles.sendBtn} disabled={isBusy}>
              <Ionicons name={I18nManager.isRTL ? "send" : "send"} size={16} color="#fff" style={{ transform: [{ scaleX: I18nManager.isRTL ? -1 : 1 }] }} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Box>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(66,0,128,0.15)',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: ACCENT,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 21,
  },
  textUser: {
    color: '#fff',
  },
  textAssistant: {
    color: '#1E293B',
  },
  timeText: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'right',
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  typingBubble: {
    backgroundColor: '#F1F5F9',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 0.5,
    borderColor: '#E2E8F0',
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: ACCENT,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#fff',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1E293B',
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  micBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(66,0,128,0.2)',
  },
  micBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#dc2626',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transcribingBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(66,0,128,0.2)',
  },
  emptyContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(66,0,128,0.15)',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  suggestionsContainer: {
    width: '100%',
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  suggestionText: {
    fontSize: 14,
    color: '#334155',
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(66,0,128,0.15)',
  },
  summaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT_LIGHT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(66,0,128,0.2)',
  },
  summaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: ACCENT,
  },
});
