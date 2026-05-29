import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

interface VkAuthResult {
  accessToken: string;
  userId: string;
  expiresIn: number;
  firstName: string;
  lastName: string;
  photo200: string;
  email: string;
}

const VkIdModule = requireOptionalNativeModule('VkIdModule');

export function signInWithVK(): Promise<VkAuthResult> {
  if (Platform.OS !== 'android') {
    return Promise.reject(new Error('VK ID is only supported on Android'));
  }
  if (!VkIdModule) {
    return Promise.reject(new Error('VkIdModule is not available'));
  }
  return VkIdModule.signIn();
}
