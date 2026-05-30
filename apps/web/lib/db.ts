// BigInt JSON serialization — point amounts là BigInt (xem README).
// Patch chạy 1 lần khi module được import.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

export { prisma } from '@wc/db';
export * from '@wc/db';
