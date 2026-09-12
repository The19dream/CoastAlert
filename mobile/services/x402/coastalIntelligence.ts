import { createX402Client } from '../x402';
import { createPeraAvmSigner } from './peraSigner';
import {
  getPeraWallet,
  isPeraWalletConnected,
} from '../wallet/peraWallet';

export interface CoastalIntelligenceResponse {
  reply?: string;
  answer?: string;
  message?: string;
  [key: string]: unknown;
}

export async function getCoastalIntelligence(
  location: string,
  address: string
): Promise<CoastalIntelligenceResponse> {
  if (!isPeraWalletConnected()) {
    throw new Error('Please connect your Pera Wallet first.');
  }

  if (!address) {
    throw new Error('No Pera Wallet address was provided.');
  }

  const wallet = await getPeraWallet();

  const signer = createPeraAvmSigner(
    wallet,
    address
  );

  const x402 = createX402Client(signer);

  const url =
    `https://coastalert.onrender.com/api/agent/coastal-intelligence/` +
    encodeURIComponent(location);

  const initialResponse = await fetch(url);

  if (initialResponse.status !== 402) {
    if (!initialResponse.ok) {
      const text = await initialResponse.text();

      throw new Error(
        `Coastal Intelligence request failed (${initialResponse.status}): ${text}`
      );
    }

    return (await initialResponse.json()) as CoastalIntelligenceResponse;
  }

  const paymentRequired = x402.getPaymentRequiredResponse(
    (name) => initialResponse.headers.get(name),
    await initialResponse
      .clone()
      .json()
      .catch(() => undefined)
  );

  const paymentPayload =
    await x402.createPaymentPayload(paymentRequired);

  const paymentHeaders =
    x402.encodePaymentSignatureHeader(paymentPayload);

  const paidResponse = await fetch(url, {
    method: 'GET',
    headers: paymentHeaders,
  });

  await x402.processPaymentResult(
    paymentPayload,
    (name) => paidResponse.headers.get(name),
    paidResponse.status
  );

  if (!paidResponse.ok) {
    const text = await paidResponse.text();

    throw new Error(
      `Paid Coastal Intelligence request failed (${paidResponse.status}): ${text}`
    );
  }

  return (await paidResponse.json()) as CoastalIntelligenceResponse;
}
