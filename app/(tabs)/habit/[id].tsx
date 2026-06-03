import {
  View,
  ScrollView,
  Pressable,
  Image,
  StatusBar,
  Alert,
  Clipboard,
  ActivityIndicator,
  Platform,
  Linking,
  Share,
} from 'react-native';
import Calendar, { CalendarDay } from '@/components/Calendar';
import Card from '@/components/Card';
import DropdownPopover from '@/components/DropdownPopover';
import NavigationBar from '@/components/NavigationBar';
import EditIcon from '@/assets/icons/Edit.svg';
import DeleteIcon from '@/assets/icons/Delete.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import PlusIcon from '@/assets/icons/Plus.svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Text from '@/components/Text';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { useConfirm } from '@/components/ConfirmModal';
import { useSnackbar } from '@/lib/snackbar-context';
import BottomSheet from '@/components/BottomSheet';
import MoreVerticalIcon from '@/assets/icons/MoreVertical.svg';
import ShareIcon from '@/assets/icons/Share.svg';
import LinkIcon from '@/assets/icons/Link.svg';
import BlockIcon from '@/assets/icons/Block.svg';
import CloseIcon from '@/assets/icons/Close.svg';
import FootprintIcon from '@/assets/icons/Footprint.svg';
import SupervisorAccountIcon from '@/assets/icons/SupervisorAccount.svg';
import LogoutIcon from '@/assets/icons/Logout.svg';
import DeleteForeverIcon from '@/assets/icons/DeleteForever.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import {
  getHabit,
  logHabit,
  syncHabitSteps,
  excludeMember,
  closeHabit,
  HabitDetail,
  HabitMember,
} from '@/lib/api';
import {
  isHealthConnectAvailable,
  hasStepsPermission,
  requestStepsPermission,
  getTodaySteps,
} from '@/lib/health';
import { useEffect, useState, useCallback } from 'react';

// ─── helpers ──────────────────────────────────────────────────────────────────


const CHECK_IN_LABELS: Record<string, [string, string]> = {
  smoking:    ['Не курил', 'Курил'],
  'no-smoking': ['Не курил', 'Курил'],
};

function buildCalendarDays(habit: HabitDetail): CalendarDay[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = today.getUTCDay() || 7;
  const mon = new Date(today);
  mon.setUTCDate(today.getUTCDate() - dayOfWeek + 1);

  const selfId = habit.members.find(m => m.is_self)?.id;
  const myLogs = new Map(
    habit.week_logs
      .filter(l => l.user_id === selfId)
      .map(l => [l.date.slice(0, 10), l.value]),
  );

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setUTCDate(mon.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    const loggedValue = myLogs.get(dateStr);

    let status: CalendarDay['status'];
    if (diff > 0) {
      status = 'future';
    } else if (diff === 0) {
      // Сегодня: зависит от того залогировано ли
      if (loggedValue === undefined) {
        status = 'current';       // ещё не отмечено
      } else if (loggedValue > 0) {
        status = 'check';         // не курил — зелёный
      } else {
        status = 'miss';          // курил — красный
      }
    } else {
      // Прошлые дни
      status = loggedValue !== undefined && loggedValue > 0 ? 'check' : 'miss';
    }
    return { day: d.getUTCDate(), status };
  });
}


function SoloHabitScreen({
  habit, onLog, logLoading, onDelete,
}: {
  habit: HabitDetail;
  onLog: (value: number) => void;
  logLoading: boolean;
  onDelete: () => void;
}) {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme: scheme } = useSettings();
  const [menuVisible, setMenuVisible] = useState(false);
  const [successLabel, failLabel] = CHECK_IN_LABELS[habit.category ?? ''] ?? ['Выполнено', 'Пропустил'];
  const calendarDays = buildCalendarDays(habit);
  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar
          title={habit.name}
          onBack={() => router.back()}
          right={
            <Pressable onPress={() => setMenuVisible(true)} hitSlop={8}>
              {({ pressed }) => (
                <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }}>
                  <MoreVerticalIcon width={24} height={24} color={c.text.primary} />
                </View>
              )}
            </Pressable>
          }
        />
      </View>

      <DropdownPopover
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={[
          {
            label: 'Редактировать',
            icon: <EditIcon width={24} height={24} color={c.text.secondary} />,
            onPress: () => {},
          },
          {
            label: 'Удалить',
            icon: <DeleteIcon width={24} height={24} color={colors.red[500]} />,
            onPress: onDelete,
            destructive: true,
          },
        ]}
      />

      {/* Content — без flex:1, естественная высота */}
      <View style={{ padding: 24, gap: 16 }}>
        <Calendar days={calendarDays} />

        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Card style={{ flex: 1, gap: 4 }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary }}>
              Текущий стрик
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary }}>
              {habit.streak?.current ?? 0}
            </Text>
          </Card>
          <Card style={{ flex: 1, gap: 4 }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary }}>
              Лучший стрик
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary }}>
              {habit.streak?.max ?? 0}
            </Text>
          </Card>
        </View>
      </View>

      {/* Спейсер — отжимает кнопки вниз */}
      <View style={{ flex: 1 }} />

      {/* Bottom buttons */}
      <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 24, paddingBottom: 16 }}>
        <Pressable onPress={() => onLog(1)} disabled={logLoading} style={{ flex: 1, height: 56 }}>
          {({ pressed }) => (
            <View style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 12, borderRadius: 12,
              backgroundColor: pressed ? c.brand.pressed : c.brand.primary,
            }}>
              <CheckIcon width={16} height={16} color="#FFFFFF" />
              <Text weight="bold" style={{ fontSize: 16, color: '#FFFFFF' }}>{successLabel}</Text>
            </View>
          )}
        </Pressable>
        <Pressable onPress={() => onLog(0)} disabled={logLoading} style={{ flex: 1, height: 56 }}>
          {({ pressed }) => (
            <View style={{
              flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              gap: 12, borderRadius: 12,
              backgroundColor: pressed ? colors.red[600] : colors.red[500],
            }}>
              <CloseIcon width={14} height={14} color="#FFFFFF" />
              <Text weight="bold" style={{ fontSize: 16, color: '#FFFFFF' }}>{failLabel}</Text>
            </View>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────


function MemberRow({
  member, goalValue, todayValue, isCreator, onExclude,
}: {
  member: HabitMember;
  goalValue: number | null;
  todayValue: number | null;
  isCreator: boolean;
  onExclude: (id: number) => void;
}) {
  const c = useColors();
  const name = member.first_name ?? member.username ?? '?';
  const initial = name[0].toUpperCase();
  const displayName = member.is_self ? `${name} (Я)` : name;

  const stepsLabel = goalValue != null
    ? `${(todayValue ?? 0).toLocaleString('ru-RU')} / ${goalValue.toLocaleString('ru-RU')}`
    : todayValue != null ? String(todayValue) : '—';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        {member.avatar_url ? (
          <Image source={{ uri: member.avatar_url }}
            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.neutral[500] }} />
        ) : (
          <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2,
            borderColor: colors.neutral[500], backgroundColor: colors.neutral[50],
            alignItems: 'center', justifyContent: 'center' }}>
            <Text weight="bold" style={{ fontSize: 20, color: colors.neutral[500], lineHeight: 30 }}>
              {initial}
            </Text>
          </View>
        )}
        <View>
          <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
            {displayName}
          </Text>
          <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
            {stepsLabel}
          </Text>
        </View>
      </View>
      {isCreator && !member.is_self && (
        <Pressable onPress={() => onExclude(member.id)} hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <BlockIcon width={24} height={24} color={c.text.secondary} />
        </Pressable>
      )}
    </View>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function HabitScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();
  const showSnackbar = useSnackbar();
  const { colorScheme: scheme } = useSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habitId = parseInt(id);

  const [habit, setHabit] = useState<HabitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stepsModal, setStepsModal] = useState(false);
  const [stepsView, setStepsView] = useState<'menu' | 'edit' | 'add'>('menu');
  const [stepsInput, setStepsInput] = useState('');
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);

  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' : 'dark-content';

  const load = useCallback(async () => {
    try {
      const data = await getHabit(habitId);
      setHabit(data);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  }, [habitId]);

  useEffect(() => { load(); }, [load]);

  // Автосинк шагов из Health Connect, если уже есть permission
  useEffect(() => {
    if (!habit || habit.category !== 'steps' || Platform.OS !== 'android') return;
    let cancelled = false;
    (async () => {
      try {
        const granted = await hasStepsPermission();
        if (!granted || cancelled) return;
        const steps = await getTodaySteps();
        if (cancelled || steps <= 0) return;
        await syncHabitSteps(habitId, steps, 'health_connect');
        if (!cancelled) load();
      } catch (e) {
        // тихий автосинк — не дёргаем юзера Alert'ом
        console.warn('[health] auto-sync failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [habit?.id, habit?.category, habitId, load]);

  const me = habit?.members.find(m => m.is_self);
  const today = new Date().toISOString().slice(0, 10);
  const myTodayLog = habit?.week_logs.find(l => l.user_id === me?.id && l.date.slice(0, 10) === today);

  function todayValueFor(memberId: number) {
    return habit?.week_logs.find(l => l.user_id === memberId && l.date.slice(0, 10) === today)?.value ?? null;
  }

  async function handleCloseGroup() {
    setMenuVisible(false);
    const ok = await confirm({
      title: 'Закрыть группу?',
      description: 'Это действие необратимо — вся информация о привычке будет стёрта.',
      confirmLabel: 'Закрыть',
      confirmIcon: <DeleteForeverIcon width={24} height={24} color={c.icon.onPrimary} />,
      destructive: true,
    });
    if (!ok) return;
    try { await closeHabit(habitId); router.back(); showSnackbar('Привычка удалена', 'success'); } catch (e: any) { Alert.alert('Ошибка', e.message); }
  }

  async function handleLeave() {
    setMenuVisible(false);
    const ok = await confirm({
      title: 'Выйти из привычки?',
      description: 'Вы перестанете участвовать в этой групповой привычке.',
      confirmLabel: 'Выйти',
      confirmIcon: <LogoutIcon width={24} height={24} color={c.icon.onPrimary} />,
      destructive: true,
    });
    if (!ok) return;
    try { await excludeMember(habitId, me!.id); router.back(); showSnackbar('Вы вышли из привычки', 'success'); } catch (e: any) { Alert.alert('Ошибка', e.message); }
  }

  async function handleExclude(memberId: number) {
    const ok = await confirm({
      title: 'Исключить',
      description: 'После исключения вся информация об участнике будет удалена из группы',
      confirmLabel: 'Подтвердить',
      destructive: true,
    });
    if (!ok) return;
    try {
      await excludeMember(habitId, memberId);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  }

  async function handleConnectTracker() {
    if (Platform.OS !== 'android') {
      Alert.alert('Скоро', 'Подключение трекера на iOS пока недоступно');
      return;
    }
    setTrackerLoading(true);
    try {
      const available = await isHealthConnectAvailable();
      if (!available) {
        Alert.alert(
          'Health Connect не найден',
          'Установите приложение Health Connect из Play Store, затем попробуйте снова.',
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Открыть Play Store',
              onPress: () =>
                Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() =>
                  Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'),
                ),
            },
          ],
        );
        return;
      }
      const granted = await requestStepsPermission();
      if (!granted) {
        Alert.alert('Доступ не получен', 'Без доступа к шагам синк не сработает.');
        return;
      }
      const steps = await getTodaySteps();
      if (steps > 0) await syncHabitSteps(habitId, steps, 'health_connect');
      setStepsModal(false);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось подключить трекер');
    } finally {
      setTrackerLoading(false);
    }
  }

  function closeStepsModal() {
    setStepsModal(false);
    setStepsView('menu');
    setStepsInput('');
    setStepsError(null);
  }

  async function handleStepsSubmit() {
    const input = parseInt(stepsInput);
    if (stepsInput === '' || Number.isNaN(input)) {
      setStepsError('Введите число');
      return;
    }
    // add — прибавление, 0 бессмыслен; edit — перезапись, 0 допустим (обнулить)
    if (stepsView === 'add' ? input < 1 : input < 0) {
      setStepsError(stepsView === 'add' ? 'Введите число больше нуля' : 'Введите число');
      return;
    }
    // edit — перезапись, add — прибавить к текущему (API logHabit перезаписывает)
    const value = stepsView === 'add' ? (myTodayLog?.value ?? 0) + input : input;
    if (value > 100000) {
      setStepsError('Значение не должно превышать 100 000');
      return;
    }
    setStepsError(null);
    setLogLoading(true);
    closeStepsModal();
    try {
      await logHabit(habitId, value);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLogLoading(false);
    }
  }

  const inviteLink = habit ? `https://bot.mihmih.pro/join/${habit.invite_code}` : '';

  function handleCopyInvite() {
    if (!habit) return;
    Clipboard.setString(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShareInvite() {
    if (!habit) return;
    setInviteModal(false);
    try {
      await Share.share({ message: inviteLink });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  }

  async function handleSoloLog(value: number) {
    setLogLoading(true);
    try {
      await logHabit(habitId, value);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLogLoading(false);
    }
  }

  if (loading || !habit) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.brand.primary} />
      </SafeAreaView>
    );
  }

  async function handleDeleteSolo() {
    const ok = await confirm({
      title: 'Удалить привычку?',
      description: 'Это действие необратимо — вся информация о привычке будет стёрта.',
      confirmLabel: 'Удалить',
      confirmIcon: <DeleteForeverIcon width={24} height={24} color={c.icon.onPrimary} />,
      destructive: true,
    });
    if (!ok) return;
    try { await closeHabit(habitId); router.back(); showSnackbar('Привычка удалена', 'success'); } catch (e: any) { Alert.alert('Ошибка', e.message); }
  }

  if (habit.type === 'solo') {
    return (
      <SoloHabitScreen
        habit={habit}
        onLog={handleSoloLog}
        logLoading={logLoading}
        onDelete={handleDeleteSolo}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      {/* Nav bar */}
      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar
          title={habit.name}
          onBack={() => router.back()}
          right={
            <Pressable onPress={() => setMenuVisible(true)} hitSlop={8}>
              {({ pressed }) => (
                <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }}>
                  <MoreVerticalIcon width={24} height={24} color={c.text.primary} />
                </View>
              )}
            </Pressable>
          }
        />
      </View>

      <DropdownPopover
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={[
          {
            label: 'Пригласить в группу',
            icon: <ShareIcon width={24} height={24} color={c.text.secondary} />,
            onPress: () => setInviteModal(true),
          },
          ...(habit.is_creator && habit.members.length > 1 ? [{
            label: 'Передать права',
            icon: <SupervisorAccountIcon width={24} height={24} color={c.text.secondary} />,
            onPress: () => {},
          }] : []),
          ...(!habit.is_creator && habit.members.length > 1 ? [{
            label: 'Выйти из привычки',
            icon: <LogoutIcon width={24} height={24} color={c.text.secondary} />,
            onPress: handleLeave,
          }] : []),
          ...(habit.is_creator ? [{
            label: 'Удалить',
            icon: <DeleteForeverIcon width={24} height={24} color={colors.red[500]} />,
            onPress: handleCloseGroup,
            destructive: true,
          }] : []),
        ]}
      />

      <ScrollView contentContainerStyle={{ paddingVertical: 24, gap: 8 }}>
        <View style={{ paddingHorizontal: 24 }}>
          <Calendar days={buildCalendarDays(habit)} />
        </View>

        {/* Stats — горизонтальный скролл */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: 0 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 8, gap: 16 }}
        >
          {habit.category === 'steps' && (
            <Card style={{ gap: 4 }}>
              <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
                Шагов сегодня
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                {(myTodayLog?.value ?? 0).toLocaleString('ru-RU')}
                {habit.goal_value ? ` / ${habit.goal_value.toLocaleString('ru-RU')}` : ''}
              </Text>
            </Card>
          )}

          <Card style={{ gap: 4 }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              Стрик
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
              {habit.streak.current}
            </Text>
          </Card>

          <Card style={{ gap: 4 }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              Максимальный
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
              {habit.streak.max}
            </Text>
          </Card>
        </ScrollView>

        {/* Участники */}
        <View style={{ paddingHorizontal: 24 }}>
          <Card style={{ gap: 16 }}>
            <Text weight="bold" style={{ fontSize: 14, color: c.text.label, letterSpacing: 0.2 }}>
              Участники
            </Text>
            {habit.members.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                goalValue={habit.goal_value}
                todayValue={todayValueFor(m.id)}
                isCreator={habit.is_creator}
                onExclude={handleExclude}
              />
            ))}
          </Card>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
        <Button
          label="Внести шаги"
          onPress={() => { setStepsView('menu'); setStepsInput(''); setStepsModal(true); }}
          loading={logLoading}
          icon={<FootprintIcon width={20} height={20} color={c.icon.onPrimary} />}
        />
      </View>

      {/* Invite modal */}
      <BottomSheet title="Пригласить в группу" visible={inviteModal} onClose={() => { setInviteModal(false); setCopied(false); }}>
        <View style={{ gap: 16 }}>
          <Text weight="bold" style={{ fontSize: 16, lineHeight: 16 * 1.6, color: c.text.secondary, letterSpacing: 0.2 }}>
            Любой человек может вступить в групповую привычку по этой ссылке
          </Text>
          <Text
            weight="bold"
            numberOfLines={1}
            style={{ fontSize: 16, lineHeight: 16 * 1.6, color: c.text.link, letterSpacing: 0.2 }}
          >
            {inviteLink}
          </Text>
          <Button
            label={copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
            icon={
              copied
                ? <CheckIcon width={24} height={24} color={c.icon.onPrimary} />
                : <LinkIcon width={24} height={24} color={c.icon.onPrimary} />
            }
            color={copied ? colors.green[500] : undefined}
            onPress={handleCopyInvite}
          />
          <Button
            label="Пригласить"
            icon={<ShareIcon width={24} height={24} color={c.icon.onPrimary} />}
            onPress={handleShareInvite}
          />
        </View>
      </BottomSheet>

      {/* Steps modal — 3 состояния: menu / edit / add */}
      <BottomSheet
        title={stepsView === 'edit' ? 'Изменить шаги' : stepsView === 'add' ? 'Добавить шаги' : 'Внести шаги'}
        visible={stepsModal}
        onClose={closeStepsModal}
      >
        {stepsView === 'menu' ? (
          <View style={{ gap: 16 }}>
            <Button label="Подключить трекер" onPress={handleConnectTracker} loading={trackerLoading} />
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Button variant="secondary" label="Изменить шаги" onPress={() => { setStepsInput(''); setStepsError(null); setStepsView('edit'); }} />
              </View>
              <View style={{ flex: 1 }}>
                <Button variant="secondary" label="Добавить шаги" onPress={() => { setStepsInput(''); setStepsError(null); setStepsView('add'); }} />
              </View>
            </View>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <Input
              label="Текущее значение"
              value={(myTodayLog?.value ?? 0).toLocaleString('ru-RU')}
              onChangeText={() => {}}
              disabled
            />
            <Input
              label={stepsView === 'edit' ? 'Новое значение' : 'Количество шагов'}
              value={stepsInput}
              onChangeText={t => { setStepsInput(t.replace(/[^0-9]/g, '')); if (stepsError) setStepsError(null); }}
              keyboardType="number-pad"
              maxLength={6}
              error={stepsError ?? undefined}
            />
            <Button
              label={stepsView === 'edit' ? 'Подтвердить' : 'Добавить'}
              icon={
                stepsView === 'edit'
                  ? <CheckIcon width={24} height={24} color={c.icon.onPrimary} />
                  : <PlusIcon width={24} height={24} color={c.icon.onPrimary} />
              }
              onPress={handleStepsSubmit}
              loading={logLoading}
            />
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}
