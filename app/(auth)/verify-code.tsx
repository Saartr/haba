import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { verifyCode, sendCode } from '@/lib/api';
import { saveTokens } from '@/lib/auth';

export default function VerifyCodeScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [codeError, setCodeError] = useState(false);

  const handleLogin = async () => {
    if (code.length < 4) return;
    setLoading(true);
    setCodeError(false);
    try {
      const tokens = await verifyCode(username, code);
      await saveTokens(tokens);
      router.replace('/(auth)/success');
    } catch {
      setCodeError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setCodeError(false);
    setCode('');
    try {
      await sendCode(username);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-16">
        <Text className="text-2xl font-bold text-gray-900 mb-2">Авторизация</Text>
        <Text className="text-sm text-gray-400 mb-1">
          Код отправлен в Telegram пользователю{' '}
          <Text className="text-gray-700 font-medium">@{username}</Text>
        </Text>

        <Pressable onPress={() => router.back()} className="mb-8">
          <Text className="text-[#00C9A7] text-sm">Изменить username</Text>
        </Pressable>

        <Text className="text-xs text-gray-400 mb-1 uppercase tracking-wide">
          Код из Telegram
        </Text>
        <TextInput
          className={`w-full border rounded-xl px-4 py-3.5 text-base text-gray-900 bg-gray-50 tracking-widest ${
            codeError ? 'border-red-400 bg-red-50' : 'border-gray-200'
          }`}
          placeholder="······"
          placeholderTextColor="#9CA3AF"
          value={code}
          onChangeText={(t) => { setCode(t); setCodeError(false); }}
          keyboardType="number-pad"
          maxLength={6}
          returnKeyType="done"
          onSubmitEditing={handleLogin}
        />

        {codeError ? (
          <View className="mt-2 flex-row items-center justify-between">
            <Text className="text-red-500 text-sm font-medium">Неверный код</Text>
            <Pressable onPress={handleResend} disabled={resending}>
              {resending ? (
                <ActivityIndicator size="small" color="#00C9A7" />
              ) : (
                <Text className="text-[#00C9A7] text-sm">Отправить повторно</Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <Pressable
          onPress={handleLogin}
          disabled={loading || code.length < 4}
          className="mt-6 w-full bg-[#00C9A7] rounded-2xl py-4 items-center active:opacity-80 disabled:opacity-50"
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-base font-semibold">Войти</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
