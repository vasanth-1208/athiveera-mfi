import { LOAN_PRODUCT_PRESETS } from '../constants/loanProducts';

export interface ScheduleItem {
  installmentNumber: number;
  dueDate: Date;
  expectedAmount: number;
  allocatedPrincipal: number;
  allocatedInterest: number;
  allocatedSavings: number;
}

export interface LoanCalculationInput {
  principal: number;
  productType?: string;
  interestRate?: number; // e.g. 19.0
  docCharges?: number;
  savingsAmount?: number;
  tenureWeeks?: number;
  startDate: Date;
  collectionDay?: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY';
}

export interface LoanCalculationResult {
  productType: string;
  principal: number;
  interestRate: number;
  interestAmount: number;
  docCharges: number;
  savingsAmount: number;
  totalPayable: number;
  tenureWeeks: number;
  schedule: ScheduleItem[];
}

const WEEKDAY_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6
};

export function getNextWeekdayDate(startDate: Date, targetDay?: string): Date {
  const date = new Date(startDate);
  date.setUTCHours(12, 0, 0, 0);

  if (!targetDay) {
    date.setUTCDate(date.getUTCDate() + 7);
    return date;
  }

  const targetDayIdx = WEEKDAY_INDEX[targetDay.toUpperCase().trim()];
  if (targetDayIdx === undefined) {
    date.setUTCDate(date.getUTCDate() + 7);
    return date;
  }

  const currentDayIdx = date.getUTCDay();
  let daysToAdd = (targetDayIdx - currentDayIdx + 7) % 7;
  if (daysToAdd === 0) {
    daysToAdd = 7; // Next week's collection day
  }
  date.setUTCDate(date.getUTCDate() + daysToAdd);
  return date;
}

export function calculateLoanSchedule(input: LoanCalculationInput): LoanCalculationResult {
  const { principal, startDate, collectionDay } = input;
  let productType = input.productType || 'CUSTOM';
  if (!input.productType || input.productType === 'CUSTOM') {
    if (principal === 20000) productType = 'TIER_A_20K';
    else if (principal === 25000) productType = 'TIER_B_25K';
    else if (principal === 30000) productType = 'TIER_C_30K';
  }

  // Find exact matching product preset (TIER_10K_17W, TIER_15K_25W, TIER_20K_32W, etc.)
  const matchingPreset = LOAN_PRODUCT_PRESETS.find(p => 
    (input.productType && (
      p.code === input.productType ||
      (input.productType === 'TIER_A_20K' && p.code === 'TIER_20K_32W') ||
      (input.productType === 'TIER_B_25K' && p.code === 'TIER_25K_42W') ||
      (input.productType === 'TIER_C_30K' && p.code === 'TIER_30K_52W')
    )) ||
    (p.principal === principal && (input.tenureWeeks ? p.tenureWeeks === input.tenureWeeks : true))
  );

  if (matchingPreset) {
    const tenureWeeks = matchingPreset.tenureWeeks;
    const interestAmount = matchingPreset.interestAmount;
    const docCharges = input.docCharges ?? matchingPreset.docCharges;
    const savingsAmount = input.savingsAmount ?? matchingPreset.savingsAmount;
    const totalPayable = matchingPreset.totalPayable;
    const interestRate = matchingPreset.principal > 0
      ? Math.round((matchingPreset.interestAmount / matchingPreset.principal) * 100 * 10) / 10
      : 0;

    const schedule: ScheduleItem[] = [];
    const firstDueDate = getNextWeekdayDate(startDate, collectionDay);

    for (let i = 0; i < matchingPreset.schedule.length; i++) {
      const item = matchingPreset.schedule[i];
      const currentDueDate = new Date(firstDueDate);
      currentDueDate.setDate(firstDueDate.getDate() + (i * 7));

      schedule.push({
        installmentNumber: item.week,
        dueDate: currentDueDate,
        expectedAmount: item.total,
        allocatedPrincipal: item.principal,
        allocatedInterest: item.interest,
        allocatedSavings: item.savings
      });
    }

    return {
      productType: productType !== 'CUSTOM' ? productType : matchingPreset.code,
      principal: matchingPreset.principal,
      interestRate,
      interestAmount,
      docCharges,
      savingsAmount,
      totalPayable,
      tenureWeeks,
      schedule
    };
  }

  // Custom calculation for non-standard loans
  const interestRate = input.interestRate ?? 20.0;
  const interestAmount = Math.round((principal * interestRate) / 100);
  const tenureWeeks = input.tenureWeeks ?? 30;
  const docCharges = input.docCharges ?? 0;
  const savingsAmount = input.savingsAmount ?? 0;
  const totalPayable = principal + interestAmount + savingsAmount;
  const weeklyInstallments: number[] = [];

  const weeklyBase = Math.round(totalPayable / tenureWeeks);
  for (let w = 1; w <= tenureWeeks; w++) {
    weeklyInstallments.push(weeklyBase);
  }

  const schedule: ScheduleItem[] = [];
  const firstDueDate = getNextWeekdayDate(startDate, collectionDay);

  const principalRatio = principal / totalPayable;
  const interestRatio = interestAmount / totalPayable;

  for (let i = 0; i < weeklyInstallments.length; i++) {
    const currentDueDate = new Date(firstDueDate);
    currentDueDate.setUTCDate(firstDueDate.getUTCDate() + (i * 7));

    const expAmt = weeklyInstallments[i];
    const allocP = Math.round(expAmt * principalRatio);
    const allocI = Math.round(expAmt * interestRatio);
    const allocS = expAmt - allocP - allocI;

    schedule.push({
      installmentNumber: i + 1,
      dueDate: currentDueDate,
      expectedAmount: expAmt,
      allocatedPrincipal: allocP,
      allocatedInterest: allocI,
      allocatedSavings: allocS
    });
  }

  return {
    productType,
    principal,
    interestRate,
    interestAmount,
    docCharges,
    savingsAmount,
    totalPayable,
    tenureWeeks,
    schedule
  };
}

