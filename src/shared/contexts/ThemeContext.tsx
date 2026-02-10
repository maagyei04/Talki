import theme, { Theme } from '@/src/services/config/theme';
import { ThemeProvider } from '@shopify/restyle';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

const createDarkTheme = (baseTheme: Theme): Theme => ({
    ...baseTheme,
    colors: {
        ...baseTheme.colors,
        text: '#FFFFFF' as typeof baseTheme.colors.text,
        textSecondary: '#BDBDBD' as typeof baseTheme.colors.textSecondary,

        background: '#0F0F12' as typeof baseTheme.colors.background,
        backgroundSecondary: '#1C1C1E' as typeof baseTheme.colors.backgroundSecondary,
        backgroundTertiary: '#2C2C2E' as typeof baseTheme.colors.backgroundTertiary,

        border: '#2C2C2E' as typeof baseTheme.colors.border,
        borderLight: '#1C1C1E' as typeof baseTheme.colors.borderLight,

        card: '#1C1C1E' as typeof baseTheme.colors.card,
        shadow: 'transparent' as typeof baseTheme.colors.shadow,
    },
});

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextType = {
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => Promise<void>;
    toggleTheme: () => void;
    theme: Theme;
    isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const AppThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const systemColorScheme = useColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

    useEffect(() => {
        // Theme loading disabled for now to force Light Mode
        setThemeModeState('light');
    }, []);

    const setThemeMode = async (mode: ThemeMode) => {
        // Disabled for now
        // setThemeModeState(mode);
        // await saveLocalData('themeMode', mode);
    };

    const toggleTheme = async () => {
        // Disabled for now
    };

    const contextValue = useMemo(() => {
        const effectiveMode = 'light'; // Always Light Mode for now
        const isDark = false;
        const activeTheme = theme;

        return {
            themeMode,
            setThemeMode,
            toggleTheme,
            theme: activeTheme,
            isDark,
        };
    }, [themeMode, systemColorScheme]);

    return (
        <ThemeContext.Provider value={contextValue}>
            <ThemeProvider theme={contextValue.theme}>
                {children}
            </ThemeProvider>
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within an AppThemeProvider');
    }
    return context;
};
