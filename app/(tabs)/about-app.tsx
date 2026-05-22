import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import Text from '@/components/Text';
import Lists from '@/components/Lists';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import ArrowBackIcon from '@/assets/icons/arrow_back.svg';

const CARD_SHADOW = {
  shadowColor: '#11182A',
  shadowOffset: { width: 1, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 12,
  elevation: 2,
} as const;

export default function AboutAppScreen() {
  const c = useColors();
  const router = useRouter();
  const { colorScheme } = useSettings();

  const items = [
    { label: 'Политика конфиденциальности', onPress: () => router.push({ pathname: '/(tabs)/legal/[type]', params: { type: 'privacy' } }) },
    { label: 'Пользовательское соглашение', onPress: () => router.push({ pathname: '/(tabs)/legal/[type]', params: { type: 'agreement' } }) },
    { label: 'Согласие на обработку данных', onPress: () => router.push({ pathname: '/(tabs)/legal/[type]', params: { type: 'consent' } }) },
  ];

  const screenBg = colorScheme === 'dark' ? colors.neutral[950] : colors.neutral[50];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['top']}>
      {/* Navigation bar */}
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          {({ pressed }) => (
            <View style={{ padding: 4, opacity: pressed ? 0.6 : 1 }}>
              <ArrowBackIcon width={24} height={24} color={c.text.primary} />
            </View>
          )}
        </Pressable>
        <Text weight="semibold" style={{
          flex: 1, textAlign: 'center',
          fontSize: 16, color: c.text.primary, letterSpacing: 0.2,
        }}>
          О приложении
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
        <Lists
          items={items}
          cardStyle={{
            borderRadius: 32,
            paddingVertical: 16,
            gap: 16,
            ...CARD_SHADOW,
          }}
        />
      </View>
    </SafeAreaView>
  );
}
