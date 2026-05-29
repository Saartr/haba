import { NativeModules, Platform } from 'react-native';

interface VkAuthResult {
  accessToken: string;
  userId: string;
  expiresIn: number;
}

const { VkIdModule } = NativeModules;

export function signInWithVK(): Promise<VkAuthResult> {
  if (Platform.OS !== 'android') {
    return Promise.reject(new Error('VK ID is only supported on Android'));
  }
  if (!VkIdModule) {
    return Promise.reject(new Error('VkIdModule is not available'));
  }
  return VkIdModule.signIn();
}
