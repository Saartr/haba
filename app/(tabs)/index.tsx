import { View, Pressable, Image, useColorScheme, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Text from '@/components/Text';
import Button from '@/components/Button';
import MascotSvg from '@/assets/images/tapa_quest.png';
import PlusIcon from '@/assets/icons/Plus.svg';
import { useColors, colors } from '@/lib/colors';
import { useAuth } from '@/lib/auth-context';

function Avatar({ firstName, avatarUrl }: { firstName: string | null; avatarUrl: string | null }) {
  const initial = firstName ? firstName[0].toUpperCase() : '?';

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 2,
          borderColor: colors.neutral[500],
        }}
      />
    );
  }

  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: colors.neutral[500],
        backgroundColor: colors.neutral[200],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text weight="bold" style={{ fontSize: 20, color: colors.neutral[500], lineHeight: 24 }}>
        {initial}
      </Text>
    </View>
  );
}

export default function HabitsScreen() {
  const c = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const scheme = useColorScheme();
  const insets = useSafeAreaInsets();

  const rawName = user?.first_name ?? user?.username ?? null;
  const displayName = rawName && rawName.length > 12 ? rawName.slice(0, 12) + '…' : rawName;
  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' : 'dark-content';

  const panelShadow = scheme === 'dark'
    ? {}
    : {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 4,
      };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      {/* Top panel — растягивается под статусбар */}
      <View
        style={{
          backgroundColor: panelColor,
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
          paddingTop: insets.top + 16,
          paddingBottom: 24,
          paddingHorizontal: 24,
          ...panelShadow,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 4, flex: 1, marginRight: 12 }}>
            <Text weight="bold" style={{ fontSize: 20, color: c.text.secondary, lineHeight: 20 * 1.5, letterSpacing: 0.2 }}>
              Привет,
            </Text>
            {displayName && (
              <Text weight="bold" style={{ fontSize: 20, color: c.text.primary, lineHeight: 20 * 1.5, letterSpacing: 0.2 }}>
                {displayName}
              </Text>
            )}
          </View>

          <Pressable
            onPress={() => router.push('/(tabs)/two')}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            hitSlop={8}
          >
            <Avatar firstName={user?.first_name ?? null} avatarUrl={user?.avatar_url ?? null} />
          </Pressable>
        </View>
      </View>

      {/* Empty state */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32, paddingHorizontal: 24 }}>
        <Image source={MascotSvg} style={{ width: 171, height: 224 }} resizeMode="contain" />

        <Text weight="semibold" style={{ fontSize: 16, color: c.text.secondary, textAlign: 'center' }}>
          Нет активных привычек
        </Text>

        <View style={{ width: '100%' }}>
          <Button
            label="Добавить"
            onPress={() => {}}
            icon={<PlusIcon width={20} height={20} color={c.icon.onPrimary} />}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
