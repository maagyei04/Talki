import { HapticTab } from '@/src/shared/components/haptic-tab';
import { useTheme } from '@/src/shared/contexts/ThemeContext';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Animated, Platform } from 'react-native';

export default function MainLayout() {
  const { theme, isDark } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.colors.info,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: () => {
          return (
            <Animated.View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: theme.colors.background,
                borderTopWidth: 0.3,
                borderTopColor: theme.colors.borderLight,
              }}
            />
          );
        },
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: theme.colors.background,
            borderTopWidth: 0.3,
            borderTopColor: theme.colors.borderLight
          },
          default: {
            backgroundColor: theme.colors.background,
            borderTopWidth: 0.3,
            borderTopColor: theme.colors.borderLight,
          },
        }),
      }}>
      <Tabs.Screen name='index' options={{ href: null }} />
      <Tabs.Screen
        name="Home"
        options={{
          title: '',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="History"
        options={{
          title: '',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="history" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Assistant"
        options={{
          title: '',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="robot-outline" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="Profile"
        options={{
          title: '',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={26} color={color} />,
        }}
      />
    </Tabs>
  );
}
