import { View, Image, Platform } from 'react-native';
import { useState } from 'react';
import Text from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import YandexIcon from '@/assets/icons/Yandex.svg';
import VKIcon from '@/assets/icons/VK.svg';
import Button from '@/components/Button';
import { useColors, colors } from '@/lib/colors';
import { vkAuth, yandexAuth } from '@/lib/api';
import { saveTokens } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { useContentWidth } from '@/lib/layout';
import { signInWithVK } from '@/modules/vk-id';
import { signInWithYandex } from '@/modules/yandex-id';

export default function WelcomeScreen() {
  const width = useContentWidth();
  const c = useColors();
  const { setAuthed } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleYandexLogin() {
    setError(null);
    setProcessing(true);
    try {
      const token = await signInWithYandex();
      const result = await yandexAuth(token);
      await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      setAuthed(true, result.user);
    } catch (e: any) {
      // Отмену входа пользователем за ошибку не считаем — просто снимаем лоадер.
      if (e?.code === 'YANDEX_AUTH_CANCELLED') return;
      setError(e.message ?? 'Ошибка авторизации через Яндекс');
    } finally {
      setProcessing(false);
    }
  }

  async function handleVkLogin() {
    setError(null);
    setProcessing(true);
    try {
      const vkResult = await signInWithVK();
      const result = await vkAuth({
        accessToken: vkResult.accessToken,
        userId: vkResult.userId,
        firstName: vkResult.firstName,
        lastName: vkResult.lastName,
        photo200: vkResult.photo200,
        email: vkResult.email,
        phone: vkResult.phone,
      });
      await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      setAuthed(true, result.user);
    } catch (e: any) {
      setError(e.message ?? 'Ошибка авторизации через VK');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }}>
      {/* Иллюстрация шире экрана (bleed за края) — как в макете (441 на кадр 393 шириной,
          примерно поровну слева/справа), поэтому alignSelf:'center' без горизонтального
          паддинга родителя. marginTop — в макете иллюстрация начинается не сразу под
          статус-баром, а с отступом (~100px при ширине кадра 393). */}
      <Image
        source={require('@/assets/images/tapa_welcome.png')}
        style={{ width: width * (441 / 393), height: width * (372 / 393), alignSelf: 'center', marginTop: width * (100 / 393) }}
        resizeMode="contain"
      />

      {/* Текст начинается практически вплотную к иллюстрации (в макете зазора нет) —
          без отступа сверху, в отличие от старой векторной иллюстрации. */}
      <View className="px-6">
        <Text weight="bold" className="text-h2 mb-2" style={{ color: c.text.primary }}>
          О, привет!
        </Text>
        <Text className="text-body-16" style={{ color: c.text.secondary }}>
          Меня зовут Тапа, давай вместе начнем лежать в направлении твоих целей.
        </Text>
        {error && (
          <Text className="text-body-14 mt-3" style={{ color: c.semantic.error }}>
            {error}
          </Text>
        )}
      </View>

      <View className="flex-1" />

      <View className="px-6 pb-8 gap-3">
        {/* Только веб: в приложении скачивать APK неоткуда и незачем.
            Ведёт на страницу-заглушку со сборкой (слэш в конце обязателен —
            без него nginx отдаёт SPA, а не страницу). */}
        {Platform.OS === 'web' && (
          <Button
            label="Скачать APK для Android"
            onPress={() => window.location.assign('/download/')}
            variant="secondary"
          />
        )}
        {(Platform.OS === 'android' || Platform.OS === 'web') && (
          <Button
            label="Войти через Яндекс"
            onPress={handleYandexLogin}
            loading={processing}
            icon={<YandexIcon />}
          />
        )}
        {/* VK ID — только в приложении. У приложения VK ID платформа жёстко
            Android, веб-вход потребовал бы отдельного приложения со своими
            ключами; решено не заводить (2026-08-30). */}
        {Platform.OS === 'android' && (
          <Button
            label="Войти через VK ID"
            onPress={handleVkLogin}
            loading={processing}
            variant="secondary"
            icon={<VKIcon />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
