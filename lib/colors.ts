import { useSettings } from '@/lib/settings-context';

export const colors = {
  purple: {
    50:  '#f2f0ff',
    400: '#8370ff',
    500: '#6047ff',
    600: '#381aff',
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
    500: '#22c55e',
    600: '#16a34a',
    800: '#166534',
  },
  red: {
    400: '#f76e64',
    500: '#f44336',
    600: '#e41b0c',
    800: '#790e06',
  },
  primary: '#6047ff',
  error:   '#f44336',
} as const;

export type SemanticColors = {
  brand:    { primary: string; pressed: string };
  surface:  { bg: string; default: string; input: string; disabled: string };
  text:     { primary: string; secondary: string; label: string; placeholder: string; onPrimary: string; link: string };
  icon:     { onPrimary: string; placeholder: string; error: string; pressed: string };
  border:   { input: string; error: string };
  semantic: { error: string };
};

const light: SemanticColors = {
  brand:    { primary: '#6047ff', pressed: '#381aff' },
  surface:  { bg: '#fafafa', default: '#ffffff', input: '#ffffff', disabled: '#e0e0e0' },
  text:     { primary: '#212121', secondary: '#757575', label: '#424242', placeholder: '#9e9e9e', onPrimary: '#ffffff', link: '#6047ff' },
  icon:     { onPrimary: '#ffffff', placeholder: '#9e9e9e', error: '#f44336', pressed: '#ffffff' },
  border:   { input: '#9e9e9e', error: '#f44336' },
  semantic: { error: '#f44336' },
};

const dark: SemanticColors = {
  brand:    { primary: '#8370ff', pressed: '#6047ff' },
  surface:  { bg: '#121212', default: '#121212', input: '#212121', disabled: '#323232' },
  text:     { primary: '#ffffff', secondary: '#b5b5b5', label: '#c9c9c9', placeholder: '#757575', onPrimary: '#ffffff', link: '#8370ff' },
  icon:     { onPrimary: '#ffffff', placeholder: '#757575', error: '#f76e64', pressed: '#ffffff' },
  border:   { input: '#757575', error: '#f76e64' },
  semantic: { error: '#f76e64' },
};

export function useColors(): SemanticColors {
  const { colorScheme } = useSettings();
  return colorScheme === 'dark' ? dark : light;
}
