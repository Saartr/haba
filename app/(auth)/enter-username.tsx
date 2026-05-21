import { View, Pressable } from 'react-native';
import Text from '@/components/Text';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendCode } from '@/lib/api';
import { useColors } from '@/lib/colors';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ArrowBackIcon from '@/assets/icons/arrow_back.svg';
import MailIcon from '@/assets/icons/Mail.svg';

export default function EnterUsernameScreen() {
  const router = useRouter();
  const c = useColors();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    const clean = username.trim().replace(/^@/, '');
    if (!clean) {
      setError('Введите имя пользователя');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendCode(clean);
      router.push({ pathname: '/(auth)/verify-code', params: { username: clean } });
    } catch (e: any) {
      setError(e.message ?? 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }}>
      <View className="h-[52px] flex-row items-center px-6">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <ArrowBackIcon width={24} height={24} color={c.text.primary} />
        </Pressable>
      </View>

      <View className="px-6 pt-8">
        <Text weight="bold" className="text-h2 mb-2" style={{ color: c.text.primary }}>
          Авторизация
        </Text>
        <Text className="text-body-16 mb-10" style={{ color: c.text.secondary }}>
          {'Введите свой логин Telegram \nи нажмите «Отправить код».'}
        </Text>

        <View className="mb-6">
          <Input
            label="Логин Telegram"
            value={username}
            onChangeText={(t) => { setUsername(t); setError(''); }}
            placeholder="username"
            icon={<MailIcon width={24} height={24} color={error ? c.icon.error : c.icon.placeholder} />}
            error={error}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSend}
          />
        </View>

        <Button label="Отправить код" onPress={handleSend} loading={loading} />
      </View>
    </SafeAreaView>
  );
}
