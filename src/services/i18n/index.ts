import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import fi from './locales/fi.json';
import sv from './locales/sv.json';
import ar from './locales/ar.json';

const resources = {
  en: { translation: en },
  fi: { translation: fi },
  sv: { translation: sv },
  ar: { translation: ar },
};

const LANGUAGE_KEY = 'user-language';

// Initialize i18n instance first with synchronous config
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // Default to English initially
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

const initI18n = async () => {
  try {
    let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

    if (!savedLanguage) {
      const locales = Localization.getLocales();
      if (locales && locales.length > 0) {
        savedLanguage = locales[0].languageCode || 'en';
      } else {
        savedLanguage = 'en';
      }
    }

    if (savedLanguage && savedLanguage !== i18n.language) {
      await i18n.changeLanguage(savedLanguage);
    }
  } catch (error) {
    console.error('i18n sync error:', error);
  }
};

initI18n();

export default i18n;
