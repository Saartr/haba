import {
  View,
  ScrollView,
  Pressable,
  Image,
  Modal,
  TextInput,
  StatusBar,
  useColorScheme,
  Alert,
  Clipboard,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Text from '@/components/Text';
import Button from '@/components/Button';
import ArrowBackIcon from '@/assets/icons/arrow_back.svg';
import MoreVerticalIcon from '@/assets/icons/MoreVertical.svg';
import ShareIcon from '@/assets/icons/Share.svg';
import BlockIcon from '@/assets/icons/Block.svg';
import CloseIcon from '@/assets/icons/Close.svg';
import FootprintIcon from '@/assets/icons/Footprint.svg';
import { useColors, colors } from '@/lib/colors';
import {
  getHabit,
  logHabit,
  syncHabitSteps,
  excludeMember,
  closeHabit,
  transferHabit,
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

type DayStatus = 'done' | 'missed' | 'today' | 'future';

type WeekDay = { date: number; fullDate: string; status: DayStatus };

function buildWeekDays(habit: HabitDetail): WeekDay[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = today.getUTCDay() || 7;
  const mon = new Date(today);
  mon.setUTCDate(today.getUTCDate() - dayOfWeek + 1);

  const myLogs = new Map(
    habit.week_logs
      .filter(l => l.user_id === habit.members.find(m => m.is_self)?.id)
      .map(l => [l.date.slice(0, 10), l.value]),
  );

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setUTCDate(mon.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);

    let status: DayStatus;
    if (diff > 0) {
      status = 'future';
    } else if (diff === 0) {
      status = 'today';
    } else {
      const val = myLogs.get(dateStr);
      status = val && val > 0 ? 'done' : 'missed';
    }
    return { date: d.getUTCDate(), fullDate: dateStr, status };
  });
}

// ─── sub-components ───────────────────────────────────────────────────────────

function DayCell({ day }: { day: WeekDay }) {
  const c = useColors();
  const bg =
    day.status === 'done' ? colors.green[500] :
    day.status === 'missed' ? colors.red[500] :
    colors.neutral[100];
  const borderColor =
    day.status === 'done' ? colors.green[600] :
    day.status === 'missed' ? colors.red[600] :
    day.status === 'today' ? colors.neutral[500] :
    colors.neutral[200];
  const textColor =
    day.status === 'done' ? colors.green[800] :
    day.status === 'missed' ? colors.red[800] :
    day.status === 'today' ? c.text.primary :
    c.text.placeholder;
  const shadow = day.status === 'future' ? {
    shadowColor: '#11182707', shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 1, shadowRadius: 6, elevation: 1,
  } : {};

  return (
    <View style={{ flex: 1, height: 56, alignItems: 'center', justifyContent: 'center',
      borderRadius: 8, borderWidth: 1, backgroundColor: bg, borderColor, ...shadow }}>
      <Text weight="bold" style={{ fontSize: 16, color: textColor, letterSpacing: 0.2 }}>
        {day.date}
      </Text>
    </View>
  );
}

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

function BottomModal({ title, visible, onClose, children }: {
  title: string; visible: boolean; onClose: () => void; children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18,18,18,0.24)' }}>
        <View style={{ backgroundColor: colors.neutral[0], borderTopLeftRadius: 24,
          borderTopRightRadius: 24, paddingTop: 32, paddingBottom: 56, paddingHorizontal: 24, gap: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text weight="bold" style={{ fontSize: 24, color: c.text.primary, letterSpacing: 0.2 }}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <CloseIcon width={24} height={24} color={c.text.primary} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function HabitScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habitId = parseInt(id);

  const [habit, setHabit] = useState<HabitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [logLoading, setLogLoading] = useState(false);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [excludeTarget, setExcludeTarget] = useState<number | null>(null);
  const [inviteModal, setInviteModal] = useState(false);
  const [stepsModal, setStepsModal] = useState(false);
  const [stepsInput, setStepsInput] = useState('');
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
    Alert.alert('Закрыть группу?', 'Это действие необратимо.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Закрыть', style: 'destructive', onPress: async () => {
        try { await closeHabit(habitId); router.back(); } catch (e: any) { Alert.alert('Ошибка', e.message); }
      }},
    ]);
  }

  async function handleLeave() {
    setMenuVisible(false);
    Alert.alert('Выйти из привычки?', '', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => {
        try { await excludeMember(habitId, me!.id); router.back(); } catch (e: any) { Alert.alert('Ошибка', e.message); }
      }},
    ]);
  }

  async function handleExclude() {
    if (excludeTarget == null) return;
    try {
      await excludeMember(habitId, excludeTarget);
      setExcludeTarget(null);
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
        setTrackerLoading(false);
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
      if (steps > 0) {
        await syncHabitSteps(habitId, steps, 'health_connect');
      }
      setStepsModal(false);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось подключить трекер');
    } finally {
      setTrackerLoading(false);
    }
  }

  async function handleLogManual() {
    const val = parseInt(stepsInput);
    if (!val || val < 1 || val > 100000) {
      Alert.alert('Ошибка', 'Введите число от 1 до 100 000');
      return;
    }
    setLogLoading(true);
    setStepsModal(false);
    setStepsInput('');
    try {
      await logHabit(habitId, val);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLogLoading(false);
    }
  }

  function handleCopyInvite() {
    if (!habit) return;
    const link = `https://bot.mihmih.pro/join/${habit.invite_code}`;
    Clipboard.setString(link);
    setInviteModal(false);
    Alert.alert('Скопировано', link);
  }

  if (loading || !habit) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.brand.primary} />
      </SafeAreaView>
    );
  }

  const weekDays = buildWeekDays(habit);
  const progressPercent = habit.goal_value
    ? Math.min((myTodayLog?.value ?? 0) / habit.goal_value, 1)
    : myTodayLog?.value ? 1 : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      {/* Nav bar */}
      <View style={{ backgroundColor: panelColor, height: 56 + insets.top, paddingTop: insets.top,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, position: 'absolute', left: 24, top: insets.top + 16 })}>
          <ArrowBackIcon width={24} height={24} color={c.text.primary} />
        </Pressable>
        <Text weight="semibold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2, marginTop: insets.top }}>
          {habit.name}
        </Text>
        <Pressable onPress={() => setMenuVisible(v => !v)} hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, position: 'absolute', right: 24, top: insets.top + 16 })}>
          <MoreVerticalIcon width={24} height={24} color={c.text.primary} />
        </Pressable>
      </View>

      {/* Dropdown menu */}
      {menuVisible && (
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }}
          onPress={() => setMenuVisible(false)}
        >
          <View
            style={{
              position: 'absolute',
              top: insets.top + 56 - 8,
              right: 16,
              backgroundColor: colors.neutral[0],
              borderRadius: 16,
              paddingVertical: 8,
              minWidth: 200,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 8,
              zIndex: 100,
            }}
          >
            {habit.is_creator ? (
              <>
                <Pressable
                  onPress={() => setMenuVisible(false)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 20, paddingVertical: 16, opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text weight="medium" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                    Передать права
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleCloseGroup}
                  style={({ pressed }) => ({
                    paddingHorizontal: 20, paddingVertical: 16, opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Text weight="medium" style={{ fontSize: 16, color: colors.red[600], letterSpacing: 0.2 }}>
                    Закрыть группу
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={handleLeave}
                style={({ pressed }) => ({
                  paddingHorizontal: 20, paddingVertical: 16, opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text weight="medium" style={{ fontSize: 16, color: colors.red[600], letterSpacing: 0.2 }}>
                  Выйти из привычки
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text weight="bold" style={{ fontSize: 14, color: c.text.label, letterSpacing: 0.2 }}>
          Достижения
        </Text>

        {/* Week strip */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {weekDays.map(day => <DayCell key={day.fullDate} day={day} />)}
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 16 }}>
          {habit.category === 'steps' && (
            <View style={{ flex: 1, backgroundColor: colors.neutral[0], borderRadius: 32,
              borderWidth: 1, borderColor: colors.purple[50], paddingHorizontal: 16, paddingVertical: 24, gap: 16 }}>
              <View>
                <Text weight="medium" style={{ fontSize: 14, color: colors.neutral[600], letterSpacing: 0.2 }}>
                  Шагов за сегодня
                </Text>
                <Text weight="bold" style={{ fontSize: 16, color: colors.neutral[900], letterSpacing: 0.2 }}>
                  {(myTodayLog?.value ?? 0).toLocaleString('ru-RU')}
                  {habit.goal_value ? ` / ${habit.goal_value.toLocaleString('ru-RU')}` : ''}
                </Text>
              </View>
              <View style={{ height: 22 }}>
                <View style={{ position: 'absolute', left: 0, right: 0, top: 4, height: 14,
                  borderRadius: 12, borderWidth: 1, borderColor: colors.neutral[500], backgroundColor: colors.neutral[100] }} />
                <View style={{ position: 'absolute', left: 4, top: 4, height: 14, borderRadius: 12,
                  backgroundColor: progressPercent > 0 ? colors.green[500] : colors.neutral[600],
                  width: Math.max(14, progressPercent * 100) }} />
              </View>
            </View>
          )}

          <View style={{ flex: 1, backgroundColor: colors.neutral[0], borderRadius: 32,
            borderWidth: 1, borderColor: colors.purple[50], padding: 16, gap: 4 }}>
            <View>
              <Text weight="medium" style={{ fontSize: 14, color: colors.neutral[600], letterSpacing: 0.2 }}>
                Текущий стрик
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: colors.neutral[900], letterSpacing: 0.2 }}>
                {habit.streak.current}
              </Text>
            </View>
            <View>
              <Text weight="medium" style={{ fontSize: 14, color: colors.neutral[600], letterSpacing: 0.2 }}>
                Максимальный
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: colors.neutral[900], letterSpacing: 0.2 }}>
                {habit.streak.max}
              </Text>
            </View>
          </View>
        </View>

        {/* Участники */}
        <View style={{ backgroundColor: colors.neutral[0], borderRadius: 32, borderWidth: 1,
          borderColor: colors.purple[50], paddingHorizontal: 24, paddingVertical: 16, gap: 16 }}>
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
              onExclude={setExcludeTarget}
            />
          ))}
          <Pressable onPress={() => setInviteModal(true)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center',
              justifyContent: 'center', gap: 12, height: 56, borderRadius: 12, opacity: pressed ? 0.7 : 1 })}>
            <ShareIcon width={24} height={24} color={c.text.link} />
            <Text weight="bold" style={{ fontSize: 16, color: c.text.link, letterSpacing: 0.2 }}>
              Пригласить в группу
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
        <Button
          label="Внести шаги"
          onPress={() => setStepsModal(true)}
          loading={logLoading}
          icon={<FootprintIcon width={20} height={20} color={c.icon.onPrimary} />}
        />
      </View>

      {/* Invite modal */}
      <BottomModal title="Пригласить в группу" visible={inviteModal} onClose={() => setInviteModal(false)}>
        <View style={{ gap: 16 }}>
          <Text weight="bold" style={{ fontSize: 16, color: colors.neutral[600], letterSpacing: 0.2 }}>
            Любой человек может вступить в групповую привычку по этой ссылке
          </Text>
          <Button label="Скопировать ссылку" onPress={handleCopyInvite} />
        </View>
      </BottomModal>

      {/* Steps modal */}
      <BottomModal title="Внести шаги" visible={stepsModal} onClose={() => { setStepsModal(false); setStepsInput(''); }}>
        <View style={{ gap: 16 }}>
          {Platform.OS === 'android' && (
            <Button label="Подключить трекер" onPress={handleConnectTracker} loading={trackerLoading} />
          )}
          <View style={{ gap: 8 }}>
            <TextInput
              value={stepsInput}
              onChangeText={t => setStepsInput(t.replace(/[^0-9]/g, ''))}
              placeholder="Количество шагов"
              placeholderTextColor={c.text.placeholder}
              keyboardType="number-pad"
              maxLength={6}
              style={{
                height: 56,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: c.border.input,
                backgroundColor: c.surface.input,
                paddingHorizontal: 20,
                fontSize: 16,
                fontFamily: 'Manrope_600SemiBold',
                color: c.text.primary,
                letterSpacing: 0.2,
              }}
            />
            <Button label="Записать" onPress={handleLogManual} />
          </View>
        </View>
      </BottomModal>

      {/* Exclude modal */}
      <BottomModal
        title="Исключить"
        visible={excludeTarget !== null}
        onClose={() => setExcludeTarget(null)}
      >
        <View style={{ gap: 16 }}>
          <Text weight="bold" style={{ fontSize: 16, color: colors.neutral[600], letterSpacing: 0.2 }}>
            После исключения вся информация об участнике будет удалена из группы
          </Text>
          <Button label="Подтвердить" onPress={handleExclude} />
        </View>
      </BottomModal>
    </SafeAreaView>
  );
}
