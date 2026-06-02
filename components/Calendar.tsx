import { View } from 'react-native';
import Text from '@/components/Text';
import CheckCircleIcon from '@/assets/icons/CheckCircle.svg';
import DoNotDisturbIcon from '@/assets/icons/DoNotDisturb.svg';
import CircleOutlineIcon from '@/assets/icons/Circle.svg';
import { useSettings } from '@/lib/settings-context';
import { colors } from '@/lib/colors';

export type DayStatus = 'check' | 'miss' | 'current' | 'future';

export type CalendarDay = {
  day: number;
  status: DayStatus;
};

type ColorConfig = { bg: string; color: string };

const LIGHT: Record<DayStatus, ColorConfig> = {
  check:   { bg: '#BBF7D0', color: colors.green[500] },
  miss:    { bg: '#FBBFBB', color: colors.red[500] },
  current: { bg: colors.neutral[100], color: colors.primary },
  future:  { bg: colors.neutral[100], color: colors.neutral[500] },
};

const DARK: Record<DayStatus, ColorConfig> = {
  check:   { bg: colors.green[800], color: colors.green[500] },
  miss:    { bg: colors.red[800], color: colors.red[400] },
  current: { bg: colors.neutral[800], color: colors.purple[400] },
  future:  { bg: colors.neutral[800], color: colors.neutral[500] },
};

function DayIcon({ status, color }: { status: DayStatus; color: string }) {
  if (status === 'check') return <CheckCircleIcon width={28} height={28} color={color} />;
  if (status === 'miss')  return <DoNotDisturbIcon width={28} height={28} color={color} />;
  return <CircleOutlineIcon width={28} height={28} color={color} />;
}

function DayCell({ day, status }: CalendarDay) {
  const { colorScheme } = useSettings();
  const { bg, color } = (colorScheme === 'dark' ? DARK : LIGHT)[status];

  return (
    <View style={{
      flex: 1,
      alignItems: 'center',
      gap: 4,
      padding: 8,
      borderRadius: 8,
      backgroundColor: bg,
    }}>
      <Text weight="bold" style={{ fontSize: 14, lineHeight: 20, color }}>
        {day}
      </Text>
      <DayIcon status={status} color={color} />
    </View>
  );
}

type Props = {
  days: CalendarDay[];
};

export default function Calendar({ days }: Props) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {days.map((d) => (
        <DayCell key={d.day} {...d} />
      ))}
    </View>
  );
}
