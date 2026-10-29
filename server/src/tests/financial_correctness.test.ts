import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { calculateLoanSchedule } from '../services/loanCalculator';
import { calculateEarlySettlement } from '../services/earlySettlementService';
import { recordCashbookEntry, recordBranchTransferTransactions } from '../services/cashbookService';
import { Branch } from '../models/Branch';
import { Loan } from '../models/Loan';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('1. Loan Calculation & Stepped-Down Amortization', () => {
  it('should accurately calculate Tier A (20,000) 32-week loan with graduated installments', () => {
    const calc = calculateLoanSchedule({
      principal: 20000,
      startDate: new Date('2026-01-10'),
      collectionDay: 'MONDAY'
    });

    expect(calc.productType).toBe('TIER_A_20K');
    expect(calc.principal).toBe(20000);
    expect(calc.interestAmount).toBe(3800); // 19% flat
    expect(calc.docCharges).toBe(1200);
    expect(calc.savingsAmount).toBe(1200);
    expect(calc.tenureWeeks).toBe(32);
    expect(calc.schedule.length).toBe(32);

    // Weeks 1-10: 850
    for (let w = 0; w < 10; w++) {
      expect(calc.schedule[w].expectedAmount).toBe(850);
    }
    // Weeks 11-20: 800
    for (let w = 10; w < 20; w++) {
      expect(calc.schedule[w].expectedAmount).toBe(800);
    }
    // Weeks 21-30: 750
    for (let w = 20; w < 30; w++) {
      expect(calc.schedule[w].expectedAmount).toBe(750);
    }
    // Weeks 31-32: 500
    expect(calc.schedule[30].expectedAmount).toBe(500);
    expect(calc.schedule[31].expectedAmount).toBe(500);

    // Sum of all installments = 25,000 (covers 23,800 + 1,200 savings)
    const sumInstallments = calc.schedule.reduce((sum, item) => sum + item.expectedAmount, 0);
    expect(sumInstallments).toBe(25000);
  });

  it('should accurately calculate Tier B (25,000) 42-week loan with graduated installments', () => {
    const calc = calculateLoanSchedule({
      principal: 25000,
      startDate: new Date('2026-09-07'),
      collectionDay: 'THURSDAY'
    });

    expect(calc.productType).toBe('TIER_B_25K');
    expect(calc.principal).toBe(25000);
    expect(calc.interestAmount).toBe(6300); // 25.2%
    expect(calc.docCharges).toBe(1800);
    expect(calc.savingsAmount).toBe(1000);
    expect(calc.tenureWeeks).toBe(42);
    expect(calc.schedule.length).toBe(42);

    // Weeks 1-10: 850
    expect(calc.schedule[0].expectedAmount).toBe(850);
    // Weeks 11-20: 800
    expect(calc.schedule[10].expectedAmount).toBe(800);
    // Weeks 21-30: 750
    expect(calc.schedule[20].expectedAmount).toBe(750);
    // Weeks 31-40: 700
    expect(calc.schedule[30].expectedAmount).toBe(700);
    // Weeks 41-42: 650
    expect(calc.schedule[40].expectedAmount).toBe(650);
    expect(calc.schedule[41].expectedAmount).toBe(650);

    const sumInstallments = calc.schedule.reduce((sum, item) => sum + item.expectedAmount, 0);
    expect(sumInstallments).toBe(32300); // 31,300 + 1,000 savings
  });
});

describe('2. Early Loan Settlement & Interest Discount Matrix', () => {
  it('should calculate 75% interest discount in Tier 1 (weeks 0 to 10)', () => {
    const mockLoan = {
      _id: new mongoose.Types.ObjectId(),
      loanNumber: 'ATH-LN-1-TEST',
      tenureWeeks: 32,
      disbursedDate: new Date('2026-01-01'),
      outstandingPrincipal: 16000,
      outstandingInterest: 3000
    } as any;

    // Settle 3 weeks after disbursement
    const settleDate = new Date('2026-01-22');
    const quote = calculateEarlySettlement(mockLoan, settleDate);

    expect(quote.discountPercent).toBe(75);
    expect(quote.discountAmount).toBe(2250); // 75% of 3000
    expect(quote.netInterestToPay).toBe(750);  // 25% of 3000
    expect(quote.totalSettlementAmount).toBe(16750); // 16000 + 750
  });

  it('should calculate 50% interest discount in Tier 2 (weeks 11 to 20)', () => {
    const mockLoan = {
      _id: new mongoose.Types.ObjectId(),
      loanNumber: 'ATH-LN-1-TEST',
      tenureWeeks: 32,
      disbursedDate: new Date('2026-01-01'),
      outstandingPrincipal: 12000,
      outstandingInterest: 2000
    } as any;

    // Settle 15 weeks after disbursement
    const settleDate = new Date('2026-04-16');
    const quote = calculateEarlySettlement(mockLoan, settleDate);

    expect(quote.discountPercent).toBe(50);
    expect(quote.discountAmount).toBe(1000); // 50% of 2000
    expect(quote.netInterestToPay).toBe(1000);
    expect(quote.totalSettlementAmount).toBe(13000); // 12000 + 1000
  });
});

describe('3. Cashbook & Dual-Branch Transfer Accounting', () => {
  it('should correctly update running balances and transfer funds between branches', async () => {
    const branchA = await Branch.create({
      code: 'TEST_A',
      name: 'Branch A',
      cashBalance: 100000,
      bankBalance: 0
    });

    const branchB = await Branch.create({
      code: 'TEST_B',
      name: 'Branch B',
      cashBalance: 20000,
      bankBalance: 0
    });

    // Transfer 30,000 from Branch A to Branch B
    const transferId = new mongoose.Types.ObjectId();
    await recordBranchTransferTransactions(
      branchA._id,
      branchB._id,
      30000,
      'CASH',
      transferId,
      null,
      'Inter-branch liquidity support'
    );

    const updatedA = await Branch.findById(branchA._id);
    const updatedB = await Branch.findById(branchB._id);

    expect(updatedA?.cashBalance).toBe(70000); // 100000 - 30000
    expect(updatedB?.cashBalance).toBe(50000); // 20000 + 30000
  });
});
