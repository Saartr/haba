import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Text from '@/components/Text';
import Button from '@/components/Button';
import TapaFace from '@/assets/images/tapa_face.svg';
import { useColors } from '@/lib/colors';

type Action = {
  label: string;
  onPress: () => void;
  variant?: 'main' | 'text' | 'secondary';
  icon?: React.ReactNode;
};

type Props = {
  message: string;
  actions: Action[];
};

export default function ErrorScreen({ message, actions }: Props) {
  const c = useColors();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.bg }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 32 }}>
        <TapaFace width={179} height={170} />
        <Text weight="semibold" style={{ fontSize: 16, lineHeight: 16 * 1.6, color: c.text.secondary, textAlign: 'center', letterSpacing: 0.2 }}>
          {message}
        </Text>
        <View style={{ width: '100%', gap: 16 }}>
          {actions.map((action, i) => (
            <Button
              key={i}
              label={action.label}
              onPress={action.onPress}
              variant={action.variant ?? 'main'}
              icon={action.icon}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
