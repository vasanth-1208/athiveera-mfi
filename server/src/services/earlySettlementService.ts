import { ILoan } from '../models/Loan';

export interface EarlySettlementQuote {
  loanId: string;
  loanNumber: string;
  elapsedWeeks: number;
  tenureWeeks: number;
  outstandingTotal: number;
  outstandingPrincipal: number;
  outstandingInterest: number;
  savingsAmount: number;
  totalPaid: number;
  totalPayable: number;
  discountTier: string;
  discountPercent: number;
  discountAmount: number;
  netInterestToPay: number;
  totalSettlementAmount: number;
}

export function calculateEarlySettlement(
  loan: any,
  settlementDate: Date = new Date()
): EarlySettlementQuote {
  const start = new Date(loan.disbursedDate || loan.loanDate || loan.createdAt || new Date());
  const diffTime = Math.max(0, settlementDate.getTime() - start.getTime());
  const elapsedWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));

  let discountPercent = 0;
  let discountTier = 'Tier 4: 31+ Weeks';

  const tenureWeeks = loan.tenureWeeks || 32;

  // Determine discount tier based on tenure
  if (tenureWeeks <= 35) {
    if (elapsedWeeks <= 10) {
      discountPercent = 75;
      discountTier = 'Tier 1: 0 to 10 Weeks';
    } else if (elapsedWeeks <= 20) {
      discountPercent = 50;
      discountTier = 'Tier 2: 11 to 20 Weeks';
    } else if (elapsedWeeks <= 30) {
      discountPercent = 25;
      discountTier = 'Tier 3: 21 to 30 Weeks';
    } else {
      discountPercent = 0;
      discountTier = 'Tier 4: 31+ Weeks';
    }
  } else if (tenureWeeks <= 45) {
    if (elapsedWeeks <= 13) {
      discountPercent = 75;
      discountTier = 'Tier 1: 0 to 13 Weeks';
    } else if (elapsedWeeks <= 25) {
      discountPercent = 50;
      discountTier = 'Tier 2: 14 to 25 Weeks';
    } else if (elapsedWeeks <= 37) {
      discountPercent = 25;
      discountTier = 'Tier 3: 26 to 37 Weeks';
    } else {
      discountPercent = 0;
      discountTier = 'Tier 4: 38+ Weeks';
    }
  } else {
    if (elapsedWeeks <= 15) {
      discountPercent = 75;
      discountTier = 'Tier 1: 0 to 15 Weeks';
    } else if (elapsedWeeks <= 30) {
      discountPercent = 50;
      discountTier = 'Tier 2: 16 to 30 Weeks';
    } else if (elapsedWeeks <= 45) {
      discountPercent = 25;
      discountTier = 'Tier 3: 31 to 45 Weeks';
    } else {
      discountPercent = 0;
      discountTier = 'Tier 4: 46+ Weeks';
    }
  }

  const totalPayable = Number(loan.totalPayable) || (Number(loan.principal) + Number(loan.interestAmount || 0));
  const totalPaid = Number(loan.totalPaid) || 0;
  
  // Total contractual remaining balance
  const outstandingTotal = loan.outstandingTotal !== undefined && loan.outstandingTotal >= 0
    ? Number(loan.outstandingTotal)
    : Math.max(0, totalPayable - totalPaid);

  const outPrincipal = loan.outstandingPrincipal !== undefined && loan.outstandingPrincipal > 0
    ? Number(loan.outstandingPrincipal)
    : Math.max(0, (Number(loan.principal) || 0) - totalPaid);

  const outInterest = loan.outstandingInterest !== undefined && loan.outstandingInterest > 0
    ? Number(loan.outstandingInterest)
    : Math.max(0, (Number(loan.interestAmount) || 0));

  const savingsAmount = Number(loan.savingsAmount) || 0;

  const discountAmount = Math.round((outInterest * discountPercent) / 100);
  const netInterestToPay = outInterest - discountAmount;
  
  // Total settlement amount: if outPrincipal > 0 then principal + net interest, else outstandingTotal
  const totalSettlementAmount = (outPrincipal > 0 || outInterest > 0)
    ? (outPrincipal + netInterestToPay)
    : outstandingTotal;

  return {
    loanId: loan._id?.toString() || '',
    loanNumber: loan.loanNumber || '',
    elapsedWeeks,
    tenureWeeks,
    outstandingTotal,
    outstandingPrincipal: outPrincipal,
    outstandingInterest: outInterest,
    savingsAmount,
    totalPaid,
    totalPayable,
    discountTier,
    discountPercent,
    discountAmount,
    netInterestToPay,
    totalSettlementAmount
  };
}
