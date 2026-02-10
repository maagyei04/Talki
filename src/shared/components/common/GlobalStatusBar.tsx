import { useTheme } from '@/src/shared/contexts/ThemeContext';
import { usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

const GlobalStatusBar = () => {
    const { themeMode } = useTheme();
    const pathname = usePathname();

    const getStatusBarStyle = () => {
        // Profile screen has a dark header, so we need light status bar
        if (pathname === '/main/Profile') return 'light';

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
