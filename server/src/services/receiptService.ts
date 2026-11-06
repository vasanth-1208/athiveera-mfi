import { Counter } from '../models/Counter';
import { Payment } from '../models/Payment';

let isInitialized = false;

async function ensureCounterInitialized() {
  if (isInitialized) return;
  const existing = await Counter.findById('receiptNumber');
  if (!existing) {
    const lastPayment = await Payment.findOne({
      receiptNumber: { $regex: '^ATH-RCP-\\d+$' }
    })
      .sort({ receiptNumber: -1 })
      .lean();

    let maxSeq = 0;
    if (lastPayment && lastPayment.receiptNumber) {
      const match = lastPayment.receiptNumber.match(/\d+$/);
      if (match) {
        maxSeq = parseInt(match[0], 10);
      }
    }
    const count = await Payment.countDocuments();
    maxSeq = Math.max(maxSeq, count);

    await Counter.findByIdAndUpdate(
      'receiptNumber',
      { $set: { seq: maxSeq } },
      { upsert: true, new: true }
    );
  }
  isInitialized = true;
}

/**
 * 100% Collision-Proof Atomic Sequential Receipt Number Generator.
 * Uses atomic MongoDB `$inc` via Counter model to guarantee strictly unique
 * sequence numbers across high-concurrency and rapid multi-record operations.
 */
export async function getNextReceiptNumber(): Promise<string> {
  await ensureCounterInitialized();

  // Atomically increment counter in MongoDB
  const counter = await Counter.findByIdAndUpdate(
    'receiptNumber',
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  let seq = counter.seq;
  let candidate = `ATH-RCP-${String(seq).padStart(6, '0')}`;

  // Defensive loop in case of legacy manual insertions
  while (await Payment.exists({ receiptNumber: candidate })) {
    const next = await Counter.findByIdAndUpdate(
      'receiptNumber',
      { $inc: { seq: 1 } },
      { new: true }
    );
    seq = next.seq;
    candidate = `ATH-RCP-${String(seq).padStart(6, '0')}`;
  }

  return candidate;
}
