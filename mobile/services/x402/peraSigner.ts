import { PeraWalletConnect } from '@perawallet/connect';
import { decodeUnsignedTransaction } from 'algosdk';
import type { ClientAvmSigner } from '../x402';

export function createPeraAvmSigner(
  pera: PeraWalletConnect,
  address: string
): ClientAvmSigner {
  return {
    address,

    async signTransactions(
      txns: Uint8Array[],
      indexesToSign?: number[]
    ): Promise<(Uint8Array | null)[]> {
      if (!pera.isConnected) {
        throw new Error('Pera Wallet is not connected');
      }

      const indexes =
        indexesToSign ??
        txns.map((_, index) => index);

      const signerTransactions = txns.map(
        (txnBytes, index) => ({
          txn: decodeUnsignedTransaction(txnBytes),
          signers: indexes.includes(index)
            ? [address]
            : [],
        })
      );

      const signed = await pera.signTransaction(
        [signerTransactions],
        address
      );

      let signedIndex = 0;

      return txns.map((_, index) => {
        if (!indexes.includes(index)) {
          return null;
        }

        const signedTxn = signed[signedIndex++];

        return signedTxn ?? null;
      });
    },
  };
}
