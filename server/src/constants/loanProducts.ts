export interface IAmortizationSlab {
  fromWeek: number;
  toWeek: number;
  principal: number;
  interest: number;
  savings: number;
  total: number;
}

export interface IWeekAmortization {
  week: number;
  principal: number;
  interest: number;
  savings: number;
  total: number;
}

export interface ILoanProductPreset {
  code: string;
  name: string;
  category: 'REGULAR' | 'SPECIAL';
  frequency: 'WEEKLY' | 'MONTHLY';
  principal: number;
  interestAmount: number;
  docCharges: number;
  savingsAmount: number;
  totalPayable: number;
  tenureWeeks: number;
  slabs: IAmortizationSlab[];
  schedule: IWeekAmortization[];
}

export function expandSlabsToSchedule(slabs: IAmortizationSlab[]): IWeekAmortization[] {
  const schedule: IWeekAmortization[] = [];
  for (const slab of slabs) {
    for (let w = slab.fromWeek; w <= slab.toWeek; w++) {
      schedule.push({
        week: w,
        principal: slab.principal,
        interest: slab.interest,
        savings: slab.savings,
        total: slab.total
      });
    }
  }
  return schedule;
}

const PRESET_10K_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 10, principal: 580, interest: 85, savings: 85, total: 750 },
  { fromWeek: 11, toWeek: 15, principal: 600, interest: 40, savings: 60, total: 700 },
  { fromWeek: 16, toWeek: 17, principal: 600, interest: 0, savings: 0, total: 600 }
];

const PRESET_15K_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 10, principal: 590, interest: 140, savings: 70, total: 800 },
  { fromWeek: 11, toWeek: 20, principal: 605, interest: 85, savings: 60, total: 750 },
  { fromWeek: 21, toWeek: 25, principal: 610, interest: 30, savings: 60, total: 700 }
];

const PRESET_20K_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 10, principal: 625, interest: 185, savings: 40, total: 850 },
  { fromWeek: 11, toWeek: 20, principal: 635, interest: 125, savings: 40, total: 800 },
  { fromWeek: 21, toWeek: 30, principal: 640, interest: 70, savings: 40, total: 750 },
  { fromWeek: 31, toWeek: 32, principal: 500, interest: 0, savings: 0, total: 500 }
];

const PRESET_25K_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 10, principal: 580, interest: 240, savings: 30, total: 850 },
  { fromWeek: 11, toWeek: 20, principal: 585, interest: 185, savings: 30, total: 800 },
  { fromWeek: 21, toWeek: 30, principal: 600, interest: 130, savings: 20, total: 750 },
  { fromWeek: 31, toWeek: 40, principal: 605, interest: 75, savings: 20, total: 700 },
  { fromWeek: 41, toWeek: 42, principal: 650, interest: 0, savings: 0, total: 650 }
];

const PRESET_30K_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 10, principal: 565, interest: 295, savings: 40, total: 900 },
  { fromWeek: 11, toWeek: 20, principal: 575, interest: 235, savings: 40, total: 850 },
  { fromWeek: 21, toWeek: 30, principal: 580, interest: 180, savings: 40, total: 800 },
  { fromWeek: 31, toWeek: 40, principal: 585, interest: 125, savings: 40, total: 750 },
  { fromWeek: 41, toWeek: 50, principal: 595, interest: 65, savings: 40, total: 700 },
  { fromWeek: 51, toWeek: 52, principal: 500, interest: 0, savings: 0, total: 500 }
];

const PRESET_35K_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 10, principal: 570, interest: 350, savings: 30, total: 950 },
  { fromWeek: 11, toWeek: 20, principal: 575, interest: 295, savings: 30, total: 900 },
  { fromWeek: 21, toWeek: 30, principal: 595, interest: 235, savings: 20, total: 850 },
  { fromWeek: 31, toWeek: 40, principal: 600, interest: 180, savings: 20, total: 800 },
  { fromWeek: 41, toWeek: 50, principal: 620, interest: 120, savings: 10, total: 750 },
  { fromWeek: 51, toWeek: 60, principal: 540, interest: 50, savings: 10, total: 600 }
];

const PRESET_30K_BIZ_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 10, principal: 645, interest: 295, savings: 60, total: 1000 },
  { fromWeek: 11, toWeek: 20, principal: 710, interest: 230, savings: 60, total: 1000 },
  { fromWeek: 21, toWeek: 30, principal: 785, interest: 155, savings: 60, total: 1000 },
  { fromWeek: 31, toWeek: 40, principal: 860, interest: 80, savings: 60, total: 1000 }
];

export const LOAN_PRODUCT_PRESETS: ILoanProductPreset[] = [
  {
    code: 'TIER_10K_17W',
    name: '₹10,000 Regular Loan (17 Weeks)',
    category: 'REGULAR',
    frequency: 'WEEKLY',
    principal: 10000,
    interestAmount: 1050,
    docCharges: 500,
    savingsAmount: 1150,
    totalPayable: 12200,
    tenureWeeks: 17,
    slabs: PRESET_10K_SLABS,
    schedule: expandSlabsToSchedule(PRESET_10K_SLABS)
  },
  {
    code: 'TIER_15K_25W',
    name: '₹15,000 Regular Loan (25 Weeks)',
    category: 'REGULAR',
    frequency: 'WEEKLY',
    principal: 15000,
    interestAmount: 2400,
    docCharges: 700,
    savingsAmount: 1600,
    totalPayable: 19000,
    tenureWeeks: 25,
    slabs: PRESET_15K_SLABS,
    schedule: expandSlabsToSchedule(PRESET_15K_SLABS)
  },
  {
    code: 'TIER_20K_32W',
    name: '₹20,000 Regular Loan (32 Weeks)',
    category: 'REGULAR',
    frequency: 'WEEKLY',
    principal: 20000,
    interestAmount: 3800,
    docCharges: 1200,
    savingsAmount: 1200,
    totalPayable: 25000,
    tenureWeeks: 32,
    slabs: PRESET_20K_SLABS,
    schedule: expandSlabsToSchedule(PRESET_20K_SLABS)
  },
  {
    code: 'TIER_25K_42W',
    name: '₹25,000 Regular Loan (42 Weeks)',
    category: 'REGULAR',
    frequency: 'WEEKLY',
    principal: 25000,
    interestAmount: 6300,
    docCharges: 1800,
    savingsAmount: 1000,
    totalPayable: 32300,
    tenureWeeks: 42,
    slabs: PRESET_25K_SLABS,
    schedule: expandSlabsToSchedule(PRESET_25K_SLABS)
  },
  {
    code: 'TIER_30K_52W',
    name: '₹30,000 Regular Loan (52 Weeks / 1 Year)',
    category: 'REGULAR',
    frequency: 'WEEKLY',
    principal: 30000,
    interestAmount: 9000,
    docCharges: 1800,
    savingsAmount: 2000,
    totalPayable: 41000,
    tenureWeeks: 52,
    slabs: PRESET_30K_SLABS,
    schedule: expandSlabsToSchedule(PRESET_30K_SLABS)
  },
  {
    code: 'TIER_35K_60W',
    name: '₹35,000 Regular Loan (60 Weeks)',
    category: 'REGULAR',
    frequency: 'WEEKLY',
    principal: 35000,
    interestAmount: 12300,
    docCharges: 2100,
    savingsAmount: 1200,
    totalPayable: 48500,
    tenureWeeks: 60,
    slabs: PRESET_35K_SLABS,
    schedule: expandSlabsToSchedule(PRESET_35K_SLABS)
  },
  {
    code: 'TIER_30K_40W_BIZ',
    name: '₹30,000 Special Business Loan (40 Weeks)',
    category: 'SPECIAL',
    frequency: 'WEEKLY',
    principal: 30000,
    interestAmount: 7600,
    docCharges: 2100,
    savingsAmount: 2400,
    totalPayable: 40000,
    tenureWeeks: 40,
    slabs: PRESET_30K_BIZ_SLABS,
    schedule: expandSlabsToSchedule(PRESET_30K_BIZ_SLABS)
  }
];
