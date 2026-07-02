import { View, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useColors } from '@/lib/colors';

type Props = {
  size?: number;
  color?: string;
};

export default function RippleLoader({ size = 48, color }: Props) {
  const c = useColors();
  const rippleColor = color ?? c.brand.primary;

  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const makeLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.timing(val, {
          toValue: 1,
          duration: 2000,
          delay,
          useNativeDriver: true,
        }),
      );

    const l1 = makeLoop(anim1, 0);
    const l2 = makeLoop(anim2, 1000);
    l1.start();
    l2.start();
    return () => { l1.stop(); l2.stop(); };
  }, []);

  const circle = (val: Animated.Value) => ({
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: rippleColor,
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ scale: val }],
  });

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={circle(anim1)} />
      <Animated.View style={circle(anim2)} />
    </View>
  );
}
