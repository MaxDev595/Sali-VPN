import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'sali.auth.token';
export const secureStorage = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clearToken: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
