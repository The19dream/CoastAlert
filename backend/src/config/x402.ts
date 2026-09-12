import dotenv from "dotenv";

dotenv.config();

import { ExactAvmScheme } from "@x402/avm/exact/server";
import {
  HTTPFacilitatorClient,
  x402ResourceServer,
} from "@x402/core/server";

const ALGORAND_TESTNET_CAIP2 =
  "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";

const facilitatorUrl =
  process.env.X402_FACILITATOR_URL ||
  "https://facilitator.goplausible.xyz";

const payTo = process.env.X402_PAY_TO;

if (!payTo) {
  throw new Error("X402_PAY_TO is not configured");
}

const facilitatorClient = new HTTPFacilitatorClient({
  url: facilitatorUrl,
});

export const x402Server = new x402ResourceServer(facilitatorClient).register(
  ALGORAND_TESTNET_CAIP2,
  new ExactAvmScheme()
);

export const x402Routes = {
  "GET /api/agent/coastal-intelligence/*": {
    accepts: {
      scheme: "exact" as const,
      network: ALGORAND_TESTNET_CAIP2 as `${string}:${string}`,
      payTo,
      price: "$0.01",
    },
    description: "CoastAlert Agent Intelligence",
  },
};
