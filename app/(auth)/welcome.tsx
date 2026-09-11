import { View, Image, Pressable, useWindowDimensions, Platform } from 'react-native';
import { useState } from 'react';
import Text from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import YandexIcon from '@/assets/icons/Yandex.svg';
import VKIcon from '@/assets/icons/VK.svg';
import Button from '@/components/Button';
import BottomSheet from '@/components/BottomSheet';
import Input from '@/components/Input';
import { useColors, colors } from '@/lib/colors';
import { vkAuth, vkWebAuth, yandexAuth, yandexWebAuth, reviewAuth } from '@/lib/api';
import { saveTokens } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { signInWithVK, signInWithVKCode } from '@/modules/vk-id';
import { signInWithYandex, signInWithYandexCode } from '@/modules/yandex-id';

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const c = useColors();
  const { setAuthed } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Служебный вход для модераторов магазинов приложений (POST /auth/review): им нужен вход
  // без SMS-кодов, а VK и Яндекс с чужого устройства из-за рубежа их спрашивают. Шторка
  // открывается долгим нажатием на иллюстрацию — обычному пользователю она ни к чему.
  const [reviewVisible, setReviewVisible] = useState(false);
  const [reviewLogin, setReviewLogin] = useState('');
  const [reviewPassword, setReviewPassword] = useState('');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  async function handleYandexLogin() {
    setError(null);
    setProcessing(true);
    try {
      // На Android нативный SDK сразу отдаёт токен. На iOS его нет: там системная
      // веб-сессия возвращает код, а на токен его меняет сервер — как на вебе.
      let result;
      if (Platform.OS === 'ios') {
        const { code, codeVerifier } = await signInWithYandexCode();
        result = await yandexWebAuth(code, codeVerifier);
      } else {
        result = await yandexAuth(await signInWithYandex());
      }
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
      // На Android нативный SDK сразу отдаёт токен и профиль. На iOS его нет:
      // системная веб-сессия возвращает код, а на токен его меняет сервер.
      let result;
      if (Platform.OS === 'ios') {
        const { code, codeVerifier, deviceId } = await signInWithVKCode();
        result = await vkWebAuth(code, codeVerifier, deviceId);
      } else {
        const vkResult = await signInWithVK();
        result = await vkAuth({
          accessToken: vkResult.accessToken,
          userId: vkResult.userId,
          firstName: vkResult.firstName,
          lastName: vkResult.lastName,
          photo200: vkResult.photo200,
          email: vkResult.email,
          phone: vkResult.phone,
        });
      }
      await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      setAuthed(true, result.user);
    } catch (e: any) {
      // Отмену входа за ошибку не считаем — как в ветке Яндекса.
      if (e?.code === 'VK_AUTH_CANCELLED') return;
      setError(e.message ?? 'Ошибка авторизации через VK');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReviewLogin() {
    setReviewError(null);
    setReviewLoading(true);
    try {
      const result = await reviewAuth(reviewLogin.trim(), reviewPassword);
      await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      setReviewVisible(false);
      setAuthed(true, result.user);
    } catch (e: any) {
      setReviewError(e.message ?? 'Не удалось войти');
    } finally {
      setReviewLoading(false);
    }
  }

  function closeReview() {
    if (reviewLoading) return;
    setReviewVisible(false);
    setReviewPassword('');
    setReviewError(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }}>
      {/* Иллюстрация шире экрана (bleed за края) — как в макете (441 на кадр 393 шириной,
          примерно поровну слева/справа), поэтому alignSelf:'center' без горизонтального
          паддинга родителя. marginTop — в макете иллюстрация начинается не сразу под
          статус-баром, а с отступом (~100px при ширине кадра 393).
          Долгое нажатие открывает служебный вход; accessible={false} — чтобы экранный
          диктор не объявлял иллюстрацию кнопкой. */}
      <Pressable onLongPress={() => setReviewVisible(true)} delayLongPress={1000} accessible={false}>
        <Image
          source={require('@/assets/images/tapa_welcome.png')}
          style={{ width: width * (441 / 393), height: width * (372 / 393), alignSelf: 'center', marginTop: width * (100 / 393) }}
          resizeMode="contain"
        />
      </Pressable>

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
        <Button
          label="Войти через Яндекс"
          onPress={handleYandexLogin}
          loading={processing}
          icon={<YandexIcon />}
        />
        {/* На Android вход идёт через нативный SDK, на iOS — через системную
            веб-сессию: нативного SDK под iOS у нас нет. */}
        <Button
          label="Войти через VK ID"
          onPress={handleVkLogin}
          loading={processing}
          variant="secondary"
          icon={<VKIcon />}
        />
      </View>

      <BottomSheet visible={reviewVisible} title="Вход для проверки" onClose={closeReview}>
        <View style={{ gap: 16 }}>
          <Input
            label="Логин"
            value={reviewLogin}
            onChangeText={(t) => { setReviewLogin(t); if (reviewError) setReviewError(null); }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            label="Пароль"
            value={reviewPassword}
            onChangeText={(t) => { setReviewPassword(t); if (reviewError) setReviewError(null); }}
            error={reviewError ?? undefined}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            label="Войти"
            onPress={handleReviewLogin}
            loading={reviewLoading}
            disabled={!reviewLogin.trim() || !reviewPassword}
          />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
