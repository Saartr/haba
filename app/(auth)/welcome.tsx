import { View, Text, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <Image
          source={require('../../assets/images/splash-icon.png')}
          className="w-40 h-40 mb-8"
          resizeMode="contain"
        />
        <Text className="text-3xl font-bold text-gray-900 mb-3 text-center">
          Хаба
        </Text>
        <Text className="text-base text-gray-500 text-center mb-16 leading-6">
          Социальный трекер привычек.{'\n'}Достигай целей вместе с друзьями.
        </Text>

        <Pressable
          onPress={() => router.push('/(auth)/enter-username')}
          className="w-full bg-[#00C9A7] rounded-2xl py-4 items-center active:opacity-80"
        >
          <Text className="text-white text-base font-semibold">
            Войти через Telegram
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
