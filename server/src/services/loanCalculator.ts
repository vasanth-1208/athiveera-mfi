import { LOAN_PRODUCT_PRESETS } from '../constants/loanProducts';

export interface ScheduleItem {
  installmentNumber: number;
  dueDate: Date;
  expectedAmount: number;
  allocatedPrincipal: number;
  allocatedInterest: number;
  allocatedSavings: number;
}

export type WeekdayName = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface LoanCalculationInput {
  principal: number;
  productType?: string;
  interestRate?: number; // e.g. 19.0
  docCharges?: number;
  savingsAmount?: number;
  tenureWeeks?: number;
  startDate: Date;
  collectionDay?: WeekdayName | string;
  frequency?: 'WEEKLY' | 'MONTHLY' | 'DAILY' | string;
  monthlyScheduleType?: 'DATE_OF_MONTH' | 'DAY_OF_WEEK_PATTERN';
  monthlyDayOfMonth?: number;
  monthlyWeekOrdinal?: number;
  monthlyWeekday?: string;
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

export function getNthWeekdayOfMonth(year: number, month: number, weekdayName: string, ordinal: number): Date {
  const dayIdx = WEEKDAY_INDEX[weekdayName.toUpperCase().trim()] ?? 5; // default Friday
  const firstOfMonth = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const firstDayOfWeek = firstOfMonth.getUTCDay();
  let dayOffset = dayIdx - firstDayOfWeek;
  if (dayOffset < 0) dayOffset += 7;

  let targetDay = 1 + dayOffset + ((ordinal - 1) * 7);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  if (targetDay > daysInMonth) {
    targetDay -= 7;
  }

  return new Date(Date.UTC(year, month, targetDay, 12, 0, 0));
}

export function calculateInstallmentDueDate(
  loanDate: Date,
  installmentIndex: number, // 0-based
  frequency: 'WEEKLY' | 'MONTHLY' | 'DAILY' | string = 'WEEKLY',
  collectionDay?: string,
  monthlyScheduleType: 'DATE_OF_MONTH' | 'DAY_OF_WEEK_PATTERN' = 'DATE_OF_MONTH',
  monthlyDayOfMonth: number = 5,
  monthlyWeekOrdinal: number = 2,
  monthlyWeekday: string = 'FRIDAY'
): Date {
  if (frequency === 'WEEKLY') {
    const firstDueDate = getNextWeekdayDate(loanDate, collectionDay || 'MONDAY');
    const d = new Date(firstDueDate);
    d.setUTCDate(firstDueDate.getUTCDate() + (installmentIndex * 7));
    return d;
  }

  // MONTHLY
  const start = new Date(loanDate);
  const targetMonthIndex = start.getUTCMonth() + installmentIndex + 1;
  const targetYear = start.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

  if (monthlyScheduleType === 'DAY_OF_WEEK_PATTERN') {
    return getNthWeekdayOfMonth(targetYear, targetMonth, monthlyWeekday || 'FRIDAY', monthlyWeekOrdinal || 2);
  } else {
    const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const clampedDay = Math.min(daysInMonth, Math.max(1, monthlyDayOfMonth || 5));
    return new Date(Date.UTC(targetYear, targetMonth, clampedDay, 12, 0, 0));
  }
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
      const currentDueDate = calculateInstallmentDueDate(
        startDate,
        i,
        input.frequency || (matchingPreset.frequency as any) || 'WEEKLY',
        collectionDay,
        input.monthlyScheduleType,
        input.monthlyDayOfMonth,
        input.monthlyWeekOrdinal,
        input.monthlyWeekday
      );

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
    const currentDueDate = calculateInstallmentDueDate(
      startDate,
      i,
      input.frequency || 'WEEKLY',
      collectionDay,
      input.monthlyScheduleType,
      input.monthlyDayOfMonth,
      input.monthlyWeekOrdinal,
      input.monthlyWeekday
    );

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

