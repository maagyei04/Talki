import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/src/services/supabase';
import { getPersistentDeviceId } from '../utils/deviceId';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

export const useTrialManager = () => {
  const [sessionsUsed, setSessionsUsed] = useState<number>(0);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  // Initialize RevenueCat and Device ID
  useEffect(() => {
    const init = async () => {
      try {
        const id = await getPersistentDeviceId();
        console.log('Talki Device ID:', id);
        setDeviceId(id);

        // Fetch trial sessions from Supabase
        const { data, error } = await supabase
          .from('device_trials')
          .select('sessions_used')
          .eq('device_id', id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching trial status:', error);
        } else if (data) {
          console.log('Initial trial sessions found:', data.sessions_used);
          setSessionsUsed(data.sessions_used);
        } else {
          console.log('No trial record found for device, starting at 0.');
        }

        // SDK is already initialized in _layout.tsx — just fetch customer status
        const customerInfo = await Purchases.getCustomerInfo();
        updatePremiumStatus(customerInfo);
      } catch (err) {
        console.error('Initialization error in useTrialManager:', err);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // Listener for RevenueCat changes
    const listener = (customerInfo: CustomerInfo) => {
      updatePremiumStatus(customerInfo);
    };
    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const updatePremiumStatus = (customerInfo: CustomerInfo) => {
    // Check if the user has an active entitlement (e.g., 'premium')
    const premium = customerInfo.entitlements.active['premium'] !== undefined;
    setIsPremium(premium);
  };

  const recordSession = useCallback(async () => {
    if (!deviceId || isPremium) return;

    try {
      console.log('Recording trial session for device:', deviceId);
      // Call Supabase RPC to increment sessions_used
      const { data, error } = await supabase.rpc('use_trial_session', {
        target_device_id: deviceId
      });

      if (error) {
        console.error('Supabase RPC Error:', error.message, error.details, error.hint);
      } else {
        console.log('Successfully recorded session. New count:', data);
        setSessionsUsed(data);
      }
    } catch (err) {
      console.error('RPC call error:', err);
    }
  }, [deviceId, isPremium]);

  const presentPaywall = async () => {
    try {
      const result: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();
      console.log('Paywall result:', result);
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        const customerInfo = await Purchases.getCustomerInfo();
        updatePremiumStatus(customerInfo);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error presenting paywall:', err);
      return false;
    }
  };

  const restorePurchases = async (): Promise<boolean> => {
    try {
      console.log('[RevenueCat] Restoring purchases...');
      const customerInfo = await Purchases.restorePurchases();
      updatePremiumStatus(customerInfo);
      const isNowPremium = customerInfo.entitlements.active['premium'] !== undefined;
      console.log('[RevenueCat] Restore complete. Premium:', isNowPremium);
      return isNowPremium;
    } catch (err) {
      console.error('[RevenueCat] Restore failed:', err);
      return false;
    }
  };

  const canStartSession = isPremium || sessionsUsed < 3;

  return {
    sessionsUsed,
    isPremium,
    canStartSession,
    recordSession,
    presentPaywall,
    restorePurchases,
    isLoading,
    setIsPremium,
  };
};
