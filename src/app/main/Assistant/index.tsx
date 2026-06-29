import { Box, Text } from '@/src/services/config';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { I18nManager, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const ACCENT = '#420080ff';
const ACCENT_LIGHT = 'rgba(66,0,128,0.08)';

import { useTranslation } from 'react-i18next';

export default function AssistantLandingScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const handleStart = () => {
    router.push('/assistant');
  };

  return (
    <Box flex={1} backgroundColor="background" padding="medium" justifyContent="center">
      <Animated.View entering={FadeIn.duration(600)} style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="robot-outline" size={48} color={ACCENT} />
        </View>

        <Text variant="heading2" textAlign="center" marginBottom="small" fontWeight="bold">
          {t('assistant.title')}
        </Text>

        <Text variant="body" textAlign="center" color="textSecondary" marginBottom="xl">
          {t('assistant.landing.subtitle')}
        </Text>

        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="microphone"
            title={t('assistant.landing.feature1.title')}
            desc={t('assistant.landing.feature1.desc')}
            delay={200}
          />
          <FeatureItem
            icon="lightning-bolt"
            title={t('assistant.landing.feature2.title')}
            desc={t('assistant.landing.feature2.desc')}
            delay={400}
          />
          <FeatureItem
            icon="microphone-outline"
            title={t('assistant.landing.feature3.title')}
            desc={t('assistant.landing.feature3.desc')}
            delay={600}
          />
        </View>

        <Animated.View entering={FadeInDown.delay(800).springify()}>
          <TouchableOpacity
            onPress={handleStart}
            activeOpacity={0.8}
            style={[styles.mainBtn, { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }]}
          >
            <Text style={styles.mainBtnText}>{t('assistant.landing.startChat')}</Text>
            <Ionicons name={I18nManager.isRTL ? "arrow-back" : "arrow-forward"} size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Box>
  );
}

function FeatureItem({ icon, title, desc, delay }: { icon: any, title: string, desc: string, delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={[styles.featureItem, { flexDirection: I18nManager.isRTL ? 'row-reverse' : 'row' }]}>
      <View style={styles.featureIcon}>
        <MaterialCommunityIcons name={icon} size={20} color={ACCENT} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.featureTitle, { textAlign: I18nManager.isRTL ? 'right' : 'left' }]}>{title}</Text>
        <Text style={[styles.featureDesc, { textAlign: I18nManager.isRTL ? 'right' : 'left' }]}>{desc}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  badge: {
    backgroundColor: ACCENT_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(66,0,128,0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: ACCENT,
    letterSpacing: 1,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: ACCENT_LIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(66,0,128,0.1)',
  },
  featuresContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  mainBtn: {
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 18,
    borderRadius: 30,
    gap: 12,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  mainBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
