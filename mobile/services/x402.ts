import { x402Client, x402HTTPClient } from '@x402/core/client';
import { ExactAvmScheme } from '@x402/avm/exact/client';

export interface ClientAvmSigner {
  address: string;

  signTransactions(
    txns: Uint8Array[],
    indexesToSign?: number[]
  ): Promise<(Uint8Array | null)[]>;
}

export const ALGORAND_TESTNET_CAIP2 =
  'algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=';

export function createX402Client(
  signer: ClientAvmSigner
) {
  const client = new x402Client();

  client.register(
    ALGORAND_TESTNET_CAIP2,
    new ExactAvmScheme(signer)
  );

  return new x402HTTPClient(client);
}
