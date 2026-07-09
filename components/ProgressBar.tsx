import { View, Animated, ViewStyle } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useColors, colors } from '@/lib/colors';

// Из Figma (TapaDS, node 400-134): в состоянии Progress закрашенные блоки объединены
// в одну фигуру с линейным градиентом purple[100]→purple[400], но т.к. блоки не соприкасаются
// (2px зазор), каждый блок фактически получает свой сплошной цвет — значение градиента
// в точке своего центра. Переход из светлого в тёмный фиолетовый укладывается в первые ~36.8%
// ширины закрашенного участка (gradientHandlePositions[1].x = 0.368...), дальше — сплошной purple[400].
const TRANSITION_FRACTION = 0.368;
const ANIM_DURATION = 280;

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixHex(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function computeBlockColor(index: number, value: number, total: number, emptyColor: string): string {
  if (total > 0 && value >= total) return colors.green[500];
  if (index >= value) return emptyColor;
  const t = value > 0 ? Math.min(index / (value * TRANSITION_FRACTION), 1) : 0;
  return mixHex(colors.purple[100], colors.purple[400], t);
}

// Кроссфейд через opacity вместо Animated.interpolate по цвету — интерполяция цветовых строк
// в RN ненадёжна на смешанных форматах (hex/rgb), а opacity анимируется нативным драйвером стабильно.
function Block({ color }: { color: string }) {
  const [baseColor, setBaseColor] = useState(color);
  const [incomingColor, setIncomingColor] = useState<string | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (color === baseColor) return;
    setIncomingColor(color);
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: true }).start(({ finished }) => {
      if (finished) {
        setBaseColor(color);
        setIncomingColor(null);
      }
    });
  }, [color]);

  return (
    <View style={{ flex: 1, height: 8, borderRadius: 2, overflow: 'hidden', backgroundColor: baseColor }}>
      {incomingColor != null && (
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: incomingColor, opacity }} />
      )}
    </View>
  );
}

export type ProgressBarProps = {
  /** Общее количество блоков. */
  total: number;
  /** Сколько блоков закрашено. 0 — Empty, >= total — Success, иначе — Progress. */
  value: number;
  style?: ViewStyle;
};

export default function ProgressBar({ total, value, style }: ProgressBarProps) {
  const c = useColors();
  const clamped = Math.max(0, Math.min(value, total));

  return (
    <View style={[{
      flexDirection: 'row',
      gap: 2,
      padding: 2,
      borderRadius: 4,
      backgroundColor: c.surface.input,
    }, style]}>
      {Array.from({ length: total }, (_, i) => (
        <Block key={i} color={computeBlockColor(i, clamped, total, c.surface.cardGrey)} />
      ))}
    </View>
  );
}
