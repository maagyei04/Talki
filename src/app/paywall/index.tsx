import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, View, Platform, I18nManager, ImageBackground } from 'react-native';
import { Box, Text, theme } from '@/src/services/config';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { useTrialManager } from '@/src/shared/hooks/useTrialManager';
import { Alert } from 'react-native';
import { ExternalLink } from '@/src/shared/components/external-link';

const ACCENT = '#420080ff';

export default function PaywallScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setIsPremium, restorePurchases } = useTrialManager();
  const [isRestoring, setIsRestoring] = React.useState(false);

  const handleSubscribe = (plan: 'monthly' | 'yearly') => {
    // Simulated Purchase Logic
    Alert.alert(
      t('common.success', 'Success!'),
      `You are now a Talki Premium member (${plan} plan).`,
      [
        { 
          text: 'OK', 
          onPress: () => {
            setIsPremium(true);
            router.back();
          } 
        }
      ]
    );
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      const restored = await restorePurchases();
      if (restored) {
        Alert.alert(
          '✅ Purchases Restored',
          'Your Talki Premium subscription has been restored.',
          [{ text: 'Great!', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any previous purchases linked to this Apple ID.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <Box flex={1} backgroundColor="background">
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* Hero Section */}
        <Box height={350} backgroundColor="black">
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)', 'black']}
            style={StyleSheet.absoluteFill}
          />
          <Box flex={1} justifyContent="center" alignItems="center" padding="xl">
            <Animated.View entering={FadeIn.duration(1000)}>
              <Box 
                width={80} 
                height={80} 
                borderRadius="xxl" 
                backgroundColor="white" 
                justifyContent="center" 
                alignItems="center"
                marginBottom="medium"
              >
                <MaterialCommunityIcons name="star" size={40} color={ACCENT} />
              </Box>
            </Animated.View>
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <Text variant="heading2" color="white" textAlign="center" fontWeight="bold">
                {t('paywall.title')}
              </Text>
              <Text variant="body" color="border" textAlign="center" marginTop="small">
                {t('paywall.subtitle')}
              </Text>
            </Animated.View>
          </Box>

          <TouchableOpacity 
            onPress={() => router.back()} 
            style={[styles.closeBtn, { left: I18nManager.isRTL ? undefined : 20, right: I18nManager.isRTL ? 20 : undefined }]}
          >
            <BlurView intensity={30} tint="light" style={styles.blurClose}>
              <Ionicons name="close" size={24} color="white" />
            </BlurView>
          </TouchableOpacity>
        </Box>

        {/* content */}
        <Box padding="xl" style={styles.contentContainer}>
          <Box marginBottom="xl">
            <FeatureRow icon="infinite" text={t('paywall.features.live')} />
            <FeatureRow icon="robot" text={t('paywall.features.assistant')} />
            <FeatureRow icon="volume-high" text={t('paywall.features.voices')} />
            <FeatureRow icon="cloud-upload" text={t('paywall.features.sync')} />
          </Box>

          {/* Pricing Options */}
          <PricingOption
            title={t('paywall.plans.yearly')}
            price={t('paywall.plans.yearlyPrice')}
            savings={t('paywall.plans.yearlySavings')}
            onPress={() => handleSubscribe('yearly')}
            bestValue
          />
          <PricingOption
            title={t('paywall.plans.monthly')}
            price={t('paywall.plans.monthlyPrice')}
            onPress={() => handleSubscribe('monthly')}
          />

          <Box marginTop="xl" alignItems="center">
            <TouchableOpacity onPress={handleRestore} disabled={isRestoring}>
              <Text variant="caption" color="info" fontWeight="bold">
                {isRestoring ? 'Restoring...' : t('paywall.restore')}
              </Text>
            </TouchableOpacity>
            
            <Box flexDirection="row" marginTop="medium" gap="medium" alignItems="center">
              <ExternalLink href={'https://maagyei04.github.io/Talki/privacy/' as any}>
                <Text variant="captionSmall" color="textSecondary">{t('paywall.privacy')}</Text>
              </ExternalLink>
              <Text variant="captionSmall" color="borderLight">|</Text>
              <ExternalLink href={'https://maagyei04.github.io/Talki/terms/' as any}>
                <Text variant="captionSmall" color="textSecondary">{t('paywall.terms')}</Text>
              </ExternalLink>
            </Box>
          </Box>
        </Box>
      </ScrollView>
    </Box>
  );
}

function FeatureRow({ icon, text }: { icon: any, text: string }) {
  return (
    <Box flexDirection={I18nManager.isRTL ? "row-reverse" : "row"} alignItems="center" marginBottom="medium">
      <Box width={32} height={32} borderRadius="md" backgroundColor="backgroundSecondary" justifyContent="center" alignItems="center">
        <MaterialCommunityIcons name={icon} size={18} color={ACCENT} />
      </Box>
      <Text variant="body" marginLeft={I18nManager.isRTL ? "none" : "medium"} marginRight={I18nManager.isRTL ? "medium" : "none"} color="text">
        {text}
      </Text>
    </Box>
  );
}

function PricingOption({ title, price, savings, bestValue, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={{ marginBottom: 12 }}>
      <Box 
        padding="large" 
        backgroundColor="white" 
        borderRadius="lg" 
        borderWidth={bestValue ? 2 : 1}
        borderColor={bestValue ? "info" : "borderLight"}
        flexDirection={I18nManager.isRTL ? "row-reverse" : "row"}
        alignItems="center"
        justifyContent="space-between"
      >
        <Box>
          <Text variant="label" fontWeight="bold">{title}</Text>
          <Text variant="bodySmall" color="textSecondary">{price}</Text>
        </Box>
        {savings && (
          <Box backgroundColor="info" paddingHorizontal="small" paddingVertical="nano" borderRadius="sm">
            <Text variant="captionSmall" color="white" fontWeight="bold">{savings}</Text>
          </Box>
        )}
      </Box>
      {bestValue && (
        <Box 
          position="absolute" 
          top={-10} 
          right={20} 
          backgroundColor="info" 
          paddingHorizontal="small" 
          borderRadius="sm"
        >
          <Text variant="captionSmall" color="white" fontWeight="bold">BEST VALUE</Text>
        </Box>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    position: 'absolute',
    top: 50,
    zIndex: 10,
  },
  blurClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    marginTop: -40,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    flex: 1,
  },
});
