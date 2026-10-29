import { Router, Request, Response } from 'express';
import { Expense } from '../models/Expense';
import { Settings } from '../models/Settings';
import { User } from '../models/User';
import { recordCashbookEntry } from '../services/cashbookService';
import { authenticate } from '../middleware/auth';
import { enforceBranchScope, requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);
router.use(requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'));

router.get('/', async (req: Request, res: Response) => {
  try {
    const { branchId, category, startDate, endDate, status } = req.query;
    const query: any = {};

    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    if (category) query.category = category;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.expenseDate = {};
      if (startDate) query.expenseDate.$gte = new Date(String(startDate));
      if (endDate) query.expenseDate.$lte = new Date(String(endDate));
    }

    const expenses = await Expense.find(query)
      .populate('branchId', 'name code')
      .populate('staffId', 'name username')
      .populate('approvedById', 'name')
      .sort({ expenseDate: -1 });

    const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({ success: true, expenses, totalAmount });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create operating expense or travel KM claim
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      amount,
      description,
      billRef,
      isTravelKM,
      travelKM,
      fuelRate: customFuelRate,
      staffId,
      staffName: customStaffName,
      paymentMethod = 'CASH',
      expenseDate
    } = req.body;
    const branchId = req.user?.role === 'MAIN_ADMIN' ? (req.body.branchId || req.user?.branchId) : req.user?.branchId;

    if (!branchId || !category) {
      res.status(400).json({ success: false, message: 'Branch and category are required' });
      return;
    }

    let fuelRate = parseFloat(customFuelRate) || 2.16;
    let finalAmount = parseFloat(amount);

    if (isTravelKM || category.toUpperCase().includes('PETROL') || category.toUpperCase().includes('TRAVEL')) {
      if (isNaN(finalAmount) || finalAmount <= 0) {
        if (travelKM) {
          finalAmount = Math.round(parseFloat(travelKM) * fuelRate);
        }
      }
    }

    if (isNaN(finalAmount) || finalAmount <= 0) {
      res.status(400).json({ success: false, message: 'Expense amount must be greater than zero' });
      return;
    }

    // Determine staff assignment
    let assignedStaffId = req.user?.id || null;
    let assignedStaffName = req.user?.name || '';

    if (staffId && staffId !== 'undefined' && staffId !== 'null' && staffId !== '') {
      assignedStaffId = staffId;
      if (customStaffName) {
        assignedStaffName = customStaffName;
      } else {
        const u = await User.findById(staffId);
        if (u) assignedStaffName = u.name;
      }
    } else if (customStaffName) {
      assignedStaffName = customStaffName;
    }

    const expense = await Expense.create({
      branchId,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      category: isTravelKM ? 'FUEL EXPENSES' : category,
      amount: finalAmount,
      billRef: billRef || '',
      description: description || '',
      travelKM: travelKM ? parseFloat(travelKM) : 0,
      fuelRate,
      staffId: assignedStaffId,
      staffName: assignedStaffName,
      paymentMethod,
      status: req.user?.role === 'MAIN_ADMIN' || req.user?.role === 'BRANCH_MANAGER' ? 'APPROVED' : 'PENDING',
      approvedById: req.user?.role !== 'COLLECTION_STAFF' ? req.user?.id : null
    });

    // If auto-approved, record cashbook debit
    if (expense.status === 'APPROVED') {
      await recordCashbookEntry({
        branchId,
        transactionDate: expense.expenseDate,
        type: 'DEBIT',
        accountType: paymentMethod,
        category: expense.category,
        amount: expense.amount,
        vNo: billRef || '',
        relatedEntityType: 'EXPENSE',
        relatedEntityId: expense._id,
        description: expense.description || `Expense for ${expense.category}`,
        createdById: req.user?.id
      });
    }

    res.status(201).json({ success: true, expense });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve pending staff expense claim
router.put('/:id/approve', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.status(404).json({ success: false, message: 'Expense not found' });
      return;
    }

    if (expense.status === 'APPROVED') {
      res.status(400).json({ success: false, message: 'Expense already approved' });
      return;
    }

    expense.status = 'APPROVED';
    expense.approvedById = req.user?.id as any;
    await expense.save();

    // Record cashbook entry
    await recordCashbookEntry({
      branchId: expense.branchId,
      transactionDate: expense.expenseDate,
      type: 'DEBIT',
      accountType: expense.paymentMethod,
      category: expense.category,
      amount: expense.amount,
      relatedEntityType: 'EXPENSE',
      relatedEntityId: expense._id,
      description: `Approved expense: ${expense.description}`,
      createdById: req.user?.id
    });

    res.json({ success: true, expense, message: 'Expense approved and cashbook updated' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update expense (Manager & Admin - all fields)
router.put('/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.status(404).json({ success: false, message: 'Expense not found' });
      return;
    }

    if (req.user?.role !== 'MAIN_ADMIN' && String(expense.branchId) !== String(req.user?.branchId)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const { category, amount, billRef, description, travelKM, fuelRate, staffId, staffName, paymentMethod, status } = req.body;
    if (category) expense.category = category;
    if (amount !== undefined) expense.amount = Number(amount);
    if (billRef !== undefined) expense.billRef = billRef;
    if (description !== undefined) expense.description = description;
    if (travelKM !== undefined) expense.travelKM = Number(travelKM);
    if (fuelRate !== undefined) expense.fuelRate = Number(fuelRate);
    if (staffId !== undefined) {
      expense.staffId = staffId || null;
      if (staffName) {
        expense.staffName = staffName;
      } else if (staffId) {
        const u = await User.findById(staffId);
        if (u) expense.staffName = u.name;
      }
    } else if (staffName !== undefined) {
      expense.staffName = staffName;
    }
    if (paymentMethod) expense.paymentMethod = paymentMethod;
    if (status) expense.status = status;

    await expense.save();
    res.json({ success: true, expense, message: 'Expense updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete expense (MAIN_ADMIN only)
router.delete('/:id', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      res.status(404).json({ success: false, message: 'Expense not found' });
      return;
    }

    await Expense.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `Expense of ₹${expense.amount} (${expense.category}) deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
