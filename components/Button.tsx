import { cloneElement, isValidElement, ReactElement } from 'react';
import { Pressable, ActivityIndicator, View } from 'react-native';
import Text from '@/components/Text';
import { useColors, colors } from '@/lib/colors';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'main' | 'text' | 'secondary';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Переопределяет цвет фона main-кнопки (например, красный для деструктивных действий). */
  color?: string;
};

export default function Button({
  label,
  onPress,
  variant = 'main',
  icon,
  loading = false,
  disabled = false,
  color,
}: Props) {
  const c = useColors();
  const isDisabled = disabled || loading;

  if (variant === 'secondary') {
    // TapaDS Secondary: фон surface.bg, обводка 2px, текст/иконка brand-цветом
    return (
      <Pressable onPress={onPress} disabled={isDisabled} style={{ height: 56 }}>
        {({ pressed }) => {
          const accent = disabled
            ? c.text.secondary
            : pressed
            ? c.brand.pressed
            : c.brand.primary;
          return (
            <View
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: disabled ? colors.neutral[300] : accent,
                backgroundColor: c.surface.bg,
                // @ts-ignore — iOS only, ignored on Android
                borderCurve: 'continuous',
              }}
            >
              {loading ? (
                <ActivityIndicator color={c.brand.primary} />
              ) : (
                <>
                  {isValidElement(icon)
                    ? cloneElement(icon as ReactElement<{ color?: string }>, { color: accent })
                    : icon}
                  <Text weight="bold" className="text-body-16 tracking-default" style={{ color: accent }}>
                    {label}
                  </Text>
                </>
              )}
            </View>
          );
        }}
      </Pressable>
    );
  }

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
              : color
              ? color
              : pressed
              ? c.brand.pressed
              : c.brand.primary,
            opacity: color && pressed ? 0.85 : 1,
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
