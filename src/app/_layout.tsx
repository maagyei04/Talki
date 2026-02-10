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
import { AppThemeProvider } from '../shared/contexts/ThemeContext';

import ErrorBoundary from '../shared/components/common/ErrorBoundary';
import GlobalStatusBar from '../shared/components/common/GlobalStatusBar';

export const unstable_settings = {
  anchor: 'index',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
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

              <Stack.Screen name="+not-found" />
            </Stack>
            <GlobalStatusBar />
          </BottomSheetModalProvider>
        </AppThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
