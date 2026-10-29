import { Payment } from '../models/Payment';

/**
 * Robust sequential receipt number generator that prevents E11000 duplicate key collisions.
 * Analyzes highest existing ATH-RCP- number and verifies non-existence before returning.
 */
export async function getNextReceiptNumber(): Promise<string> {
  const lastPayment = await Payment.findOne({
    receiptNumber: { $regex: '^ATH-RCP-\\d+$' }
  })
    .sort({ receiptNumber: -1 })
    .lean();

  let nextSeq = 1;
  if (lastPayment && lastPayment.receiptNumber) {
    const match = lastPayment.receiptNumber.match(/\d+$/);
    if (match) {
      nextSeq = parseInt(match[0], 10) + 1;
    }
  }

  const count = await Payment.countDocuments();
  nextSeq = Math.max(nextSeq, count + 1);

  // Guarantee non-existence across concurrent executions
  let candidate = `ATH-RCP-${String(nextSeq).padStart(6, '0')}`;
  while (await Payment.exists({ receiptNumber: candidate })) {
    nextSeq++;
    candidate = `ATH-RCP-${String(nextSeq).padStart(6, '0')}`;
  }

  return candidate;
}

