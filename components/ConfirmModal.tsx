import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { View } from 'react-native';
import Text from '@/components/Text';
import Button from '@/components/Button';
import BottomSheet from '@/components/BottomSheet';
import CheckIcon from '@/assets/icons/Check.svg';
import { useColors } from '@/lib/colors';

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Render-функция иконки. По умолчанию — галочка (Check). */
  confirmIcon?: () => React.ReactNode;
  /** Красная кнопка для деструктивных действий (удаление, выход). */
  destructive?: boolean;
};

type Resolver = (confirmed: boolean) => void;

const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false),
);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<Resolver | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    setOpen(false);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const confirmColor = opts?.destructive ? c.semantic.error : c.brand.primary;
  const renderIcon = opts?.confirmIcon ?? (() => <CheckIcon width={24} height={24} color={c.icon.onPrimary} />);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <BottomSheet visible={open} title={opts?.title ?? ''} onClose={() => settle(false)}>
        <View style={{ gap: 16 }}>
          {opts?.description ? (
            <Text weight="bold" style={{ fontSize: 16, lineHeight: 16 * 1.6, color: c.text.secondary, letterSpacing: 0.2 }}>
              {opts.description}
            </Text>
          ) : null}
          <Button
            label={opts?.confirmLabel ?? 'Подтвердить'}
            icon={renderIcon()}
            onPress={() => settle(true)}
            color={confirmColor}
          />
        </View>
      </BottomSheet>
    </ConfirmContext.Provider>
  );
}
