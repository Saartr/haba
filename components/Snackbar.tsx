import { View, Pressable, ViewStyle } from 'react-native';
import Text from '@/components/Text';
import { colors } from '@/lib/colors';
import CloseIcon from '@/assets/icons/Close.svg';

const SHADOW = {
  shadowColor: '#121212',
  shadowOffset: { width: 1, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;

export type SnackbarType = 'success' | 'error';

const BG: Record<SnackbarType, string> = {
  success: colors.green[600],
  error:   colors.red[500],
};

type Props = {
  text: string;
  type?: SnackbarType;
  /** Опциональная иконка слева. Если не передана — текст начинается от левого края. */
  icon?: React.ReactNode;
  onClose?: () => void;
  style?: ViewStyle;
};

export default function Snackbar({ text, type = 'success', icon, onClose, style }: Props) {
  return (
    <View
      style={[{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: BG[type],
        ...SHADOW,
      }, style]}
    >
      {icon && (
        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
      )}

      <Text
        weight="bold"
        numberOfLines={1}
        style={{ flex: 1, fontSize: 14, lineHeight: 14 * 1.4, letterSpacing: 0.2, color: colors.neutral[0] }}
      >
        {text}
      </Text>

      <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          <CloseIcon width={24} height={24} color={colors.neutral[0]} />
        </View>
      </Pressable>
    </View>
  );
}
