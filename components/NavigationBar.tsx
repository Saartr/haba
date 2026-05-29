import { View, Pressable } from 'react-native';
import Text from '@/components/Text';
import ArrowBackIcon from '@/assets/icons/arrow_back.svg';
import { useColors } from '@/lib/colors';

type Props = {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export default function NavigationBar({ title, onBack, right }: Props) {
  const c = useColors();

  return (
    <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
      {/* Заголовок всегда по центру */}
      <Text
        weight="semibold"
        style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}
        numberOfLines={1}
      >
        {title}
      </Text>

      {/* Левая иконка — x=24 по Figma, контейнер 24×24 */}
      {onBack && (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={{ position: 'absolute', left: 24 }}
        >
          {({ pressed }) => (
            <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }}>
              <ArrowBackIcon width={24} height={24} color={c.text.primary} />
            </View>
          )}
        </Pressable>
      )}

      {/* Правая иконка — right=24 по Figma, контейнер 24×24 */}
      {right && (
        <View style={{ position: 'absolute', right: 24, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
          {right}
        </View>
      )}
    </View>
  );
}
