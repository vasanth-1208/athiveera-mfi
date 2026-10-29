import mongoose from 'mongoose';
import { Branch } from '../models/Branch';
import { CashTransaction, TransactionType, AccountType } from '../models/CashTransaction';

export interface RecordCashbookEntryInput {
  branchId: string | mongoose.Types.ObjectId;
  transactionDate?: Date;
  type: TransactionType;
  accountType?: AccountType;
  category: string;
  amount: number;
  vNo?: string;
  relatedEntityType?: 'LOAN_DISBURSEMENT' | 'COLLECTION' | 'EXPENSE' | 'BRANCH_TRANSFER' | 'ADJUSTMENT' | 'SETTLEMENT';
  relatedEntityId?: string | mongoose.Types.ObjectId | null;
  description?: string;
  createdById?: string | mongoose.Types.ObjectId | null;
}

export async function recordCashbookEntry(input: RecordCashbookEntryInput): Promise<any> {
  const {
    branchId,
    transactionDate = new Date(),
    type,
    accountType = 'CASH',
    category,
    amount,
    vNo = '',
    relatedEntityType = 'ADJUSTMENT',
    relatedEntityId = null,
    description = '',
    createdById = null
  } = input;

  if (amount <= 0) {
    throw new Error('Transaction amount must be greater than zero');
  }

  const branch = await Branch.findById(branchId);
  if (!branch) {
    throw new Error(`Branch with ID ${branchId} not found`);
  }

  // Update branch balance
  let newBalance = accountType === 'CASH' ? branch.cashBalance : branch.bankBalance;
  if (type === 'CREDIT') {
    // Inflow
    newBalance += amount;
  } else {
    // Outflow (DEBIT)
    newBalance -= amount;
  }

  if (accountType === 'CASH') {
    branch.cashBalance = newBalance;
  } else {
    branch.bankBalance = newBalance;
  }
  await branch.save();

  // Create transaction entry
  const transaction = new CashTransaction({
    branchId,
    transactionDate,
    type,
    accountType,
    category,
    amount,
    vNo,
    relatedEntityType,
    relatedEntityId,
    description,
    runningBalance: newBalance,
    createdById
  });

  await transaction.save();
  return transaction;
}

export async function recordBranchTransferTransactions(
  sourceBranchId: string | mongoose.Types.ObjectId,
  destinationBranchId: string | mongoose.Types.ObjectId,
  amount: number,
  accountType: AccountType,
  transferId: string | mongoose.Types.ObjectId,
  createdById: string | mongoose.Types.ObjectId | null,
  purpose: string
): Promise<void> {
  const sourceBranch = await Branch.findById(sourceBranchId);
  const destBranch = await Branch.findById(destinationBranchId);

  if (!sourceBranch || !destBranch) {
    throw new Error('Invalid source or destination branch');
  }

  // 1. Debit outflow from source branch
  await recordCashbookEntry({
    branchId: sourceBranchId,
    type: 'DEBIT',
    accountType,
    category: `BRANCH TRANSFER TO ${destBranch.name.toUpperCase()}`,
    amount,
    relatedEntityType: 'BRANCH_TRANSFER',
    relatedEntityId: transferId,
    description: `Transfer to ${destBranch.name}. Purpose: ${purpose || 'Inter-branch funding'}`,
    createdById
  });

  // 2. Credit inflow into destination branch
  await recordCashbookEntry({
    branchId: destinationBranchId,
    type: 'CREDIT',
    accountType,
    category: `BRANCH TRANSFER FROM ${sourceBranch.name.toUpperCase()}`,
    amount,
    relatedEntityType: 'BRANCH_TRANSFER',
    relatedEntityId: transferId,
    description: `Transfer from ${sourceBranch.name}. Purpose: ${purpose || 'Inter-branch funding'}`,
    createdById
  });
}
