import { View, Pressable, Image, FlatList, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import Text from '@/components/Text';
import Card, { useCardShadow } from '@/components/Card';
import HabitTag from '@/components/HabitTag';
import Fab from '@/components/Fab';
import BottomSheet from '@/components/BottomSheet';
import Input from '@/components/Input';
import Button from '@/components/Button';
import MascotSvg from '@/assets/images/chill.svg';
import CelebAvatar from '@/assets/images/celeb_avatar.svg';
import AngryAvatar from '@/assets/images/angry_avatar.svg';
import UserIcon from '@/assets/icons/User.svg';
import GroupPlusIcon from '@/assets/icons/GroupPlus.svg';
import PlusIcon from '@/assets/icons/Plus.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import TelegramIcon from '@/assets/icons/Telegram.svg';
import VKIcon from '@/assets/icons/VK.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { useSnackbar } from '@/lib/snackbar-context';
import { getHabits, getHabit, joinHabit, Habit } from '@/lib/api';

function Avatar({ firstName, avatarUrl }: { firstName: string | null; avatarUrl: string | null }) {
  const initial = firstName ? firstName[0].toUpperCase() : '?';
  if (avatarUrl) {
    return (
      <Image source={{ uri: avatarUrl }}
        style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.neutral[500] }} />
    );
  }
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2,
      borderColor: colors.neutral[500], backgroundColor: colors.neutral[50],
      alignItems: 'center', justifyContent: 'center' }}>
      <Text weight="bold" style={{ fontSize: 20, color: colors.neutral[500], lineHeight: 30 }}>
        {initial}
      </Text>
    </View>
  );
}

type HabitExtra = { streak: number; today_value: number };

// Пользователь может вставить полную ссылку (https://.../join/<code>, haba://join/<code>)
// или просто код — берём последний сегмент пути без query/hash.
function extractInviteCode(input: string): string {
  const noQuery = input.trim().split(/[?#]/)[0].replace(/\/+$/, '');
  return noQuery.split('/').pop() ?? '';
}

function pluralDays(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return `${n} дней`;
  if (last === 1) return `${n} день`;
  if (last >= 2 && last <= 4) return `${n} дня`;
  return `${n} дней`;
}

function HabitCard({ habit, extra, onPress }: { habit: Habit; extra: HabitExtra | null; onPress: () => void }) {
  const c = useColors();

  const subtitle = habit.category === 'smoking' ? 'Без сигарет' : 'Шагов за сегодня';
  const value = habit.category === 'smoking'
    ? pluralDays(extra?.streak ?? 0)
    : `${extra?.today_value ?? 0}/${habit.goal_value ?? 0}`;

  // Цель за сегодня выполнена → радостный аватар, иначе — недовольный.
  const done = habit.category === 'smoking'
    ? (extra?.streak ?? 0) > 0
    : (extra?.today_value ?? 0) >= (habit.goal_value ?? 0) && (habit.goal_value ?? 0) > 0;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
          <View style={{
            width: 64, height: 64, borderRadius: 32, overflow: 'hidden',
            backgroundColor: done ? colors.purple[100] : colors.red[200],
          }}>
            {done
              ? <CelebAvatar width={133} height={100} style={{ position: 'absolute', left: -35, top: -6 }} />
              : <AngryAvatar width={131} height={97} style={{ position: 'absolute', left: -33, top: 0 }} />
            }
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 }}>
            <View style={{ gap: 4, flex: 1 }}>
              <Text weight="bold" numberOfLines={1} style={{ fontSize: 16, lineHeight: 16 * 1.6, color: c.text.primary, letterSpacing: 0.2 }}>
                {habit.name}
              </Text>
              <View>
                <Text weight="medium" style={{ fontSize: 12, lineHeight: 12 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
                  {subtitle}
                </Text>
                <Text weight="bold" style={{ fontSize: 20, lineHeight: 20 * 1.5, color: c.text.primary, letterSpacing: 0.2 }}>
                  {value}
                </Text>
              </View>
            </View>
            {habit.type === 'group' && <HabitTag type={habit.type} />}
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

export default function HabitsScreen() {
  const c = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { colorScheme: scheme } = useSettings();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [extras, setExtras] = useState<Record<number, HabitExtra>>({});
  const [loading, setLoading] = useState(true);

  const [joinModal, setJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleJoin() {
    const code = extractInviteCode(joinCode);
    if (!code) { setJoinError('Введите код или ссылку'); return; }
    setJoinLoading(true);
    setJoinError(null);
    try {
      const habit = await joinHabit(code);
      setJoinModal(false);
      setJoinCode('');
      router.push(`/(tabs)/habit/${habit.id}`);
      showSnackbar('Вы вступили в группу', 'success');
    } catch (e: any) {
      setJoinError(e.message ?? 'Не удалось вступить');
    } finally {
      setJoinLoading(false);
    }
  }

  const rawName = user?.first_name ?? user?.username ?? null;
  const displayName = rawName && rawName.length > 12 ? rawName.slice(0, 12) + '…' : rawName;
  // Иконка сервиса авторизации: Telegram (tg_id) или VK (vk_id). При обоих (связанные
  // аккаунты) показываем Telegram. Цвет — neutral[400] из макета TapaDS.
  const ServiceIcon = user?.tg_id ? TelegramIcon : user?.vk_id ? VKIcon : null;
  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' : 'dark-content';
  const panelShadow = useCardShadow();

  const load = useCallback(async () => {
    try {
      const data = await getHabits();
      setHabits(data);

      const results = await Promise.allSettled(data.map(h => getHabit(h.id)));
      const map: Record<number, HabitExtra> = {};
      const today = new Date().toISOString().split('T')[0];
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          const detail = res.value;
          const self = detail.members.find(m => m.is_self);
          const todayLog = self
            ? detail.week_logs.find(l => l.date.slice(0, 10) === today && l.user_id === self.id)
            : undefined;
          map[data[i].id] = {
            streak: detail.streak.current,
            today_value: todayLog?.value ?? 0,
          };
        }
      });
      setExtras(map);
    } catch {
      // не авторизован или сеть — оставляем пустой список
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.bg }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      {/* Top panel */}
      <View style={{ backgroundColor: panelColor, borderBottomLeftRadius: 32, borderBottomRightRadius: 32,
        paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 24, ...panelShadow }}>
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {ServiceIcon && <ServiceIcon width={24} height={24} color={colors.neutral[400]} />}
            <Pressable onPress={() => router.push('/(tabs)/profile')}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })} hitSlop={8}>
              <Avatar firstName={user?.first_name ?? null} avatarUrl={user?.avatar_url ?? null} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={c.brand.primary} />
        </View>
      ) : habits.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <MascotSvg width={345} height={293} />
          <Text weight="semibold" style={{ fontSize: 16, color: c.text.secondary, textAlign: 'center', letterSpacing: 0.2 }}>
            Нет активных целей
          </Text>
        </View>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={h => String(h.id)}
          contentContainerStyle={{ padding: 24, gap: 16 }}
          renderItem={({ item }) => (
            <HabitCard habit={item} extra={extras[item.id] ?? null} onPress={() => router.push(`/(tabs)/habit/${item.id}`)} />
          )}
        />
      )}

      {/* Кнопки снизу — только в empty state */}
      {!loading && habits.length === 0 && (
        <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Добавить"
              icon={<PlusIcon />}
              onPress={() => router.push('/(tabs)/create-habit')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Вступить"
              icon={<GroupPlusIcon />}
              onPress={() => { setJoinError(null); setJoinModal(true); }}
            />
          </View>
        </View>
      )}

      {/* FAB — только когда есть цели */}
      {!loading && habits.length > 0 && (
        <View style={{ position: 'absolute', right: 24, bottom: insets.bottom + 24 }}>
          <Fab
            items={[
              {
                label: 'Создать цель',
                icon: () => <UserIcon width={24} height={24} color={c.text.secondary} />,
                onPress: () => router.push('/(tabs)/create-habit'),
              },
              {
                label: 'Вступить в группу',
                icon: () => <GroupPlusIcon width={24} height={24} color={c.text.secondary} />,
                onPress: () => { setJoinError(null); setJoinModal(true); },
              },
            ]}
          />
        </View>
      )}

      {/* Вступление в группу по коду/ссылке */}
      <BottomSheet
        visible={joinModal}
        title="Вступить в группу"
        onClose={() => { setJoinModal(false); setJoinCode(''); setJoinError(null); }}
      >
        <View style={{ gap: 16 }}>
          <Input
            label="Код-ссылка"
            value={joinCode}
            onChangeText={(t) => { setJoinCode(t); if (joinError) setJoinError(null); }}
            placeholder="Вставьте ссылку или код"
            error={joinError ?? undefined}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            label="Подтвердить"
            onPress={handleJoin}
            loading={joinLoading}
            icon={<CheckIcon />}
          />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
