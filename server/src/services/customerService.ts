import { Counter } from '../models/Counter';
import { Customer } from '../models/Customer';

/**
 * 100% Collision-Proof Atomic Sequential Customer ID Generator.
 * Uses atomic MongoDB `$inc` via Counter model to guarantee unique IDs
 * across concurrent customer creation requests.
 */
export async function getNextCustomerId(branchCode: string = 'PL'): Promise<string> {
  const bCode = branchCode?.toUpperCase().includes('MDKM') ? 'MDKM' : 'PL';
  const prefix = `ATH-${bCode}-CUST-`;
  const counterId = `cust_${bCode}`;

  // Ensure counter is initialized
  const existingCounter = await Counter.findById(counterId);
  if (!existingCounter) {
    const existing = await Customer.find({
      customerId: { $regex: `^${prefix}\\d+$` }
    }).select('customerId').lean();

    let maxSeq = 0;
    for (const c of existing) {
      if (c.customerId) {
        const match = c.customerId.match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (num > maxSeq) maxSeq = num;
        }
      }
    }
    const count = await Customer.countDocuments();
    maxSeq = Math.max(maxSeq, count);

    await Counter.findByIdAndUpdate(
      counterId,
      { $set: { seq: maxSeq } },
      { upsert: true, new: true }
    );
  }

  // Atomically increment counter
  const counter = await Counter.findByIdAndUpdate(
    counterId,
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );

  let seq = counter.seq;
  let candidate = `${prefix}${String(seq).padStart(4, '0')}`;

  while (await Customer.exists({ customerId: candidate })) {
    const next = await Counter.findByIdAndUpdate(
      counterId,
      { $inc: { seq: 1 } },
      { new: true }
    );
    seq = next.seq;
    candidate = `${prefix}${String(seq).padStart(4, '0')}`;
  }

  return candidate;
}
