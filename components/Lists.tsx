import { View, Pressable, ViewStyle } from 'react-native';
import Text from '@/components/Text';
import { useColors, colors } from '@/lib/colors';
import ChevronRightIcon from '@/assets/icons/ChevronRight.svg';

const SHADOW = {
  shadowColor: colors.neutral[950],
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 6,
  elevation: 3,
} as const;

export type ListItemData = {
  label: string;
  icon?: React.ReactNode;
  onPress?: () => void;
};

function Item({ label, icon, onPress }: ListItemData) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}>
      {({ pressed }) => (
        <View style={{
          height: 58,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: pressed ? 0.6 : 1,
        }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            {icon ? (
              <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                {icon}
              </View>
            ) : null}
            <Text weight="semibold" style={{ fontSize: 16, letterSpacing: 0.2, color: c.text.secondary }}>
              {label}
            </Text>
          </View>
          <ChevronRightIcon width={24} height={24} color={c.text.secondary} />
        </View>
      )}
    </Pressable>
  );
}

type Props = {
  items: ListItemData[];
  cardStyle?: ViewStyle;
};

export default function Lists({ items, cardStyle }: Props) {
  const c = useColors();
  return (
    <View style={[{
      backgroundColor: c.surface.input,
      borderRadius: 16,
      paddingHorizontal: 24,
      paddingVertical: 16,
      overflow: 'hidden',
      ...SHADOW,
    }, cardStyle]}>
      {items.map((item) => (
        <Item key={item.label} {...item} />
      ))}
    </View>
  );
}
