import { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Text from '@/components/Text';
import DropdownPopover from '@/components/DropdownPopover';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { LEGAL_CONTENT, LegalLang } from '@/lib/legal-content';
import ArrowBackIcon from '@/assets/icons/ArrowBack.svg';
import LanguageIcon from '@/assets/icons/Language.svg';
import CheckIcon from '@/assets/icons/Check.svg';

export default function LegalScreen() {
  const c = useColors();
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: string }>();
  const { colorScheme } = useSettings();

  const [lang, setLang] = useState<LegalLang>('ru');
  const [langMenu, setLangMenu] = useState(false);

  const content = LEGAL_CONTENT[type ?? '']?.[lang];
  const screenBg = colorScheme === 'dark' ? colors.neutral[950] : colors.neutral[50];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['top']}>
      {/* Navigation bar */}
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          {({ pressed }) => (
            <View style={{ padding: 4, opacity: pressed ? 0.6 : 1 }}>
              <ArrowBackIcon width={24} height={24} color={c.text.primary} />
            </View>
          )}
        </Pressable>
        <Text weight="semibold" numberOfLines={1} style={{
          flex: 1, textAlign: 'center',
          fontSize: 16, color: c.text.primary, letterSpacing: 0.2,
        }}>
          {content?.title ?? ''}
        </Text>
        <Pressable onPress={() => setLangMenu(true)} hitSlop={8}>
          {({ pressed }) => (
            <View style={{ padding: 4, opacity: pressed ? 0.6 : 1 }}>
              <LanguageIcon width={24} height={24} color={c.text.primary} />
            </View>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 }}
      >
        <Text weight="semibold" style={{
          fontSize: 16,
          color: c.text.primary,
          letterSpacing: 0.2,
          lineHeight: 25.6,
        }}>
          {content?.body ?? ''}
        </Text>
      </ScrollView>

      {/* Переключатель языка */}
      <DropdownPopover
        visible={langMenu}
        onClose={() => setLangMenu(false)}
        items={[
          {
            label: 'Русский',
            icon: lang === 'ru' ? () => <CheckIcon width={24} height={24} color={c.text.secondary} /> : undefined,
            onPress: () => setLang('ru'),
          },
          {
            label: 'English',
            icon: lang === 'en' ? () => <CheckIcon width={24} height={24} color={c.text.secondary} /> : undefined,
            onPress: () => setLang('en'),
          },
        ]}
      />
    </SafeAreaView>
  );
}
