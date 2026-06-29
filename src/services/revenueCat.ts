import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
}) ?? '';

let _initialized = false;

/**
 * Initializes the RevenueCat SDK once for the lifetime of the app.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initializeRevenueCat(): void {
  if (_initialized) return;

  if (!REVENUECAT_API_KEY) {
    console.warn('[RevenueCat] ⚠️ No API key found. Check your .env file.');
    return;
  }

  try {
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    _initialized = true;
    console.log('[RevenueCat] ✅ SDK initialized');
  } catch (err) {
    console.error('[RevenueCat] ❌ Failed to initialize:', err);
  }
}
