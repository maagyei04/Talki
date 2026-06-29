import * as SecureStore from 'expo-secure-store';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const DEVICE_ID_KEY = 'talki_device_id';

/**
 * Gets or creates a unique device ID that is persisted in SecureStore.
 * This ID survives app uninstallation/reinstallation on most platforms.
 */
export async function getPersistentDeviceId(): Promise<string> {
  try {
    // Check if we already have a stored ID
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);

    if (!deviceId) {
      // Create a new one if it doesn't exist
      deviceId = uuidv4();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      console.log('Generated new persistent device ID:', deviceId);
    } else {
      console.log('Retrieved existing persistent device ID:', deviceId);
    }

    return deviceId;
  } catch (error) {
    console.error('Error managing device ID:', error);
    // Fallback to a non-persistent ID if SecureStore fails
    return `fallback-${Date.now()}`;
  }
}
