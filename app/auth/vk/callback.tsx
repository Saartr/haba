import { useEffect, useState } from 'react';
import { View, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Text from '@/components/Text';
import Button from '@/components/Button';
import { useColors } from '@/lib/colors';
import { NATIVE_STATE_PREFIX } from '@/modules/vk-id';

// Страница возврата из VK OAuth. В отличие от яндексовской, здесь НЕТ входа для
// браузера: в веб-версии VK намеренно не предлагается (у приложения VK ID платформа
// зафиксирована как Android). Единственная задача страницы — перебросить код обратно
// в мобильное приложение, потому что redirect_uri в консоли VK может быть только
// обычным адресом, а не схемой haba:// или exp://.

/** Обратное преобразование к encodeReturnUrl из modules/vk-id/index.ios.ts.
 *  atob здесь допустим — код выполняется только в браузере. */
function decodeReturnUrl(encoded: string): string | null {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    return atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  } catch {
    return null;
  }
}

export default function VkCallbackScreen() {
  const c = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    device_id?: string;
    error?: string;
  }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/');
      return;
    }
    if (typeof params.state !== 'string' || !params.state.startsWith(NATIVE_STATE_PREFIX)) {
      setError('Вход через VK доступен только в приложении');
      return;
    }
    const target = decodeReturnUrl(params.state.slice(NATIVE_STATE_PREFIX.length).split('.')[0]);
    // Открытый редирект недопустим: уходим только в приложение, больше никуда.
    if (!target || !/^(haba|exp):\/\//.test(target)) {
      setError('Не удалось вернуться в приложение');
      return;
    }
    const query = new URLSearchParams();
    // device_id VK возвращает вместе с кодом, и без него код не обменять
    for (const key of ['code', 'state', 'device_id', 'error'] as const) {
      const value = params[key];
      if (typeof value === 'string') query.set(key, value);
    }
    window.location.replace(`${target}?${query}`);
    // Намеренно один прогон: код одноразовый.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: c.surface.default }}>
      <Text style={{ color: c.text.primary, textAlign: 'center' }}>
        {error ?? 'Возвращаемся в приложение…'}
      </Text>
      {error ? <Button label="На главную" onPress={() => router.replace('/')} /> : null}
    </View>
  );
}
