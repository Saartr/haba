import { View, useWindowDimensions } from 'react-native';
import Text from '@/components/Text';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import TelegramIcon from '@/assets/icons/Telegram.svg';
import TapaWelcome from '@/assets/images/tapa_welcome.svg';
import Button from '@/components/Button';
import { useColors } from '@/lib/colors';

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const c = useColors();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }}>
      <TapaWelcome width={width} height={width} />

      <View className="px-6 mt-4">
        <Text weight="bold" className="text-h2 mb-2" style={{ color: c.text.primary }}>
          О, привет!
        </Text>
        <Text className="text-body-16" style={{ color: c.text.secondary }}>
          Меня зовут Тапа, давай вместе начнем лежать в направлении твоих целей.
        </Text>
      </View>

      <View className="flex-1" />

      <View className="px-6 pb-8">
        <Button
          label="Войти через Telegram"
          onPress={() => router.push('/(auth)/enter-username')}
          icon={<TelegramIcon width={20} height={20} color={c.text.onPrimary} />}
        />
      </View>
    </SafeAreaView>
  );
}
