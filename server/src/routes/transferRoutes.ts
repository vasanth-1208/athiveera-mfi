import { Router, Request, Response } from 'express';
import { BranchTransfer } from '../models/BranchTransfer';
import { recordBranchTransferTransactions } from '../services/cashbookService';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);
router.use(requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'));

router.get('/', async (req: Request, res: Response) => {
  try {
    const { branchId } = req.query;
    const query: any = {};
    if (req.user?.role !== 'MAIN_ADMIN') {
      query.$or = [
        { sourceBranchId: req.user?.branchId },
        { destinationBranchId: req.user?.branchId }
      ];
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.$or = [
        { sourceBranchId: branchId },
        { destinationBranchId: branchId }
      ];
    }

    const transfers = await BranchTransfer.find(query)
      .populate('sourceBranchId', 'name code')
      .populate('destinationBranchId', 'name code')
      .populate('createdById', 'name username')
      .sort({ transferDate: -1 });

    res.json({ success: true, transfers });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { sourceBranchId, destinationBranchId, amount, accountType = 'CASH', purpose, transferDate } = req.body;
    const transferAmt = parseFloat(amount);

    if (!sourceBranchId || !destinationBranchId || isNaN(transferAmt) || transferAmt <= 0) {
      res.status(400).json({ success: false, message: 'Valid source, destination, and amount are required' });
      return;
    }

    if (String(sourceBranchId) === String(destinationBranchId)) {
      res.status(400).json({ success: false, message: 'Source and destination branches must be different' });
      return;
    }

    // Branch authorization check
    if (req.user?.role !== 'MAIN_ADMIN' && String(sourceBranchId) !== String(req.user?.branchId)) {
      res.status(403).json({ success: false, message: 'You can only initiate transfers from your assigned branch' });
      return;
    }

    const count = (await BranchTransfer.countDocuments()) + 1;
    const transferNumber = `ATH-TRF-${String(count).padStart(5, '0')}`;

    const transfer = await BranchTransfer.create({
      transferNumber,
      sourceBranchId,
      destinationBranchId,
      transferDate: transferDate ? new Date(transferDate) : new Date(),
      amount: transferAmt,
      accountType,
      purpose: purpose || 'Inter-branch cash settlement',
      status: 'COMPLETED',
      createdById: req.user?.id
    });

    // Execute linked double-entry cashbook movement
    await recordBranchTransferTransactions(
      sourceBranchId,
      destinationBranchId,
      transferAmt,
      accountType,
      transfer._id,
      req.user?.id || null,
      purpose || 'Inter-branch transfer'
    );

    res.status(201).json({ success: true, transfer, message: 'Branch transfer completed with dual ledger entries' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
