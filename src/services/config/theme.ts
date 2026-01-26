import { createTheme } from '@shopify/restyle';
import { borderRadius, normalize, spacing } from "@utils/helpers/dimensions";

const palette = {
  primary: '#000000',
  primary2: '#0000001A',
  primaryLight: '#333333',
  primaryDark: '#000000',
  secondary: '#E0E0E0',
  secondaryLight: '#F5F5F5',
  tertiary: '#9E9E9E',
  success: '#000000',
  successLight: '#CCCCCC',
  bg: "#0000000D",
  error: '#212121',
  errorLight: '#EEEEEE',
  danger: '#1A1A1A',
  warning: '#757575',
  warningLight: '#F0F0F0',
  info: '#420080ff',
  infoLight: '#E8E8E8',
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#FAFAFA',
  gray100: '#F5F5F5',
  gray200: '#EEEEEE',
  gray300: '#E0E0E0',
  gray400: '#BDBDBD',
  gray500: '#9E9E9E',
  gray600: '#757575',
  gray700: '#616161',
  gray800: '#424242',
  gray900: '#212121',
  gradientStart: '#000000',
  gradientEnd: '#333333',
  transparent: '#FFFFFF00',
  overlay: '#00000080',
  overlayLight: '#00000040',
  overlayDark: '#000000B3',
} as const;

const theme = createTheme({
  colors: {
    primary: palette.primary,
    primary2: palette.primary2,
    primaryLight: palette.primaryLight,
    primaryDark: palette.primaryDark,
    secondary: palette.secondary,
    secondaryLight: palette.secondaryLight,
    tertiary: palette.tertiary,
    success: palette.success,
    successLight: palette.successLight,
    error: palette.error,
    errorLight: palette.errorLight,
    danger: palette.danger,
    warning: palette.warning,
    warningLight: palette.warningLight,
    info: palette.info,
    infoLight: palette.infoLight,
    white: palette.white,
    black: palette.black,
    gradientStart: palette.gradientStart,
    gradientEnd: palette.gradientEnd,
    transparent: palette.transparent,
    overlay: palette.overlay,
    overlayLight: palette.overlayLight,
    overlayDark: palette.overlayDark,

    text: palette.black,
    textSecondary: palette.gray600,
    textDisabled: palette.gray400,
    textInverse: palette.white,
    textLink: palette.primary,

    background: palette.white,
    backgroundSecondary: palette.gray100,
    backgroundTertiary: palette.gray400,
    backgroundInverse: palette.black,
    bg: palette.bg,

    border: palette.gray300,
    borderLight: palette.gray200,
    borderDark: palette.gray400,

    shadow: palette.black,
    shadowLight: palette.gray500,

    card: palette.white,
  },

  spacing: {
    none: 0,
    nano: spacing.nano,
    micro: spacing.micro,
    tiny: spacing.tiny,
    small: spacing.small,
    base: spacing.base,
    medium: spacing.medium,
    large: spacing.large,
    xl: spacing.xl,
    xxl: spacing.xxl,
    xxxl: spacing.xxxl,
  },

  borderRadii: {
    none: 0,
    xs: borderRadius.xs,
    sm: borderRadius.sm,
    md: borderRadius.md,
    lg: borderRadius.lg,
    xl: borderRadius.xl,
    xxl: normalize(24),
    round: borderRadius.round,
  },

  textVariants: {
    defaults: {
      fontSize: normalize(16),
      color: 'text',
      lineHeight: normalize(22),
      fontFamily: 'Poppins_400Regular',
    },
    hero: {
      fontSize: normalize(48),
      lineHeight: normalize(56),
      fontFamily: 'Poppins_700Bold',
    },
    heading: {
      fontSize: normalize(30),
      lineHeight: normalize(45),
      fontFamily: 'Poppins_700Bold',
    },
    heading2: {
      fontSize: normalize(24),
      lineHeight: normalize(32),
      fontFamily: 'Poppins_600SemiBold',
    },
    subheading: {
      fontSize: normalize(18),
      lineHeight: normalize(24),
      fontFamily: 'Poppins_600SemiBold',
    },
    subheading2: {
      fontSize: normalize(25),
      lineHeight: normalize(30),
      fontFamily: 'Poppins_600SemiBold',
    },
    subheading3: {
      fontSize: normalize(30),
      lineHeight: normalize(36),
      fontFamily: 'Poppins_600SemiBold',
    },
    body: {
      fontSize: normalize(16),
      lineHeight: normalize(22),
      fontFamily: 'Poppins_400Regular',
    },
    bodyLarge: {
      fontSize: normalize(18),
      lineHeight: normalize(26),
      fontFamily: 'Poppins_400Regular',
    },
    bodySmall: {
      fontSize: normalize(14),
      lineHeight: normalize(20),
      fontFamily: 'Poppins_400Regular',
    },
    caption: {
      fontSize: normalize(12),
      lineHeight: normalize(16),
      fontFamily: 'Poppins_400Regular',
    },
    captionSmall: {
      fontSize: normalize(10),
      lineHeight: normalize(14),
      fontFamily: 'Poppins_400Regular',
    },
    label: {
      fontSize: normalize(14),
      lineHeight: normalize(20),
      fontFamily: 'Poppins_500Medium',
    },
    button: {
      fontSize: normalize(16),
      lineHeight: normalize(22),
      fontFamily: 'Poppins_600SemiBold',
    },
    buttonSmall: {
      fontSize: normalize(14),
      lineHeight: normalize(20),
      fontFamily: 'Poppins_600SemiBold',
    },
  },

  breakpoints: {
    phone: 0,
    tablet: 768,
    desktop: 1024,
  },

  zIndices: {
    background: 0,
    base: 1,
    dropdown: 1000,
    sticky: 1100,
    overlay: 1200,
    modal: 1300,
    popover: 1400,
    toast: 1500,
  },
});

export const Fonts = {
  sans: 'Poppins_400Regular',
  serif: 'Poppins_400Regular',
  rounded: 'Poppins_400Regular',
  mono: 'Poppins_400Regular',
};

export type Theme = typeof theme;
export default theme;