import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendCode } from '@/lib/api';

export default function EnterUsernameScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) {
      setError('Введите имя пользователя Telegram');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendCode(clean);
      router.push({ pathname: '/(auth)/verify-code', params: { username: clean } });
    } catch (e: any) {
      setError(e.message ?? 'Не удалось отправить код');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-16">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Авторизация</Text>
        <Text className="text-sm text-gray-400 mb-8">
          Введите ваш Telegram username — мы отправим код в чат
        </Text>

        <Text className="text-xs text-gray-400 mb-1 uppercase tracking-wide">
          Telegram username
        </Text>
        <TextInput
          className="w-full border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 bg-gray-50"
          placeholder="@username"
          placeholderTextColor="#9CA3AF"
          value={username}
          onChangeText={(t) => { setUsername(t); setError(''); }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="default"
          returnKeyType="done"
          onSubmitEditing={handleSend}
        />

        {error ? (
          <Text className="text-red-500 text-sm mt-2">{error}</Text>
        ) : null}

        <Pressable
          onPress={handleSend}
          disabled={loading}
          className="mt-6 w-full bg-[#00C9A7] rounded-2xl py-4 items-center active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">Отправить код</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
