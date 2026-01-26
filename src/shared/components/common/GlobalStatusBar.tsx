import { useTheme } from '@/src/shared/contexts/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

const GlobalStatusBar = () => {
    const { themeMode } = useTheme();

    const getStatusBarStyle = () => {
        if (themeMode === 'dark') return 'light';
        if (themeMode === 'light') return 'dark';
        return 'auto';
    };

    return (
        <StatusBar
            style={getStatusBarStyle()}
            animated={true}
        />
    );
};

export default GlobalStatusBar;
