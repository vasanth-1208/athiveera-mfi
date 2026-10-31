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

const PRESET_MONTHLY_25K_12M_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 1, principal: 1635, interest: 1075, savings: 0, total: 2710 },
  { fromWeek: 2, toWeek: 2, principal: 1710, interest: 1000, savings: 0, total: 2710 },
  { fromWeek: 3, toWeek: 3, principal: 1775, interest: 935, savings: 0, total: 2710 },
  { fromWeek: 4, toWeek: 4, principal: 1855, interest: 855, savings: 0, total: 2710 },
  { fromWeek: 5, toWeek: 5, principal: 1935, interest: 775, savings: 0, total: 2710 },
  { fromWeek: 6, toWeek: 6, principal: 2020, interest: 690, savings: 0, total: 2710 },
  { fromWeek: 7, toWeek: 7, principal: 2105, interest: 605, savings: 0, total: 2710 },
  { fromWeek: 8, toWeek: 8, principal: 2195, interest: 515, savings: 0, total: 2710 },
  { fromWeek: 9, toWeek: 9, principal: 2290, interest: 420, savings: 0, total: 2710 },
  { fromWeek: 10, toWeek: 10, principal: 2390, interest: 320, savings: 0, total: 2710 },
  { fromWeek: 11, toWeek: 11, principal: 2490, interest: 220, savings: 0, total: 2710 },
  { fromWeek: 12, toWeek: 12, principal: 2600, interest: 110, savings: 0, total: 2710 }
];

const PRESET_MONTHLY_30K_15M_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 1, principal: 1470, interest: 1280, savings: 0, total: 2750 },
  { fromWeek: 2, toWeek: 2, principal: 1530, interest: 1220, savings: 0, total: 2750 },
  { fromWeek: 3, toWeek: 3, principal: 1595, interest: 1155, savings: 0, total: 2750 },
  { fromWeek: 4, toWeek: 4, principal: 1665, interest: 1085, savings: 0, total: 2750 },
  { fromWeek: 5, toWeek: 5, principal: 1735, interest: 1015, savings: 0, total: 2750 },
  { fromWeek: 6, toWeek: 6, principal: 1810, interest: 940, savings: 0, total: 2750 },
  { fromWeek: 7, toWeek: 7, principal: 1885, interest: 865, savings: 0, total: 2750 },
  { fromWeek: 8, toWeek: 8, principal: 1970, interest: 780, savings: 0, total: 2750 },
  { fromWeek: 9, toWeek: 9, principal: 2050, interest: 700, savings: 0, total: 2750 },
  { fromWeek: 10, toWeek: 10, principal: 2140, interest: 610, savings: 0, total: 2750 },
  { fromWeek: 11, toWeek: 11, principal: 2230, interest: 520, savings: 0, total: 2750 },
  { fromWeek: 12, toWeek: 12, principal: 2325, interest: 425, savings: 0, total: 2750 },
  { fromWeek: 13, toWeek: 13, principal: 2430, interest: 320, savings: 0, total: 2750 },
  { fromWeek: 14, toWeek: 14, principal: 2530, interest: 220, savings: 0, total: 2750 },
  { fromWeek: 15, toWeek: 15, principal: 2635, interest: 115, savings: 0, total: 2750 }
];

const PRESET_MONTHLY_35K_15M_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 1, principal: 1712, interest: 1498, savings: 0, total: 3210 },
  { fromWeek: 2, toWeek: 2, principal: 1785, interest: 1425, savings: 0, total: 3210 },
  { fromWeek: 3, toWeek: 3, principal: 1862, interest: 1348, savings: 0, total: 3210 },
  { fromWeek: 4, toWeek: 4, principal: 1941, interest: 1269, savings: 0, total: 3210 },
  { fromWeek: 5, toWeek: 5, principal: 2024, interest: 1186, savings: 0, total: 3210 },
  { fromWeek: 6, toWeek: 6, principal: 2111, interest: 1099, savings: 0, total: 3210 },
  { fromWeek: 7, toWeek: 7, principal: 2201, interest: 1009, savings: 0, total: 3210 },
  { fromWeek: 8, toWeek: 8, principal: 2295, interest: 915, savings: 0, total: 3210 },
  { fromWeek: 9, toWeek: 9, principal: 2394, interest: 816, savings: 0, total: 3210 },
  { fromWeek: 10, toWeek: 10, principal: 2496, interest: 714, savings: 0, total: 3210 },
  { fromWeek: 11, toWeek: 11, principal: 2603, interest: 607, savings: 0, total: 3210 },
  { fromWeek: 12, toWeek: 12, principal: 2715, interest: 495, savings: 0, total: 3210 },
  { fromWeek: 13, toWeek: 13, principal: 2831, interest: 379, savings: 0, total: 3210 },
  { fromWeek: 14, toWeek: 14, principal: 2952, interest: 258, savings: 0, total: 3210 },
  { fromWeek: 15, toWeek: 15, principal: 3078, interest: 132, savings: 0, total: 3210 }
];

const PRESET_MONTHLY_40K_15M_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 1, principal: 1967, interest: 1683, savings: 0, total: 3650 },
  { fromWeek: 2, toWeek: 2, principal: 2050, interest: 1600, savings: 0, total: 3650 },
  { fromWeek: 3, toWeek: 3, principal: 2136, interest: 1514, savings: 0, total: 3650 },
  { fromWeek: 4, toWeek: 4, principal: 2226, interest: 1424, savings: 0, total: 3650 },
  { fromWeek: 5, toWeek: 5, principal: 2320, interest: 1330, savings: 0, total: 3650 },
  { fromWeek: 6, toWeek: 6, principal: 2417, interest: 1233, savings: 0, total: 3650 },
  { fromWeek: 7, toWeek: 7, principal: 2520, interest: 1130, savings: 0, total: 3650 },
  { fromWeek: 8, toWeek: 8, principal: 2625, interest: 1025, savings: 0, total: 3650 },
  { fromWeek: 9, toWeek: 9, principal: 2735, interest: 915, savings: 0, total: 3650 },
  { fromWeek: 10, toWeek: 10, principal: 2850, interest: 800, savings: 0, total: 3650 },
  { fromWeek: 11, toWeek: 11, principal: 2970, interest: 680, savings: 0, total: 3650 },
  { fromWeek: 12, toWeek: 12, principal: 3095, interest: 555, savings: 0, total: 3650 },
  { fromWeek: 13, toWeek: 13, principal: 3225, interest: 425, savings: 0, total: 3650 },
  { fromWeek: 14, toWeek: 14, principal: 3361, interest: 289, savings: 0, total: 3650 },
  { fromWeek: 15, toWeek: 15, principal: 3503, interest: 147, savings: 0, total: 3650 }
];

const PRESET_MONTHLY_40K_12M_SLABS: IAmortizationSlab[] = [
  { fromWeek: 1, toWeek: 1, principal: 2621, interest: 1709, savings: 0, total: 4330 },
  { fromWeek: 2, toWeek: 2, principal: 2733, interest: 1597, savings: 0, total: 4330 },
  { fromWeek: 3, toWeek: 3, principal: 2849, interest: 1481, savings: 0, total: 4330 },
  { fromWeek: 4, toWeek: 4, principal: 2971, interest: 1359, savings: 0, total: 4330 },
  { fromWeek: 5, toWeek: 5, principal: 3098, interest: 1232, savings: 0, total: 4330 },
  { fromWeek: 6, toWeek: 6, principal: 3231, interest: 1099, savings: 0, total: 4330 },
  { fromWeek: 7, toWeek: 7, principal: 3369, interest: 961, savings: 0, total: 4330 },
  { fromWeek: 8, toWeek: 8, principal: 3513, interest: 817, savings: 0, total: 4330 },
  { fromWeek: 9, toWeek: 9, principal: 3663, interest: 667, savings: 0, total: 4330 },
  { fromWeek: 10, toWeek: 10, principal: 3819, interest: 511, savings: 0, total: 4330 },
  { fromWeek: 11, toWeek: 11, principal: 3980, interest: 350, savings: 0, total: 4330 },
  { fromWeek: 12, toWeek: 12, principal: 4153, interest: 177, savings: 0, total: 4330 }
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
  },
  {
    code: 'MONTHLY_25K_12M',
    name: '₹25,000 Monthly Loan (12 Months)',
    category: 'REGULAR',
    frequency: 'MONTHLY',
    principal: 25000,
    interestAmount: 7520,
    docCharges: 1800,
    savingsAmount: 0,
    totalPayable: 32520,
    tenureWeeks: 12,
    slabs: PRESET_MONTHLY_25K_12M_SLABS,
    schedule: expandSlabsToSchedule(PRESET_MONTHLY_25K_12M_SLABS)
  },
  {
    code: 'MONTHLY_30K_15M',
    name: '₹30,000 Monthly Loan (15 Months)',
    category: 'REGULAR',
    frequency: 'MONTHLY',
    principal: 30000,
    interestAmount: 11250,
    docCharges: 2250,
    savingsAmount: 0,
    totalPayable: 41250,
    tenureWeeks: 15,
    slabs: PRESET_MONTHLY_30K_15M_SLABS,
    schedule: expandSlabsToSchedule(PRESET_MONTHLY_30K_15M_SLABS)
  },
  {
    code: 'MONTHLY_35K_15M',
    name: '₹35,000 Monthly Loan (15 Months)',
    category: 'REGULAR',
    frequency: 'MONTHLY',
    principal: 35000,
    interestAmount: 13150,
    docCharges: 2625,
    savingsAmount: 0,
    totalPayable: 48150,
    tenureWeeks: 15,
    slabs: PRESET_MONTHLY_35K_15M_SLABS,
    schedule: expandSlabsToSchedule(PRESET_MONTHLY_35K_15M_SLABS)
  },
  {
    code: 'MONTHLY_40K_15M',
    name: '₹40,000 Monthly Loan (15 Months)',
    category: 'REGULAR',
    frequency: 'MONTHLY',
    principal: 40000,
    interestAmount: 14750,
    docCharges: 3000,
    savingsAmount: 0,
    totalPayable: 54750,
    tenureWeeks: 15,
    slabs: PRESET_MONTHLY_40K_15M_SLABS,
    schedule: expandSlabsToSchedule(PRESET_MONTHLY_40K_15M_SLABS)
  },
  {
    code: 'MONTHLY_40K_12M',
    name: '₹40,000 Monthly Loan (12 Months)',
    category: 'REGULAR',
    frequency: 'MONTHLY',
    principal: 40000,
    interestAmount: 11960,
    docCharges: 2400,
    savingsAmount: 0,
    totalPayable: 51960,
    tenureWeeks: 12,
    slabs: PRESET_MONTHLY_40K_12M_SLABS,
    schedule: expandSlabsToSchedule(PRESET_MONTHLY_40K_12M_SLABS)
  }
];
