const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CHARSET_LENGTH = CHARSET.length;

function generateRef(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += CHARSET[bytes[i] % CHARSET_LENGTH];
  }
  return `${prefix}${id}`;
}

export function generateOrderRef(): string {
  return generateRef("LD-ORD-");
}

export function generateTxnRef(): string {
  return generateRef("LD-TXN-");
}