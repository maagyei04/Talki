import { Dimensions, PixelRatio, Platform, ScaledSize } from 'react-native';

const window = Dimensions.get('window');
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = window;

// Base dimensions (iPhone 14 Pro)
const baseWidth = 393;
const baseHeight = 852;

const scale = SCREEN_WIDTH / baseWidth;
const verticalScale = SCREEN_HEIGHT / baseHeight;
const moderateScale = (size: number, factor: number = 0.5) =>
    size + ((scale - 1) * factor * size);

export const normalize = (size: number): number => {
    const newSize = size * scale;
    if (Platform.OS === 'ios') {
        return Math.round(PixelRatio.roundToNearestPixel(newSize));
    }
    return Math.round(PixelRatio.roundToNearestPixel(newSize)) - 2;
};

export const spacing = {
    nano: normalize(2),
    micro: normalize(4),
    tiny: normalize(8),
    small: normalize(12),
    base: normalize(16),
    medium: normalize(24),
    large: normalize(32),
    xl: normalize(40),
    xxl: normalize(48),
    xxxl: normalize(64)
} as const;

export const padding = {
    xs: normalize(8),
    sm: normalize(12),
    md: normalize(16),
    lg: normalize(24),
    xl: normalize(32),
    horizontal: normalize(16),
    vertical: normalize(12),
    screen: normalize(16)
} as const;

export const margin = {
    xs: normalize(8),
    sm: normalize(12),
    md: normalize(16),
    lg: normalize(24),
    xl: normalize(32),
    horizontal: normalize(16),
    vertical: normalize(12),
    screen: normalize(16)
} as const;

export const layout = {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    isSmallDevice: SCREEN_WIDTH < 375,
    isMediumDevice: SCREEN_WIDTH >= 375 && SCREEN_WIDTH < 414,
    isLargeDevice: SCREEN_WIDTH >= 414,
    isTablet: SCREEN_WIDTH >= 768 && SCREEN_HEIGHT >= 768,
    isLandscape: SCREEN_WIDTH > SCREEN_HEIGHT,
    window,
    screen: Dimensions.get('screen')
} as const;

export const borderRadius = {
    xs: normalize(4),
    sm: normalize(8),
    md: normalize(12),
    lg: normalize(16),
    xl: normalize(24),
    round: normalize(999)
} as const;

export const iconSize = {
    xs: normalize(12),
    sm: normalize(16),
    md: normalize(24),
    lg: normalize(32),
    xl: normalize(40),
    xxl: normalize(48)
} as const;

export const imageSize = {
    xs: normalize(24),
    sm: normalize(32),
    md: normalize(48),
    lg: normalize(64),
    xl: normalize(96),
    xxl: normalize(128),
    full: SCREEN_WIDTH
} as const;

Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
    const { width, height } = window;
});