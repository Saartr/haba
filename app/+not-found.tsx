import { useRouter } from 'expo-router';
import ErrorScreen from '@/components/ErrorScreen';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <ErrorScreen
      message="Группа не найдена"
      actions={[
        {
          label: 'Ввести другой код',
          onPress: () => router.back(),
        },
        {
          label: 'На главную',
          onPress: () => router.replace('/(tabs)'),
          variant: 'text',
        },
      ]}
    />
  );
}
