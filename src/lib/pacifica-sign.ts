import bs58 from "bs58";

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys((obj as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return obj;
}

export async function signMessage(
  header: { timestamp: number; expiry_window: number; type: string },
  payload: Record<string, unknown>,
  signFn: (message: Uint8Array) => Promise<Uint8Array>,
): Promise<string> {
  const dataToSign = { ...header, data: payload };
  const sorted = sortKeys(dataToSign);
  const compact = JSON.stringify(sorted);
  const messageBytes = new TextEncoder().encode(compact);
  const signatureBytes = await signFn(messageBytes);
  return bs58.encode(signatureBytes);
}

export function buildWithdrawRequest(
  account: string,
  signature: string,
  timestamp: number,
  expiryWindow: number,
  amount: string,
) {
  return {
    account,
    signature,
    timestamp,
    expiry_window: expiryWindow,
    amount,
  };
}
