import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View } from 'react-native';
import { Box, Text } from '@/src/services/config';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/src/shared/contexts/LanguageContext';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn } from 'react-native-reanimated';

const LANGUAGES = [
  { code: 'en', name: 'English', native: 'English', icon: '🇺🇸' },
  { code: 'fi', name: 'Finnish', native: 'Suomi', icon: '🇫🇮' },
  { code: 'sv', name: 'Swedish', native: 'Svenska', icon: '🇸🇪' },
  { code: 'ar', name: 'Arabic', native: 'العربية', icon: '🇦🇪' },
];

export default function LanguageSettingsScreen() {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Box flex={1} backgroundColor="background">
      {/* Header */}
      <Box 
        paddingHorizontal="medium" 
        paddingTop="xxxl" 
        paddingBottom="medium"
        flexDirection="row"
        alignItems="center"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text variant="subheading" fontWeight="bold" marginLeft="small">
          {t('common.language', 'Language')}
        </Text>
      </Box>

      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="caption" color="textSecondary" marginBottom="medium" paddingHorizontal="medium">
          Select your preferred application language. This will override your system language.
        </Text>

        <Box paddingHorizontal="medium">
          {LANGUAGES.map((lang, index) => {
            const isSelected = language === lang.code;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => setLanguage(lang.code)}
                style={[
                  styles.langItem,
                  isSelected && styles.langItemActive,
                  index === LANGUAGES.length - 1 && { borderBottomWidth: 0 }
                ]}
              >
                <View style={styles.langLeading}>
                  <Text style={styles.langIcon}>{lang.icon}</Text>
                  <View style={{ marginLeft: 12 }}>
                    <Text variant="label" style={isSelected ? { color: '#420080', fontWeight: 'bold' } : {}}>
                      {lang.native}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {lang.name}
                    </Text>
                  </View>
                </View>
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={24} color="#420080" />
                )}
              </TouchableOpacity>
            );
          })}
        </Box>
      </ScrollView>

      <Animated.View entering={FadeIn.delay(300)} style={styles.footer}>
        <Text variant="captionSmall" color="textSecondary" textAlign="center">
          Changing language to Arabic will reload the app to apply Right-to-Left styling.
        </Text>
      </Animated.View>
    </Box>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: 40,
  },
  backBtn: {
    padding: 4,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E2E8F0',
  },
  langItemActive: {
    // Optional: add a subtle background for the active item
  },
  langLeading: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  langIcon: {
    fontSize: 24,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  }
});
