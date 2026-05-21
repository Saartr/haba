import { View, Pressable } from 'react-native';
import Text from '@/components/Text';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { verifyCode } from '@/lib/api';
import { saveTokens } from '@/lib/auth';
import { useColors } from '@/lib/colors';
import { useAuth } from '@/lib/auth-context';
import Button from '@/components/Button';
import Input from '@/components/Input';
import ArrowBackIcon from '@/assets/icons/arrow_back.svg';
import MailIcon from '@/assets/icons/Mail.svg';
import PinIcon from '@/assets/icons/Pin.svg';

export default function VerifyCodeScreen() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const { setAuthed } = useAuth();
  const c = useColors();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeError, setCodeError] = useState('');

  const handleLogin = async () => {
    if (code.length < 6) return;
    setLoading(true);
    setCodeError('');
    try {
      const tokens = await verifyCode(username, code);
      await saveTokens(tokens);
      setAuthed(true);
    } catch (e: any) {
      setCodeError(e.message ?? 'Код не совпадает');
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

      <View className="px-6 pt-8" style={{ gap: 34 }}>
        <View className="gap-2">
          <Text weight="bold" className="text-h2" style={{ color: c.text.primary }}>
            Авторизация
          </Text>
          <Text className="text-body-16" style={{ color: c.text.secondary }}>
            {'Вставьте код, полученный от бота, \nв поле ниже и нажмите «Войти».'}
          </Text>
        </View>

        <View className="gap-6">
          <Input
            label="Логин Telegram"
            value={username}
            onChangeText={() => {}}
            icon={<MailIcon width={24} height={24} color={c.icon.placeholder} />}
            disabled
          />

          <Input
            label="Код"
            value={code}
            onChangeText={(t) => { setCode(t); setCodeError(''); }}
            icon={<PinIcon width={24} height={24} color={codeError ? c.icon.error : c.icon.placeholder} />}
            error={codeError}
            keyboardType="number-pad"
            maxLength={6}
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            autoFocus
          />

          <Button
            label="Войти"
            onPress={handleLogin}
            loading={loading}
            disabled={code.length < 6}
          />

          <Button
            variant="text"
            label="Изменить данные для входа"
            onPress={() => router.back()}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
