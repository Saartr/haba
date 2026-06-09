import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Lists from '@/components/Lists';
import { colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import NavigationBar from '@/components/NavigationBar';

export default function AboutAppScreen() {

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
      <NavigationBar title="О приложении" onBack={() => router.back()} />

      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
        <Lists
          items={items}
          cardStyle={{
            paddingVertical: 16,
            gap: 16,
          }}
        />
      </View>
    </SafeAreaView>
  );
}
