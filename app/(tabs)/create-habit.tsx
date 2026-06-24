import { View, Pressable, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Text from '@/components/Text';
import NavigationBar from '@/components/NavigationBar';
import ChevronRightIcon from '@/assets/icons/ChevronRight.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { useCardShadow } from '@/components/Card';

type ChoiceCardProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
};

function ChoiceCard({ title, subtitle, onPress }: ChoiceCardProps) {
  const c = useColors();
  const shadow = useCardShadow();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
    >
      {({ pressed }) => (
        <View style={{
          backgroundColor: c.surface.input,
          borderRadius: 20,
          padding: 24,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          opacity: pressed ? 0.7 : 1,
          ...shadow,
        }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text weight="bold" style={{ fontSize: 18, color: c.text.primary, letterSpacing: 0.2 }}>
              {title}
            </Text>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, lineHeight: 20, letterSpacing: 0.1 }}>
              {subtitle}
            </Text>
          </View>
          <ChevronRightIcon width={24} height={24} color={c.text.secondary} />
        </View>
      )}
    </Pressable>
  );
}

export default function CreateHabitScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useSettings();

  const panelColor = colorScheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = colorScheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar title="Создание цели" onBack={() => router.back()} />
      </View>

      <View style={{ flex: 1, padding: 24, gap: 16 }}>
        <ChoiceCard
          title="Готовая цель"
          subtitle="Выбор из списка доступных целей. Быстрая настройка, подсказки и интеграции с сервисами."
          onPress={() => router.push('/(tabs)/preset-habits' as any)}
        />
        <ChoiceCard
          title="Своя цель"
          subtitle="Создание своей цели с нуля. Расширенная настройка, полная кастомизация."
          onPress={() => router.push('/(tabs)/custom-habit/step1' as any)}
        />
      </View>
    </SafeAreaView>
  );
}
