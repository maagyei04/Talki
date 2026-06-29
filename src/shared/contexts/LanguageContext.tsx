import React, { createContext, useContext, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '@/src/services/i18n';
import * as Updates from 'expo-updates';

type LanguageContextType = {
  language: string;
  setLanguage: (lng: string) => Promise<void>;
  isRTL: boolean;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_KEY = 'user-language';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState(i18n.language || 'en');

  useEffect(() => {
    // Sync state with i18n instance if it changes elsewhere
    const onLanguageChange = (lng: string) => setLanguageState(lng);
    i18n.on('languageChanged', onLanguageChange);
    return () => i18n.off('languageChanged', onLanguageChange);
  }, []);

  const setLanguage = async (lng: string) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    await i18n.changeLanguage(lng);
    setLanguageState(lng);

    const isArabic = lng === 'ar';
    const shouldBeRTL = isArabic;

    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
      
      // RTL changes require a reload to apply layout flips cleanly in Expo
      setTimeout(() => {
        Updates.reloadAsync();
      }, 500);
    }
  };

  return (
    <LanguageContext.Provider value={{ 
      language, 
      setLanguage, 
      isRTL: I18nManager.isRTL 
    }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
