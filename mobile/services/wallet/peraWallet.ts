import { Platform } from 'react-native';

type PeraWallet = import('@perawallet/connect').PeraWalletConnect;

let peraWallet: PeraWallet | null = null;

export async function getPeraWallet(): Promise<PeraWallet> {
  if (Platform.OS === 'web') {
    throw new Error('Pera Wallet is only available on Android and iOS.');
  }

  if (!peraWallet) {
    const { PeraWalletConnect } = await import('@perawallet/connect');
    peraWallet = new PeraWalletConnect();
  }

  return peraWallet;
}

export async function connectPeraWallet(): Promise<string> {
  const wallet = await getPeraWallet();

  const accounts = await wallet.connect();

  if (!accounts || accounts.length === 0) {
    throw new Error('No Pera Wallet account returned.');
  }

  return accounts[0];
}

export async function reconnectPeraWallet(): Promise<string | null> {
  // Do not initialize Pera Wallet during app startup.
  // Pera will be initialized only when the user explicitly connects.
  return null;
}

export async function disconnectPeraWallet(): Promise<void> {
  if (!peraWallet) {
    return;
  }

  if (peraWallet.isConnected) {
    await peraWallet.disconnect();
  }
}

export function isPeraWalletConnected(): boolean {
  return peraWallet?.isConnected ?? false;
}

export async function getPeraWalletInstance(): Promise<PeraWallet> {
  return getPeraWallet();
}
