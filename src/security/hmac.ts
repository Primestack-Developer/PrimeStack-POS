import crypto from 'crypto';

export function signMessage(message: any, secret: string): string {
  const json = JSON.stringify(message);
  return crypto.createHmac('sha256', secret).update(json).digest('base64');
}

export function verifyMessage(message: any, secret: string, signature: string): boolean {
  const expected = signMessage(message, secret);
  return expected === signature;
}
