import { View, Image, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import Text from '@/components/Text';
import Lists from '@/components/Lists';
import BottomSheet from '@/components/BottomSheet';
import Button from '@/components/Button';
import { useColors, colors } from '@/lib/colors';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { clearTokens } from '@/lib/auth';
import { deleteAccount } from '@/lib/api';
import { cancelSync } from '@/modules/health-sync';
import { Platform } from 'react-native';

import NavigationBar from '@/components/NavigationBar';
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
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const confirmLogout = async () => {
    setLogoutVisible(false);
    await clearTokens();
    setAuthed(false);
  };

  const confirmDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteAccount();
      if (Platform.OS === 'android') cancelSync();
      await clearTokens();
      setAuthed(false);
    } catch (e: any) {
      setDeleteVisible(false);
      Alert.alert('Ошибка', e.message ?? 'Не удалось удалить аккаунт');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['top']}>
      <NavigationBar title="Профиль" onBack={() => router.back()} />

      <View style={{ flex: 1, paddingBottom: insets.bottom + 24 }}>
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
              icon: () => <UserIcon width={24} height={24} color={c.text.secondary} />,
              onPress: () => router.push('/(tabs)/profile-settings'),
            },
            {
              label: 'Настройки приложения',
              icon: () => <SettingsIcon width={24} height={24} color={c.text.secondary} />,
              onPress: () => router.push('/(tabs)/app-settings'),
            },
            {
              label: 'О приложении',
              icon: () => <InfoCircleIcon width={24} height={24} color={c.text.secondary} />,
              onPress: () => router.push('/(tabs)/about-app'),
            },
            ...(__DEV__ ? [{
              label: 'Компоненты',
              icon: () => <MoreVerticalIcon width={24} height={24} color={c.text.secondary} />,
              onPress: () => router.push('/dev'),
            }] : []),
          ]}
        />

        {/* Push buttons to bottom */}
        <View style={{ flex: 1 }} />

        {/* Action buttons */}
        <View style={{ marginHorizontal: 24, gap: 16 }}>
          <Button
            label="Выйти из аккаунта"
            icon={<LogoutIcon />}
            onPress={() => setLogoutVisible(true)}
          />
          <Button
            label="Удалить аккаунт"
            icon={<DeleteForeverIcon />}
            variant="secondary"
            onPress={() => setDeleteVisible(true)}
          />
        </View>
      </View>
      <BottomSheet
        visible={logoutVisible}
        title="Выйти из аккаунта?"
        onClose={() => setLogoutVisible(false)}
      >
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Button label="Отмена" onPress={() => setLogoutVisible(false)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Выйти" onPress={confirmLogout} />
          </View>
        </View>
      </BottomSheet>

      <BottomSheet
        visible={deleteVisible}
        title="Удалить аккаунт?"
        onClose={() => !deleteLoading && setDeleteVisible(false)}
      >
        <Text weight="semibold" style={{ fontSize: 16, lineHeight: 16 * 1.6, color: c.text.secondary, letterSpacing: 0.2, marginBottom: 16 }}>
          Все данные будут удалены безвозвратно: привычки, прогресс, история. Это действие нельзя отменить.
        </Text>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <View style={{ flex: 1 }}>
            <Button label="Отмена" onPress={() => setDeleteVisible(false)} disabled={deleteLoading} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Удалить"
              color={colors.red[500]}
              onPress={confirmDelete}
              loading={deleteLoading}
            />
          </View>
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
