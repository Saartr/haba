import { View, Pressable, Image, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Text from '@/components/Text';
import Lists from '@/components/Lists';
import { useColors, colors } from '@/lib/colors';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { clearTokens } from '@/lib/auth';

import ArrowBackIcon from '@/assets/icons/arrow_back.svg';
import UserIcon from '@/assets/icons/User.svg';
import SettingsIcon from '@/assets/icons/Settings.svg';
import InfoCircleIcon from '@/assets/icons/InfoCircle.svg';
import MoreVerticalIcon from '@/assets/icons/MoreVertical.svg';
import LogoutIcon from '@/assets/icons/Logout.svg';
import DeleteForeverIcon from '@/assets/icons/DeleteForever.svg';

function ProfileAvatar({ firstName, avatarUrl }: { firstName: string | null; avatarUrl: string | null }) {
  const initial = firstName ? firstName[0].toUpperCase() : '?';
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={{ width: 60, height: 60, borderRadius: 30 }} />;
  }
  return (
    <View style={{
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: colors.neutral[100],
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text weight="bold" style={{ fontSize: 28, color: colors.neutral[500] }}>
        {initial}
      </Text>
    </View>
  );
}


export default function ProfileScreen() {
  const c = useColors();
  const router = useRouter();
  const { setAuthed, user } = useAuth();
  const { colorScheme } = useSettings();
  const insets = useSafeAreaInsets();

  const screenBg = colorScheme === 'dark' ? colors.neutral[950] : colors.neutral[50];
  const cardBg = colorScheme === 'dark' ? colors.neutral[900] : colors.neutral[0];

  const displayName = user?.first_name ?? user?.username ?? null;

  const handleLogout = () => {
    Alert.alert('Выйти из аккаунта?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => {
        await clearTokens();
        setAuthed(false);
      }},
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['top']}>
      {/* Navigation bar */}
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          {({ pressed }) => (
            <View style={{ padding: 4, opacity: pressed ? 0.6 : 1 }}>
              <ArrowBackIcon width={24} height={24} color={c.text.primary} />
            </View>
          )}
        </Pressable>
        <Text weight="bold" style={{
          flex: 1, textAlign: 'center',
          fontSize: 18, color: c.text.primary, letterSpacing: 0.2,
        }}>
          Профиль
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={{ flex: 1, paddingBottom: insets.bottom + 16 }}>
        {/* Avatar + name */}
        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 24 }}>
          <ProfileAvatar firstName={user?.first_name ?? null} avatarUrl={user?.avatar_url ?? null} />
          {displayName && (
            <Text weight="semibold" style={{
              marginTop: 8, fontSize: 16,
              color: c.text.primary, letterSpacing: 0.2,
            }}>
              {displayName}
            </Text>
          )}
        </View>

        {/* Menu list */}
        <Lists
          cardStyle={{ marginHorizontal: 24, backgroundColor: cardBg }}
          items={[
            {
              label: 'Настройки профиля',
              icon: <UserIcon width={24} height={24} color={c.text.secondary} />,
              onPress: () => router.push('/(tabs)/profile-settings'),
            },
            {
              label: 'Настройки приложения',
              icon: <SettingsIcon width={24} height={24} color={c.text.secondary} />,
              onPress: () => router.push('/(tabs)/app-settings'),
            },
            {
              label: 'О приложении',
              icon: <InfoCircleIcon width={24} height={24} color={c.text.secondary} />,
              onPress: () => router.push('/(tabs)/about-app'),
            },
            ...(__DEV__ ? [{
              label: 'Компоненты',
              icon: <MoreVerticalIcon width={24} height={24} color={c.text.secondary} />,
              onPress: () => router.push('/dev'),
            }] : []),
          ]}
        />

        {/* Push buttons to bottom */}
        <View style={{ flex: 1 }} />

        {/* Action buttons */}
        <View style={{ marginHorizontal: 24, gap: 16 }}>
          <Pressable onPress={handleLogout} style={{ height: 56 }}>
            {({ pressed }) => (
              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                borderRadius: 12,
                backgroundColor: pressed ? c.brand.pressed : c.brand.primary,
              }}>
                <LogoutIcon width={24} height={24} color={colors.neutral[0]} />
                <Text weight="bold" style={{ fontSize: 16, color: colors.neutral[0], letterSpacing: 0.2 }}>
                  Выйти из аккаунта
                </Text>
              </View>
            )}
          </Pressable>

          <Pressable onPress={() => {}} style={{ height: 56 }}>
            {({ pressed }) => (
              <View style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                opacity: pressed ? 0.7 : 1,
              }}>
                <DeleteForeverIcon width={24} height={24} color={colors.red[500]} />
                <Text weight="bold" style={{ fontSize: 16, color: colors.red[500], letterSpacing: 0.2 }}>
                  Удалить аккаунт
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
