import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SuccessScreen() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-5xl mb-6">✅</Text>
        <Text className="text-2xl font-bold text-gray-900 mb-3">Вы вошли!</Text>
        <Text className="text-base text-gray-500 text-center">
          Авторизация прошла успешно
        </Text>
      </View>
    </SafeAreaView>
  );
}
