import '@/src/services/i18n';
import { initializeRevenueCat } from '@/src/services/revenueCat';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { supabase } from '@/src/services/supabase';
import Purchases from 'react-native-purchases';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';
import { LanguageProvider } from '../shared/contexts/LanguageContext';
import { AppThemeProvider } from '../shared/contexts/ThemeContext';

import ErrorBoundary from '../shared/components/common/ErrorBoundary';
import GlobalStatusBar from '../shared/components/common/GlobalStatusBar';

export const unstable_settings = {
  anchor: 'index',
};

SplashScreen.preventAutoHideAsync();

// Initialize RevenueCat once at app start, before any component mounts.
initializeRevenueCat();

export default function RootLayout() {
  const [loaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const { isUpdateAvailable, isUpdatePending } = Updates.useUpdates();

  // Check for OTA updates
  useEffect(() => {
    if (isUpdatePending) {
      Alert.alert(
        'Update Available',
        'A new version of Talki has been downloaded. Restart the app to apply the update?',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Restart Now', onPress: () => Updates.reloadAsync() },
        ]
      );
    }
  }, [isUpdatePending]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  // Global auth listener to sync RevenueCat user ID
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        Purchases.logIn(session.user.id).catch(console.error);
      } else if (event === 'SIGNED_OUT') {
        Purchases.logOut().catch((err) => {
          if (err && err.message && err.message.includes('anonymous')) {
            // Safe to ignore, user is already logged out of RevenueCat
            console.log('RevenueCat user is already anonymous, skipping logout.');
          } else {
            console.error('RevenueCat LogOut Error:', err);
          }
        });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LanguageProvider>
          <AppThemeProvider>
            <BottomSheetModalProvider>
              <Stack
                screenOptions={{
                  headerTitleStyle: {
                    fontFamily: 'Poppins_600SemiBold',
                  },
                  headerBackTitleStyle: {
                    fontFamily: 'Poppins_400Regular',
                  },
                }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />

                <Stack.Screen name="auth"
                  options={{
                    headerShown: false,
                    gestureEnabled: true,
                    gestureDirection: 'horizontal',
                  }} />
                <Stack.Screen name="main"
                  options={{
                    headerShown: false,
                    gestureEnabled: true,
                    gestureDirection: 'horizontal',
                  }}
                />
                <Stack.Screen name="settings"
                  options={{
                    headerShown: false,
                    gestureEnabled: true,
                    gestureDirection: 'horizontal',
                  }}
                />
                <Stack.Screen name="assistant"
                  options={{
                    headerShown: false,
                    gestureEnabled: true,
                    gestureDirection: 'horizontal',
                  }}
                />
                <Stack.Screen name="paywall"
                  options={{
                    headerShown: false,
                    presentation: 'modal',
                    animation: 'slide_from_bottom',
                  }}
                />

                <Stack.Screen name="+not-found" />
              </Stack>
              <GlobalStatusBar />
            </BottomSheetModalProvider>
          </AppThemeProvider>
        </LanguageProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
