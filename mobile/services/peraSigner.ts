import type { ClientAvmSigner } from './x402';

export function createPeraSigner(
  address: string,
  signTransactions: (
    txnGroups: Uint8Array[][]
  ) => Promise<(Uint8Array | null)[][]>
): ClientAvmSigner {
  return {
    address,

    async signTransactions(
      txns: Uint8Array[],
      indexesToSign?: number[]
    ): Promise<(Uint8Array | null)[]> {
      const indexes =
        indexesToSign ?? txns.map((_, index) => index);

      const group = txns.map((txn, index) =>
        indexes.includes(index)
          ? txn
          : new Uint8Array()
      );

      const signedGroups = await signTransactions([group]);

      const signed = signedGroups[0];

      return txns.map((_, index) => {
        if (!indexes.includes(index)) {
          return null;
        }

        return signed?.[index] ?? null;
      });
    },
  };
}
