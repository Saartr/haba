import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Text from '@/components/Text';
import Button from '@/components/Button';
import { useColors } from '@/lib/colors';
import { yandexWebAuth } from '@/lib/api';
import { saveTokens } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { takeStoredAuthRequest } from '@/modules/yandex-id';

// Страница возврата из Яндекс OAuth (только веб — в приложении вход идёт через
// нативный SDK и сюда никто не попадает). Забирает код из query, меняет его на
// наши токены через сервер и уводит в приложение.
export default function YandexCallbackScreen() {
  const c = useColors();
  const router = useRouter();
  const { setAuthed } = useAuth();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/');
      return;
    }
    let cancelled = false;

    (async () => {
      const stored = takeStoredAuthRequest();
      if (params.error) {
        setError('Вход через Яндекс отменён');
        return;
      }
      if (!params.code || !stored.codeVerifier) {
        setError('Не хватает данных для входа — попробуйте ещё раз');
        return;
      }
      // state защищает от подмены ответа: он сгенерирован этой же вкладкой
      // перед редиректом и Яндекс возвращает его без изменений.
      if (stored.state && params.state !== stored.state) {
        setError('Ответ Яндекса не совпал с запросом — попробуйте ещё раз');
        return;
      }
      try {
        const result = await yandexWebAuth(params.code, stored.codeVerifier);
        if (cancelled) return;
        await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
        setAuthed(true, result.user);
        router.replace('/');
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Не удалось войти через Яндекс');
      }
    })();

    return () => { cancelled = true; };
    // Намеренно один прогон: код одноразовый, повтор обмена вернёт ошибку.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: c.surface.default }}>
      {error ? (
        <>
          <Text style={{ color: c.text.primary, textAlign: 'center' }}>{error}</Text>
          <Button label="Вернуться ко входу" onPress={() => router.replace("/")} />
        </>
      ) : (
        <>
          <ActivityIndicator color={c.brand.primary} />
          <Text style={{ color: c.text.secondary }}>Входим…</Text>
        </>
      )}
    </View>
  );
}
