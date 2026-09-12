import React, {
  createContext,
  useContext,
  useState,
} from 'react';

interface PeraWalletContextValue {
  address: string | null;
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<string>;
  disconnect: () => Promise<void>;
}

const PeraWalletContext =
  createContext<PeraWalletContextValue | null>(null);

export function PeraWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Temporarily disabled for diagnosis.
  // Pera Wallet will NOT reconnect automatically
  // when the app starts.
  const [isLoading] = useState(false);

  const connect = async (): Promise<string> => {
    const {
      connectPeraWallet,
    } = await import('../services/wallet/peraWallet');

    const walletAddress = await connectPeraWallet();

    setAddress(walletAddress);
    setIsConnected(true);

    return walletAddress;
  };

  const disconnect = async (): Promise<void> => {
    const {
      disconnectPeraWallet,
    } = await import('../services/wallet/peraWallet');

    await disconnectPeraWallet();

    setAddress(null);
    setIsConnected(false);
  };

  return (
    <PeraWalletContext.Provider
      value={{
        address,
        isConnected,
        isLoading,
        connect,
        disconnect,
      }}
    >
      {children}
    </PeraWalletContext.Provider>
  );
}

export function usePeraWallet() {
  const context = useContext(PeraWalletContext);

  if (!context) {
    throw new Error(
      'usePeraWallet must be used inside PeraWalletProvider'
    );
  }

  return context;
}
