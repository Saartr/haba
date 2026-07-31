import { View, Image, Pressable } from 'react-native';
import Text from '@/components/Text';
import Button from '@/components/Button';
import BottomSheet from '@/components/BottomSheet';
import BlockIcon from '@/assets/icons/Block.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { HabitMember } from '@/lib/api';
import { formatUnit } from '@/lib/units';

// Общие кусочки экранов цели (habit/[id].tsx → components/habit-screens/*):
// модалка успеха, заголовок раздела, аватар/строка участника, форматирование дат.

export const CHECK_IN_LABELS: Record<string, [string, string]> = {
  smoking:    ['Не курил', 'Курил'],
  'no-smoking': ['Не курил', 'Курил'],
};

export const INTENSITY_LABEL: Record<string, string> = { low: 'низкой', medium: 'средней', high: 'высокой' };

const MONTHS_RU_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function formatDateRu(iso: string, todayIso: string): string {
  if (iso === todayIso) return 'Сегодня';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_RU_GEN[m - 1]}`;
}

export function formatDateDots(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${min}`;
}

// Локальный (не UTC) ISO-формат — new Date().toISOString() сдвигает дату у пользователей
// восточнее UTC (например, Москва), т.к. local-полночь конвертируется в предыдущий день UTC.
export function dateToLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isTrainingDayDate(iso: string, trainingDays: number[] | null): boolean {
  if (!trainingDays) return false;
  const dow = new Date(iso + 'T00:00:00').getDay(); // 0=Вс..6=Сб
  const isoDay = dow === 0 ? 7 : dow; // 1=Пн..7=Вс
  return trainingDays.includes(isoDay);
}

export function isRestDay(iso: string, periodicity: string, weekdays: number[] | null): boolean {
  if (periodicity !== 'weekdays' || !weekdays || weekdays.length === 0) return false;
  const dow = new Date(iso + 'T00:00:00').getDay(); // 0=Вс..6=Сб
  const isoDay = dow === 0 ? 7 : dow; // 1=Пн..7=Вс
  return !weekdays.includes(isoDay);
}

export function SuccessModal({ visible, onClose, onNewGoal }: { visible: boolean; onClose: () => void; onNewGoal: () => void }) {
  const c = useColors();
  return (
    <BottomSheet title="Успех!" visible={visible} onClose={onClose}>
      <View style={{ gap: 16 }}>
        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          <Image source={require('@/assets/images/tapa_success.png')} style={{ width: 223, height: 263 }} resizeMode="contain" />
        </View>
        <Text weight="bold" style={{ fontSize: 16, color: c.text.secondary, letterSpacing: 0.2, lineHeight: 16 * 1.6 }}>
          Поздравляем! Ты достиг поставленной цели, так держать, не останавливайся на достигнутом.
        </Text>
        <Button label="Новая цель" onPress={onNewGoal} />
      </View>
    </BottomSheet>
  );
}

// Заголовок раздела («Персональный результат», «Все участники») — 16px semibold
export function SectionTitle({ children }: { children: string }) {
  const c = useColors();
  return (
    <Text weight="semibold" style={{ fontSize: 16, lineHeight: 26, color: c.text.primary, paddingHorizontal: 24, letterSpacing: 0.2 }}>
      {children}
    </Text>
  );
}

// Аватар участника: фото или инициал имени
export function MemberAvatar({ member }: { member: HabitMember }) {
  const name = member.first_name ?? member.username ?? '?';
  const initial = name[0].toUpperCase();
  if (member.avatar_url) {
    return (
      <Image source={{ uri: member.avatar_url }}
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

export function MemberRow({
  member, goalValue, value, unit, boolean, isCreator, onExclude, onOpen,
}: {
  member: HabitMember;
  goalValue: number | null;
  value: number | null;
  /** Единица измерения — для count «без цели» показываем «N единиц» (например «5 стаканов»). */
  unit?: string | null;
  /** Да/Нет-режим — показываем «Выполнил»/«Не выполнил» вместо числа. */
  boolean?: boolean;
  isCreator: boolean;
  onExclude: (id: number) => void;
  onOpen: (member: HabitMember) => void;
}) {
  const c = useColors();
  const { colorScheme } = useSettings();
  const rippleColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const name = member.first_name ?? member.username ?? '?';
  const displayName = member.is_self ? `${name} (Я)` : name;

  const stepsLabel = boolean
    ? ((value ?? 0) >= 1 ? 'Выполнил' : 'Не выполнил')
    : goalValue != null
    ? `${(value ?? 0).toLocaleString('ru-RU')} / ${goalValue.toLocaleString('ru-RU')}`
    : unit !== undefined
    ? formatUnit(value ?? 0, unit)
    : value != null ? String(value) : '—';

  return (
    <Pressable
      onPress={() => onOpen(member)}
      style={({ pressed }) => ({
        paddingVertical: 4,
        borderRadius: 16,
        backgroundColor: pressed ? rippleColor : 'transparent',
      })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <MemberAvatar member={member} />
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
      </Pressable>
  );
}
