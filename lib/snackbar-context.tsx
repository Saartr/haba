import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Snackbar, { SnackbarType } from '@/components/Snackbar';

type ShowFn = (text: string, type?: SnackbarType) => void;

const SnackbarContext = createContext<ShowFn>(() => {});

export function useSnackbar() {
  return useContext(SnackbarContext);
}

const VISIBLE_MS = 3000;

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<{ text: string; type: SnackbarType } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setState(null);
    });
  }, [anim]);

  const show = useCallback<ShowFn>((text, type = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setState({ text, type });
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timer.current = setTimeout(hide, VISIBLE_MS);
  }, [anim, hide]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <SnackbarContext.Provider value={show}>
      {children}
      {state && (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: insets.bottom + 24,
            paddingHorizontal: 32,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          <Snackbar text={state.text} type={state.type} onClose={hide} />
        </Animated.View>
      )}
    </SnackbarContext.Provider>
  );
}
