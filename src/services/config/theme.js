import { createTheme } from '@shopify/restyle';


const palette = {
    primary: '#0088FF',
    secondary: '#F6C000',
    success: '#00C853',
    error: '#FF3B30',
    white: '#FFFFFF',
    black: '#000000',
    gray100: '#F5F5F5',
    gray200: '#EEEEEE',
    gray300: '#E0E0E0',
    gray400: '#BDBDBD',
    gray500: '#9E9E9E',
    gray600: '#757575',
    gray700: '#616161',
    gray800: '#424242',
    gray900: '#212121',
};

const lightTheme = createTheme({
    mode: 'light',
    colors: {
        primary: '#4CAF50',
        background: '#FFFFFF',
        text: '#1A1A1A',
        secondary: '#03DAC6',
        card: '#f5f5f5',
    },
    spacing: {
        s: 8,
        m: 16,
        l: 24,
    },
    textVariants: {
        heading: {
            fontSize: 24,
            fontWeight: 'bold',
            color: 'primary',
        },
        body: {
            fontSize: 16,
            color: 'text',
        },
    },
});

const darkTheme = createTheme({
    mode: 'dark',
    ...lightTheme,
    colors: {
        primary: '#4CAF50',
        background: '#000000FF',
        text: '#FFFFFFFF',
        secondary: '#03DAC6',
        card: '#f5f5f5',
    },
});

export { darkTheme, lightTheme };

