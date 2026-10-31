import { Router, Request, Response } from 'express';
import { LoanTier, expandSlabsToSchedule, IAmortizationSlab } from '../models/LoanTier';
import { LOAN_PRODUCT_PRESETS } from '../constants/loanProducts';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();
router.use(authenticate);

// Auto-seed helper: ensure all default weekly and monthly tiers exist
async function ensureDefaultTiers() {
  const oldCodes = ['MONTHLY_10K_5M', 'MONTHLY_20K_10M', 'MONTHLY_25K_10M', 'MONTHLY_30K_10M', 'MONTHLY_50K_10M'];
  await LoanTier.deleteMany({ code: { $in: oldCodes } });

  for (let idx = 0; idx < LOAN_PRODUCT_PRESETS.length; idx++) {
    const p = LOAN_PRODUCT_PRESETS[idx];
    const exists = await LoanTier.findOne({ code: p.code });
    if (!exists) {
      await LoanTier.create({
        code: p.code,
        name: p.name,
        category: p.category,
        frequency: p.frequency,
        principal: p.principal,
        interestAmount: p.interestAmount,
        docCharges: p.docCharges,
        savingsAmount: p.savingsAmount,
        totalPayable: p.totalPayable,
        tenureWeeks: p.tenureWeeks,
        slabs: p.slabs,
        schedule: p.schedule,
        isActive: true,
        sortOrder: idx + 1
      });
    }
  }
}

// GET /api/loan-tiers - Fetch all configured loan product tiers
router.get('/', async (req: Request, res: Response) => {
  try {
    await ensureDefaultTiers();
    const tiers = await LoanTier.find().sort({ sortOrder: 1, principal: 1 });
    res.json({
      success: true,
      tiers,
      presets: tiers // compatible alias for existing components
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/loan-tiers - Create a new loan product tier
router.post('/', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const {
      code,
      name,
      category = 'REGULAR',
      frequency = 'WEEKLY',
      principal,
      docCharges = 0,
      slabs = [],
      sortOrder = 99
    } = req.body;

    if (!code || !name || !principal || !slabs || slabs.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Code, Name, Principal amount, and Amortization Slabs are required.'
      });
      return;
    }

    const cleanCode = String(code).trim().toUpperCase();
    const existing = await LoanTier.findOne({ code: cleanCode });
    if (existing) {
      res.status(400).json({ success: false, message: `Tier with code '${cleanCode}' already exists.` });
      return;
    }

    // Expand slabs to weekly schedule and calculate financial totals
    const schedule = expandSlabsToSchedule(slabs);
    const tenureWeeks = schedule.length;
    const totalPrincipal = schedule.reduce((sum, item) => sum + (Number(item.principal) || 0), 0);
    const totalInterest = schedule.reduce((sum, item) => sum + (Number(item.interest) || 0), 0);
    const totalSavings = schedule.reduce((sum, item) => sum + (Number(item.savings) || 0), 0);
    const totalPayable = schedule.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

    const newTier = await LoanTier.create({
      code: cleanCode,
      name: name.trim(),
      category,
      frequency,
      principal: Number(principal),
      interestAmount: totalInterest,
      docCharges: Number(docCharges),
      savingsAmount: totalSavings,
      totalPayable,
      tenureWeeks,
      slabs,
      schedule,
      isActive: true,
      sortOrder: Number(sortOrder) || 99
    });

    res.status(201).json({
      success: true,
      message: 'Loan tier created successfully',
      tier: newTier
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/loan-tiers/:id - Modify an existing loan product tier
router.put('/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      name,
      category,
      frequency,
      principal,
      docCharges,
      slabs,
      isActive,
      sortOrder
    } = req.body;

    const tier = await LoanTier.findById(id);
    if (!tier) {
      res.status(404).json({ success: false, message: 'Loan tier not found' });
      return;
    }

    if (name) tier.name = name.trim();
    if (category) tier.category = category;
    if (frequency) tier.frequency = frequency;
    if (principal !== undefined) tier.principal = Number(principal);
    if (docCharges !== undefined) tier.docCharges = Number(docCharges);
    if (isActive !== undefined) tier.isActive = Boolean(isActive);
    if (sortOrder !== undefined) tier.sortOrder = Number(sortOrder);

    if (slabs && Array.isArray(slabs) && slabs.length > 0) {
      tier.slabs = slabs;
      const schedule = expandSlabsToSchedule(slabs);
      tier.schedule = schedule;
      tier.tenureWeeks = schedule.length;
      tier.interestAmount = schedule.reduce((sum, item) => sum + (Number(item.interest) || 0), 0);
      tier.savingsAmount = schedule.reduce((sum, item) => sum + (Number(item.savings) || 0), 0);
      tier.totalPayable = schedule.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    }

    await tier.save();

    res.json({
      success: true,
      message: 'Loan tier updated successfully. New loans created under this tier will reflect these values.',
      tier
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/loan-tiers/:id - Delete a loan tier
router.delete('/:id', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tier = await LoanTier.findByIdAndDelete(id);
    if (!tier) {
      res.status(404).json({ success: false, message: 'Loan tier not found' });
      return;
    }

    res.json({ success: true, message: 'Loan tier deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/loan-tiers/reset-canonical - Reset all tiers to master NEW LOAN INT.xlsx specs
router.post('/reset-canonical', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    await LoanTier.deleteMany({});
    const docs = LOAN_PRODUCT_PRESETS.map((p, idx) => ({
      code: p.code,
      name: p.name,
      category: p.category,
      frequency: p.frequency,
      principal: p.principal,
      interestAmount: p.interestAmount,
      docCharges: p.docCharges,
      savingsAmount: p.savingsAmount,
      totalPayable: p.totalPayable,
      tenureWeeks: p.tenureWeeks,
      slabs: p.slabs,
      schedule: p.schedule,
      isActive: true,
      sortOrder: idx + 1
    }));
    await LoanTier.insertMany(docs);

    const tiers = await LoanTier.find().sort({ sortOrder: 1, principal: 1 });
    res.json({
      success: true,
      message: 'All loan tiers reset to canonical NEW LOAN INT.xlsx specifications.',
      tiers
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
