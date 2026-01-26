import { Box, Text } from '@/src/services/config/index';
import { Link, Stack } from 'expo-router';
import React from 'react';
import { Image, StyleSheet } from 'react-native';


export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '404 Error', headerShown: false }} />
      <Box flex={1} backgroundColor="background" style={styles.container}>
        <Image
          source={require('@/src/assets/images/icon.png')}
          style={styles.logo}
        />
        <Text variant="subheading3" color="text" marginVertical="large" textAlign="center">
          Oops! Page Not Found
        </Text>
        <Text variant="body" color="textSecondary" textAlign="center" marginBottom="large">
          The page you are looking for doesn&apos;t exist or has been moved.
        </Text>
        <Link href="/main/Home" style={styles.link}>
          <Box
            backgroundColor="primary"
            paddingVertical="medium"
            paddingHorizontal="xl"
            borderRadius="medium"
          >
            <Text variant="body" color="white">
              Return Home
            </Text>
          </Box>
        </Link>
      </Box>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
    marginBottom: 20
  },
  link: {
    marginTop: 15,
  }
});
