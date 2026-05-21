import { View, Pressable } from 'react-native';
import Text from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { clearTokens } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';

export default function ProfileScreen() {
  const router = useRouter();
  const { setAuthed } = useAuth();

  const handleLogout = async () => {
    await clearTokens();
    setAuthed(false);
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-0">
      <View className="flex-1 items-center justify-center gap-4">
        <Text className="text-body-16 text-neutral-500">
          Профиль — в разработке
        </Text>

        <Pressable
          onPress={handleLogout}
          className="bg-red-500 rounded-xl px-8 py-3 active:opacity-70"
        >
          <Text weight="bold" className="text-body-16 text-neutral-0">Выйти</Text>
        </Pressable>

        {__DEV__ && (
          <Pressable
            onPress={() => router.push('/dev')}
            className="mt-4 border border-neutral-300 rounded-xl px-8 py-3 active:opacity-70"
          >
            <Text weight="bold" className="text-body-16 text-neutral-600">
              🧩 Component Gallery
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
