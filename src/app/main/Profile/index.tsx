import { Box, Text } from '@/src/services/config';
import { supabase } from '@/src/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface UserProfile {
  email: string;
  full_name?: string;
  avatar_url?: string | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ translations: 0, languages: 0, streak: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    fetchStats();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      fetchStats();
    }, [])
  );

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setProfile({
          email: user.email || '',
          full_name: user.user_metadata?.full_name || 'Talki User',
          avatar_url: user.user_metadata?.avatar_url || null,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStreak = (dates: string[]) => {
    if (dates.length === 0) return 0;
    const uniqueDates = Array.from(new Set(dates.map(d => d.split('T')[0]))).sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

    let streak = 0;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const current = new Date(uniqueDates[i]);
      const next = new Date(uniqueDates[i + 1]);
      const diff = (current.getTime() - next.getTime()) / (1000 * 3600 * 24);
      if (diff === 1) streak++;
      else break;
    }
    return streak + 1;
  };

  const fetchStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count: transCount } = await supabase
        .from('messages')
        .select('id, conversations!inner(user_id)', { count: 'exact', head: true })
        .eq('conversations.user_id', user.id)
        .eq('speaker', 'me');

      const { data: convos } = await supabase
        .from('conversations')
        .select('target_lang, created_at')
        .eq('user_id', user.id);

      if (convos) {
        setStats({
          translations: transCount || 0,
          languages: new Set(convos.map(c => c.target_lang)).size,
          streak: calculateStreak(convos.map(c => c.created_at))
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              router.replace('/auth');
            }
          }
        }
      ]
    );
  };

  const SettingItem = ({ icon, label, value, onPress, isLast = false, color = '#420080ff' }: any) => (
    <Pressable onPress={onPress}>
      <Box
        flexDirection="row"
        alignItems="center"
        paddingVertical="medium"
        borderBottomWidth={isLast ? 0 : 0.5}
        borderBottomColor="borderLight"
      >
        <Box
          width={36}
          height={36}
          borderRadius="md"
          backgroundColor="backgroundSecondary"
          justifyContent="center"
          alignItems="center"
          marginRight="medium"
        >
          <Ionicons name={icon} size={20} color={color} />
        </Box>
        <Box flex={1}>
          <Text variant="label" color="text">{label}</Text>
          {value && <Text variant="caption" color="textSecondary">{value}</Text>}
        </Box>
        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
      </Box>
    </Pressable>
  );

  return (
    <Box flex={1} backgroundColor="background">
      <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <Animated.View entering={FadeInDown.duration(600)} style={[styles.header, { backgroundColor: 'black' }]}>
          <Box paddingHorizontal="xl" paddingTop="xxxl" paddingBottom="xxl">
            <Box flexDirection="row" alignItems="center">
              <Box
                width={70}
                height={70}
                borderRadius="xxl"
                backgroundColor="backgroundTertiary"
                justifyContent="center"
                alignItems="center"
                marginRight="medium"
                style={{ borderWidth: 3, borderColor: '#420080ff', overflow: 'hidden' }}
              >
                {profile?.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                  />
                ) : (
                  <Text fontSize={30} fontWeight="bold" color="white">
                    {profile?.full_name?.charAt(0) || 'U'}
                  </Text>
                )}
              </Box>
              <Box flex={1}>
                <Text variant="heading2" color="white" marginBottom="nano">{profile?.full_name || 'User'}</Text>
                <Text variant="bodySmall" color="border">{profile?.email || 'user@example.com'}</Text>
              </Box>
            </Box>
          </Box>
        </Animated.View>

        {/* Stats Section */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)} style={[styles.negativeLarge, { paddingHorizontal: 20 }]}>
          <Box
            backgroundColor="white"
            padding="medium"
            borderRadius="lg"
            flexDirection="row"
            justifyContent="space-around"
            style={styles.statsContainer}
          >
            <Box alignItems="center">
              <Text variant="subheading" color="info">{stats.translations}</Text>
              <Text variant="captionSmall" color="textSecondary">TRANSLATIONS</Text>
            </Box>
            <Box width={1} backgroundColor="borderLight" />
            <Box alignItems="center">
              <Text variant="subheading" color="info">{stats.languages}</Text>
              <Text variant="captionSmall" color="textSecondary">LANGUAGES</Text>
            </Box>
            <Box width={1} backgroundColor="borderLight" />
            <Box alignItems="center">
              <Text variant="subheading" color="info">{stats.streak}</Text>
              <Text variant="captionSmall" color="textSecondary">STREAK</Text>
            </Box>
          </Box>
        </Animated.View>

        {/* Settings Group: Account */}
        <Box paddingHorizontal="medium" marginTop="large">
          <Text variant="caption" color="textSecondary" fontWeight="bold" marginBottom="small" marginLeft="nano">ACCOUNT</Text>
          <Box>
            <SettingItem icon="person-outline" label="Edit Profile" onPress={() => router.push('/settings/edit-profile')} />
            <SettingItem icon="notifications-outline" label="Notifications" onPress={() => router.push('/settings/notifications')} />
            <SettingItem icon="lock-closed-outline" label="Privacy & Security" onPress={() => router.push('/settings/privacy')} isLast />
          </Box>
        </Box>

        {/* Settings Group: App */}
        <Box paddingHorizontal="medium" marginTop="large">
          <Text variant="caption" color="textSecondary" fontWeight="bold" marginBottom="small" marginLeft="nano">PREFERENCES</Text>
          <Box>
            <SettingItem icon="mic-outline" label="Preferred Voice" value="Aura (English-US)" onPress={() => router.push('/settings/voice')} />
            <SettingItem icon="color-palette-outline" label="Theme" value="Light Modern" onPress={() => router.push('/settings/theme')} isLast />
          </Box>
        </Box>

        {/* Support & Logout */}
        <Box paddingHorizontal="medium" marginTop="large" marginBottom="xxl">
          <Text variant="caption" color="textSecondary" fontWeight="bold" marginBottom="small" marginLeft="nano">MORE</Text>
          <Box>
            <SettingItem icon="help-circle-outline" label="Support" onPress={() => router.push('/settings/support')} />
            <SettingItem
              icon="log-out-outline"
              label="Logout"
              color="#ff4444"
              onPress={handleLogout}
              isLast
            />
          </Box>
        </Box>

        <Box alignItems="center" marginBottom="xxxl">
          <Text variant="captionSmall" color="textDisabled">Talki AI v1.0.0</Text>
        </Box>
      </ScrollView>
    </Box>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  statsContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  negativeLarge: {
    marginTop: -40,
  }
});
