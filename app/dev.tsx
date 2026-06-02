import { ScrollView, View } from 'react-native';
import Text from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import Button from '@/components/Button';
import Input from '@/components/Input';
import SegmentedControl from '@/components/SegmentedControl';
import Select from '@/components/Select';
import Lists from '@/components/Lists';
import Calendar from '@/components/Calendar';
import NavigationBar from '@/components/NavigationBar';
import Card from '@/components/Card';
import HabitTag from '@/components/HabitTag';
import DropdownMenu from '@/components/DropdownMenu';
import Fab from '@/components/Fab';
import LogoutIcon from '@/assets/icons/Logout.svg';
import ShareIcon from '@/assets/icons/Share.svg';
import GroupPlusIcon from '@/assets/icons/GroupPlus.svg';
import MoreVerticalIcon from '@/assets/icons/MoreVertical.svg';
import { useState } from 'react';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import MailIcon from '@/assets/icons/Mail.svg';
import PinIcon from '@/assets/icons/Pin.svg';
import TelegramIcon from '@/assets/icons/Telegram.svg';
import UserIcon from '@/assets/icons/User.svg';
import SettingsIcon from '@/assets/icons/Settings.svg';
import InfoCircleIcon from '@/assets/icons/InfoCircle.svg';

if (!__DEV__) {
  // В проде роут недоступен
  function ProdRedirect() { return <Redirect href="/" />; }
  module.exports = ProdRedirect;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 32 }}>
      <Text weight="bold" style={{ fontSize: 12, color: c.text.secondary, letterSpacing: 0.2, textTransform: 'uppercase', marginBottom: 16 }}>
        {title}
      </Text>
      <View style={{ gap: 12 }}>
        {children}
      </View>
    </View>
  );
}

function Label({ text }: { text: string }) {
  const c = useColors();
  return (
    <Text style={{ fontSize: 12, color: c.text.placeholder, marginBottom: 4 }}>
      {text}
    </Text>
  );
}

export default function DevScreen() {
  const c = useColors();
  const { colorScheme } = useSettings();
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const [theme, setTheme] = useState('system');
  const [toggle2, setToggle2] = useState('on');
  const [selectValue, setSelectValue] = useState('');

  const screenBg = colorScheme === 'dark' ? colors.neutral[950] : colors.neutral[100];
  const borderColor = colorScheme === 'dark' ? colors.neutral[800] : colors.neutral[200];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
      <View style={{ height: 56, paddingHorizontal: 24, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: borderColor }}>
        <Text weight="bold" style={{ fontSize: 18, color: c.text.primary }}>
          🧩 Component Gallery
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>

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

        {/* BUTTON — SECONDARY */}
        <Section title="Button / Secondary">
          <Label text="Default" />
          <Button variant="secondary" label="Изменить шаги" onPress={() => {}} />

          <Label text="Default + icon" />
          <Button
            variant="secondary"
            label="Вступить в группу"
            onPress={() => {}}
            icon={<GroupPlusIcon width={20} height={20} color={colors.purple[500]} />}
          />

          <Label text="Loading" />
          <Button variant="secondary" label="Изменить шаги" onPress={() => {}} loading />

          <Label text="Disabled" />
          <Button variant="secondary" label="Изменить шаги" onPress={() => {}} disabled />
        </Section>

        {/* ПРОФИЛЬ */}
        <Section title="Компоненты в профиле">
          <Label text="Segmented — 3 варианта (тема)" />
          <SegmentedControl
            label="Тема"
            options={[
              { label: 'Системная', value: 'system' },
              { label: 'Светлая', value: 'light' },
              { label: 'Темная', value: 'dark' },
            ]}
            value={theme}
            onChange={setTheme}
          />

          <Label text="Segmented — 2 варианта (вкл/выкл)" />
          <SegmentedControl
            label="Уведомления"
            options={[
              { label: 'Включить', value: 'on' },
              { label: 'Выключить', value: 'off' },
            ]}
            value={toggle2}
            onChange={setToggle2}
          />

          <Label text="Select — Default (интерактивный)" />
          <Select
            label="Язык"
            placeholder="Выберите язык"
            options={[
              { label: 'Русский', value: 'ru' },
              { label: 'English', value: 'en' },
              { label: 'Español', value: 'es' },
            ]}
            value={selectValue}
            onChange={setSelectValue}
          />

          <Label text="Select — Error" />
          <Select
            label="Язык"
            placeholder="Выберите язык"
            options={[{ label: 'Русский', value: 'ru' }]}
            value=""
            onChange={() => {}}
            error="Выберите язык из списка"
          />

          <Label text="Select — Disabled" />
          <Select
            label="Язык"
            options={[{ label: 'Русский', value: 'ru' }]}
            value="ru"
            onChange={() => {}}
            disabled
          />

          <Label text="Segmented — Disabled" />
          <SegmentedControl
            label="Недоступно"
            options={[
              { label: 'Включить', value: 'on' },
              { label: 'Выключить', value: 'off' },
            ]}
            value="on"
            onChange={() => {}}
            disabled
          />
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

        {/* LISTS */}
        <Section title="Lists">
          <Label text="С иконками (стиль профиля)" />
          <Lists
            items={[
              { label: 'Настройки профиля', icon: <UserIcon width={24} height={24} color={c.text.secondary} />, onPress: () => {} },
              { label: 'Настройки приложения', icon: <SettingsIcon width={24} height={24} color={c.text.secondary} />, onPress: () => {} },
              { label: 'О приложении', icon: <InfoCircleIcon width={24} height={24} color={c.text.secondary} />, onPress: () => {} },
            ]}
            cardStyle={{ gap: 16 }}
          />

          <Label text="Без иконок (стиль О приложении)" />
          <Lists
            items={[
              { label: 'Политика конфиденциальности', onPress: () => {} },
              { label: 'Пользовательское соглашение', onPress: () => {} },
              { label: 'Согласие на обработку данных', onPress: () => {} },
            ]}
            cardStyle={{ gap: 16 }}
          />
        </Section>

        {/* CALENDAR */}
        <Section title="Calendar">
          <Label text="7 дней (check / miss / current / future)" />
          <Calendar
            days={[
              { day: 18, status: 'check' },
              { day: 19, status: 'miss' },
              { day: 20, status: 'check' },
              { day: 21, status: 'check' },
              { day: 22, status: 'current' },
              { day: 23, status: 'future' },
              { day: 24, status: 'future' },
            ]}
          />
        </Section>

        {/* NAVIGATION BAR */}
        <Section title="Navigation Bar">
          <Label text="Только заголовок" />
          <NavigationBar title="Заголовок" />

          <Label text="С кнопкой назад" />
          <NavigationBar title="Заголовок" onBack={() => {}} />

          <Label text="С кнопкой назад и действием справа" />
          <NavigationBar
            title="Заголовок"
            onBack={() => {}}
            right={<MoreVerticalIcon width={24} height={24} color={c.text.primary} />}
          />
        </Section>

        {/* HABIT TAG */}
        <Section title="HabitTag">
          <Label text="Групповая (violet)" />
          <HabitTag type="group" />

          <Label text="Одиночная (yellow)" />
          <HabitTag type="solo" />
        </Section>

        {/* FAB */}
        <Section title="FAB">
          <Label text="Нажми — раскроется меню с затемнением" />
          <View style={{ alignItems: 'flex-end' }}>
            <Fab
              items={[
                { label: 'Создать цель', icon: <UserIcon width={24} height={24} color={c.text.secondary} />, onPress: () => {} },
                { label: 'Создать групповую цель', icon: <GroupPlusIcon width={24} height={24} color={c.text.secondary} />, onPress: () => {} },
                { label: 'Вступить в группу по коду', icon: <ShareIcon width={24} height={24} color={c.text.secondary} />, onPress: () => {} },
              ]}
            />
          </View>
        </Section>

        {/* DROPDOWN MENU */}
        <Section title="Dropdown Menu">
          <Label text="Обычные пункты" />
          <DropdownMenu
            items={[
              { label: 'Передать права', icon: <UserIcon width={24} height={24} color={c.text.secondary} />, onPress: () => {} },
              { label: 'Пригласить', icon: <ShareIcon width={24} height={24} color={c.text.secondary} />, onPress: () => {} },
            ]}
          />

          <Label text="С деструктивным пунктом" />
          <DropdownMenu
            items={[
              { label: 'Передать права', icon: <UserIcon width={24} height={24} color={c.text.secondary} />, onPress: () => {} },
              { label: 'Выйти из привычки', icon: <LogoutIcon width={24} height={24} color={colors.red[500]} />, onPress: () => {}, destructive: true },
            ]}
          />
        </Section>

        {/* CARD */}
        <Section title="Card">
          <Label text="Базовая карточка" />
          <Card>
            <Text weight="semibold" style={{ fontSize: 16, color: c.text.primary }}>
              Заголовок карточки
            </Text>
            <Text style={{ fontSize: 14, color: c.text.secondary }}>
              Содержимое карточки — любые дочерние элементы
            </Text>
          </Card>

          <Label text="Две карточки в ряд (стрики)" />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Card style={{ flex: 1, gap: 4 }}>
              <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary }}>
                Текущий стрик
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: c.text.primary }}>
                7
              </Text>
            </Card>
            <Card style={{ flex: 1, gap: 4 }}>
              <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary }}>
                Лучший стрик
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: c.text.primary }}>
                21
              </Text>
            </Card>
          </View>
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}
