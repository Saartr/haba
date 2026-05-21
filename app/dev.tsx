import { ScrollView, View } from 'react-native';
import Text from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { useState } from 'react';
import { colors } from '@/lib/colors';
import MailIcon from '@/assets/icons/Mail.svg';
import PinIcon from '@/assets/icons/Pin.svg';
import TelegramIcon from '@/assets/icons/Telegram.svg';

if (!__DEV__) {
  // В проде роут недоступен
  function ProdRedirect() { return <Redirect href="/" />; }
  module.exports = ProdRedirect;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-8">
      <Text weight="bold" className="text-body-12 text-neutral-500 tracking-default uppercase mb-4">
        {title}
      </Text>
      <View className="gap-3">
        {children}
      </View>
    </View>
  );
}

function Label({ text }: { text: string }) {
  return (
    <Text className="text-body-12 text-neutral-400 mb-1">
      {text}
    </Text>
  );
}

export default function DevScreen() {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');

  return (
    <SafeAreaView className="flex-1 bg-neutral-100">
      <View className="h-14 px-6 justify-center border-b border-neutral-200">
        <Text weight="bold" className="text-h4 text-neutral-900">
          🧩 Component Gallery
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>

        {/* BUTTON — MAIN */}
        <Section title="Button / Main">
          <Label text="Default" />
          <Button label="Отправить код" onPress={() => {}} />

          <Label text="Default + icon" />
          <Button
            label="Войти через Telegram"
            onPress={() => {}}
            icon={<TelegramIcon width={20} height={20} color={colors.neutral[0]} />}
          />

          <Label text="Loading" />
          <Button label="Отправить код" onPress={() => {}} loading />

          <Label text="Disabled" />
          <Button label="Отправить код" onPress={() => {}} disabled />
        </Section>

        {/* BUTTON — TEXT */}
        <Section title="Button / Text">
          <Label text="Default" />
          <Button variant="text" label="Изменить данные для входа" onPress={() => {}} />

          <Label text="Loading" />
          <Button variant="text" label="Изменить данные для входа" onPress={() => {}} loading />

          <Label text="Disabled" />
          <Button variant="text" label="Изменить данные для входа" onPress={() => {}} disabled />
        </Section>

        {/* INPUT */}
        <Section title="Input">
          <Label text="Default (без иконки)" />
          <Input
            label="Код"
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="Введите код"
          />

          <Label text="Default + иконка" />
          <Input
            label="Логин Telegram"
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="username"
            icon={<MailIcon width={24} height={24} color={colors.neutral[500]} />}
          />

          <Label text="Error" />
          <Input
            label="Логин Telegram"
            value="wronguser"
            onChangeText={() => {}}
            icon={<MailIcon width={24} height={24} color={colors.error} />}
            error="Пользователь не найден"
          />

          <Label text="Disabled" />
          <Input
            label="Логин Telegram"
            value="username"
            onChangeText={() => {}}
            icon={<MailIcon width={24} height={24} color={colors.neutral[500]} />}
            disabled
          />

          <Label text="Интерактивный (toggle error)" />
          <Input
            label="Код"
            value={inputValue}
            onChangeText={(t) => { setInputValue(t); setInputError(''); }}
            placeholder="Введите код"
            icon={<PinIcon width={24} height={24} color={inputError ? colors.error : colors.neutral[500]} />}
            error={inputError}
          />
          <Button
            label={inputError ? 'Сбросить ошибку' : 'Показать ошибку'}
            onPress={() => setInputError(inputError ? '' : 'Неверный код')}
          />
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}
