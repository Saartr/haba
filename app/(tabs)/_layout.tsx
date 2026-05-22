import { Stack } from 'expo-router';

export default function TabLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="two" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="create-habit" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="habit/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile-settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="app-settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="about-app" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="legal/[type]" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
