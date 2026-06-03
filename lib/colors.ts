import { useSettings } from '@/lib/settings-context';

export const colors = {
  purple: {
    50:  '#f2f0ff',
    100: '#e0dbff',
    200: '#c1b8ff',
    300: '#9e8fff',
    400: '#8370ff',
    500: '#6047ff',
    600: '#381aff',
    700: '#1e00e0',
    800: '#1600a8',
    900: '#0f0070',
    950: '#0a0047',
  },
  neutral: {
    0:   '#ffffff',
    50:  '#fafafa',
    100: '#efefef',
    200: '#e0e0e0',
    300: '#c9c9c9',
    400: '#b5b5b5',
    500: '#9e9e9e',
    600: '#757575',
    700: '#424242',
    800: '#323232',
    900: '#212121',
    950: '#121212',
  },
  green: {
    50:  '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  red: {
    50:  '#fef1f1',
    100: '#fddfdd',
    200: '#fbbfbb',
    300: '#f99b94',
    400: '#f76e64',
    500: '#f44336',
    600: '#e41b0c',
    700: '#ae1409',
    800: '#790e06',
    900: '#440804',
  },
  yellow: {
    50:  '#fefce8',
    100: '#fef9c3',
    200: '#fef08a',
    300: '#fde047',
    400: '#facc15',
    500: '#eab308',
    600: '#ca8a04',
    700: '#a16207',
    800: '#854d0e',
    900: '#713f12',
  },
  blackTransparent: {
    8:  '#12121214',
    16: '#12121229',
    24: '#1212123d',
    32: '#12121252',
    40: '#12121266',
    48: '#1212127a',
    56: '#1212128f',
    64: '#121212a3',
    72: '#121212b8',
    80: '#121212cc',
  },
  primary: '#6047ff',
  error:   '#f44336',
} as const;

export type SemanticColors = {
  brand:    { primary: string; pressed: string };
  surface:  { bg: string; default: string; input: string; disabled: string; cardGrey: string };
  text:     { primary: string; secondary: string; label: string; placeholder: string; onPrimary: string; link: string };
  icon:     { onPrimary: string; placeholder: string; error: string; pressed: string };
  border:   { input: string; error: string };
  semantic: { error: string };
};

const light: SemanticColors = {
  brand:    { primary: '#6047ff', pressed: '#381aff' },
  surface:  { bg: '#fafafa', default: '#ffffff', input: '#ffffff', disabled: '#e0e0e0', cardGrey: colors.neutral[100] },
  text:     { primary: '#212121', secondary: '#757575', label: '#424242', placeholder: '#9e9e9e', onPrimary: '#ffffff', link: '#6047ff' },
  icon:     { onPrimary: '#ffffff', placeholder: '#9e9e9e', error: '#f44336', pressed: '#ffffff' },
  border:   { input: '#9e9e9e', error: '#f44336' },
  semantic: { error: '#f44336' },
};

const dark: SemanticColors = {
  brand:    { primary: '#8370ff', pressed: '#6047ff' },
  surface:  { bg: '#121212', default: '#121212', input: '#212121', disabled: '#323232', cardGrey: colors.neutral[700] },
  text:     { primary: '#ffffff', secondary: '#b5b5b5', label: '#c9c9c9', placeholder: '#757575', onPrimary: '#ffffff', link: '#8370ff' },
  icon:     { onPrimary: '#ffffff', placeholder: '#757575', error: '#f76e64', pressed: '#ffffff' },
  border:   { input: '#757575', error: '#f76e64' },
  semantic: { error: '#f76e64' },
};

export function useColors(): SemanticColors {
  const { colorScheme } = useSettings();
  return colorScheme === 'dark' ? dark : light;
}
