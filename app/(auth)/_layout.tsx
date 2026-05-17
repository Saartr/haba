import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="enter-username" />
      <Stack.Screen name="verify-code" />
      <Stack.Screen name="success" />
    </Stack>
  );
}
