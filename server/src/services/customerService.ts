import { Customer } from '../models/Customer';

/**
 * Robust sequential customerId generator that prevents E11000 duplicate key collisions.
 * Finds the highest existing sequence number for the branch prefix and verifies non-existence.
 */
export async function getNextCustomerId(branchCode: string = 'PL'): Promise<string> {
  const bCode = branchCode?.toUpperCase().includes('MDKM') ? 'MDKM' : 'PL';
  const prefix = `ATH-${bCode}-CUST-`;

  // Find all existing customer IDs matching this prefix
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
  let nextSeq = Math.max(maxSeq + 1, count + 1);

  let candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
  while (await Customer.exists({ customerId: candidate })) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  return candidate;
}
