import { View, Pressable, Image, StatusBar, ActivityIndicator, RefreshControl, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import Text from '@/components/Text';
import HabitTag from '@/components/HabitTag';
import ProgressBar from '@/components/ProgressBar';
import Toolbar, { useToolbarShadow } from '@/components/Toolbar';
import BottomSheet from '@/components/BottomSheet';
import Input from '@/components/Input';
import Button from '@/components/Button';
import GroupIcon from '@/assets/icons/Group.svg';
import PersonIcon from '@/assets/icons/Person.svg';
import UserIcon from '@/assets/icons/User.svg';
import GroupPlusIcon from '@/assets/icons/GroupPlus.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { useSnackbar } from '@/lib/snackbar-context';
import { getHabits, joinHabit, Habit } from '@/lib/api';
import { computeHabitStatus, pluralDays, HabitExtra } from '@/lib/habit-status';

// Пользователь может вставить полную ссылку (https://.../join/<code>, haba://join/<code>)
// или просто код — берём последний сегмент пути без query/hash.
function extractInviteCode(input: string): string {
  const noQuery = input.trim().split(/[?#]/)[0].replace(/\/+$/, '');
  return noQuery.split('/').pop() ?? '';
}

function HabitCard({ habit, extra, onPress }: {
  habit: Habit;
  extra: HabitExtra | null;
  onPress: () => void;
}) {
  const c = useColors();
  const { colorScheme } = useSettings();
  const streakMax = extra?.streakMax ?? 0;
  const { subtitle, value, status, showStreakRow, showTag } = computeHabitStatus(habit, extra);
  const TypeIcon = habit.type === 'group' ? GroupIcon : PersonIcon;
  // neutral[75] — фон карточки в светлой теме (Figma), в тёмной — как раньше, surface.bg
  const cardBg = colorScheme === 'dark' ? c.surface.bg : colors.neutral[75];

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <View style={{ backgroundColor: cardBg, borderRadius: 24, padding: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TypeIcon width={20} height={20} color={c.text.secondary} />
          <Text weight="bold" numberOfLines={1} style={{ flex: 1, fontSize: 14, lineHeight: 14 * 1.4, color: c.text.primary, letterSpacing: 0.2 }}>
            {habit.name}
          </Text>
          {showTag && <HabitTag type={status} />}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text weight="medium" style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
            {subtitle}
          </Text>
          <Text weight="bold" style={{ fontSize: 16, lineHeight: 16 * 1.5, color: c.text.primary, letterSpacing: 0.2 }}>
            {value}
          </Text>
        </View>

        {showStreakRow && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text weight="medium" style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
              Лучший стрик
            </Text>
            <Text weight="bold" style={{ fontSize: 16, lineHeight: 16 * 1.5, color: c.text.primary, letterSpacing: 0.2 }}>
              {pluralDays(streakMax)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function HabitsScreen() {
  const c = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { colorScheme } = useSettings();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();
  const sheetShadow = useToolbarShadow();

  // Полная высота шапки на экране. Для paddingTop скролла нужно вычитать insets.top:
  // ScrollView (обычный поток) уже стоит ниже верхнего инсета SafeAreaView, а абсолютно
  // спозиционированная шапка (top:0) — нет, поэтому их точки отсчёта отличаются на insets.top.
  const headerHeight = insets.top + 16 + 130;
  // Параллакс шапки: при скролле она уходит вверх вдвое медленнее самой простыни
  // (которая двигается 1:1 с содержимым) — простыня визуально «наезжает» и постепенно
  // перекрывает шапку, к моменту headerHeight та ещё и растворяется.
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, headerHeight],
    outputRange: [0, -headerHeight * 0.5],
    extrapolate: 'clamp',
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, headerHeight * 0.7, headerHeight],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });
  const [habits, setHabits] = useState<Habit[]>([]);
  const [extras, setExtras] = useState<Record<number, HabitExtra>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const openingHabitRef = useRef(false);

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

  const load = useCallback(async () => {
    try {
      // Один запрос: GET /habits отдаёт streak и today_value для каждой цели —
      // раньше здесь был getHabit() на каждую цель (N+1, тяжёлые запросы истории).
      const data = await getHabits();
      setHabits(data);

      const map: Record<number, HabitExtra> = {};
      for (const h of data) {
        map[h.id] = {
          streak: h.streak?.current ?? 0,
          streakMax: h.streak?.max ?? 0,
          today_value: h.today_value ?? 0,
        };
      }
      setExtras(map);
    } catch {
      // не авторизован или сеть — оставляем пустой список
    } finally {
      setLoading(false);
    }
  }, []);

  // Полноэкранный лоадер — только при первом входе; при возврате на экран показываем
  // уже загруженный список и тихо обновляем данные в фоне (без мигания спиннером).
  const loadedOnceRef = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!loadedOnceRef.current) {
      setLoading(true);
      loadedOnceRef.current = true;
    }
    load();
    // Сбрасываем гейт от двойного тапа по карточке при каждом возврате на экран.
    openingHabitRef.current = false;
  }, [load]));

  // Pull-to-refresh — тот же load, но со спиннером RefreshControl вместо полноэкранного.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Быстрый двойной тап по карточке до начала перехода успевал вызвать router.push
  // дважды — в стеке оказывалось два экрана цели. Блокируем повторный переход, пока
  // не вернёмся на этот экран (см. сброс во focus-эффекте выше).
  function openHabit(id: number) {
    if (openingHabitRef.current) return;
    openingHabitRef.current = true;
    router.push(`/(tabs)/habit/${id}`);
  }

  // Только активные (не истёкшие по периоду) цели — та же фильтрация, что и в списке ниже.
  const visibleHabits = habits.filter(h => {
    if (h.duration_type === 'period' && h.period_end && h.period_end < new Date().toISOString().slice(0, 10)) return false;
    return true;
  });
  const total = visibleHabits.length;
  const doneCount = visibleHabits.filter(h => computeHabitStatus(h, extras[h.id] ?? null).done).length;
  const allDone = total > 0 && doneCount === total;
  const statusText = allDone ? 'Все цели выполнены' : `${doneCount}/${total} целей выполнено`;

  const isEmpty = !loading && habits.length === 0;

  // neutral[75] — фон страницы (там, где шапка) в светлой теме (Figma), в тёмной — как раньше.
  const pageBg = colorScheme === 'dark' ? c.surface.bg : colors.neutral[75];

  // Toolbar — по центру внизу, общий и для пустого состояния, и для списка целей.
  const toolbar = (
    <View style={{ position: 'absolute', bottom: insets.bottom + 24, left: 0, right: 0, alignItems: 'center' }}>
      <Toolbar
        icon={<UserIcon />}
        onIconPress={() => router.push('/(tabs)/profile')}
        fabItems={[
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
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: pageBg }} edges={['top']}>
      <StatusBar backgroundColor={pageBg} barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      {isEmpty ? (
        <>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <Image
              source={require('@/assets/images/empty_habits.png')}
              style={{ width: 309, height: 296 }}
              resizeMode="contain"
            />
            <View style={{ gap: 2, paddingHorizontal: 24 }}>
              <Text weight="semibold" numberOfLines={1} style={{ fontSize: 16, lineHeight: 16 * 1.4, color: c.text.primary, textAlign: 'center', letterSpacing: 0.2 }}>
                {displayName ? `Привет, ${displayName}` : 'Привет'}
              </Text>
              <Text weight="semibold" style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.secondary, textAlign: 'center', letterSpacing: 0.2 }}>
                У тебя пока нет активных целей
              </Text>
            </View>
          </View>
          {toolbar}
        </>
      ) : (
        <>
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={c.brand.primary} />
            </View>
          ) : (
            <>
              {/* Header — маскот слева, приветствие+статус и прогресс-бар справа. Не скроллится
                  сама, но параллаксит (translateY + fade) от scrollY простыни — см. выше.
                  Высота шапки считается напрямую (paddingTop + высота маскота), не через
                  onLayout — так paddingTop скролла гарантированно совпадает с реальной
                  высотой без гонки. Внешний View с overflow:hidden обрезает шапку по той же
                  границе (верх safe area), по которой простыню естественно обрезает ScrollView.
                  top:insets.top (не 0) — absolute-позиционирование игнорирует паддинг
                  SafeAreaView (считает от её border-box, а не content-box), поэтому обёртку
                  с top:0 пришлось бы клипать от физического верха экрана, а не от границы
                  safe area — иллюстрация всё равно заезжала на статус-бар. */}
              <View style={{ position: 'absolute', top: insets.top, left: 0, right: 0, height: headerHeight - insets.top, overflow: 'hidden' }}>
                <Animated.View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 16, paddingHorizontal: 24, transform: [{ translateY: headerTranslateY }], opacity: headerOpacity }}
                >
                  <Image
                    source={allDone ? require('@/assets/images/tapa_happy.png') : require('@/assets/images/tapa_sad.png')}
                    style={{ width: 161, height: 130 }}
                    resizeMode="contain"
                  />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={{ gap: 2 }}>
                      <Text weight="bold" numberOfLines={1} style={{ fontSize: 16, lineHeight: 16 * 1.4, color: c.text.primary, letterSpacing: 0.2 }}>
                        {displayName ? `Привет, ${displayName}` : 'Привет'}
                      </Text>
                      <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
                        {statusText}
                      </Text>
                    </View>
                    <ProgressBar total={total} value={doneCount} />
                  </View>
                </Animated.View>
              </View>

              {/* Простыня — над шапкой в z-порядке (рендерится позже), пустая зона сверху
                  контента (paddingTop = высота шапки) даёт шапке быть видимой в начале скролла.
                  onScroll (native driver) двигает headerTranslateY/headerOpacity выше. */}
              <Animated.ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingTop: headerHeight - insets.top, flexGrow: 1 }}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                  { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={[c.brand.primary]}
                    tintColor={c.brand.primary}
                    progressBackgroundColor={c.surface.input}
                    progressViewOffset={56 + headerHeight - insets.top}
                  />
                }
              >
                <View style={{
                  flexGrow: 1,
                  backgroundColor: c.surface.input,
                  borderTopLeftRadius: 32,
                  borderTopRightRadius: 32,
                  padding: 16,
                  paddingBottom: insets.bottom + 96,
                  gap: 12,
                  ...sheetShadow,
                }}>
                  {visibleHabits.map(item => (
                    <HabitCard
                      key={item.id}
                      habit={item}
                      extra={extras[item.id] ?? null}
                      onPress={() => openHabit(item.id)}
                    />
                  ))}
                </View>
              </Animated.ScrollView>
            </>
          )}

          {!loading && toolbar}
        </>
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
