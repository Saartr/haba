import { Pressable, ActivityIndicator, View } from 'react-native';
import Text from '@/components/Text';
import { useColors } from '@/lib/colors';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'main' | 'text';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
};

export default function Button({
  label,
  onPress,
  variant = 'main',
  icon,
  loading = false,
  disabled = false,
}: Props) {
  const c = useColors();
  const isDisabled = disabled || loading;

  if (variant === 'text') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        className="h-14 items-center justify-center"
        style={{ opacity: isDisabled ? 0.5 : 1 }}
      >
        {loading ? (
          <ActivityIndicator color={c.text.link} />
        ) : (
          <Text weight="bold" className="text-body-16 tracking-default" style={{ color: c.text.link }}>
            {label}
          </Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} disabled={isDisabled} style={{ height: 56 }}>
      {({ pressed }) => (
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            borderRadius: 12,
            // @ts-ignore — iOS only, ignored on Android
            borderCurve: 'continuous',
            backgroundColor: disabled
              ? c.surface.disabled
              : pressed
              ? c.brand.pressed
              : c.brand.primary,
          }}
        >
          {loading ? (
            <ActivityIndicator color={disabled ? c.text.secondary : c.text.onPrimary} />
          ) : (
            <>
              {icon}
              <Text
                weight="bold"
                className="text-body-16 tracking-default"
                style={{ color: disabled ? c.text.secondary : c.text.onPrimary }}
              >
                {label}
              </Text>
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}
