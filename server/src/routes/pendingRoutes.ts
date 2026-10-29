import { Router, Request, Response } from 'express';
import { FollowUp } from '../models/FollowUp';
import { Loan } from '../models/Loan';
import { Installment } from '../models/Installment';
import { Customer } from '../models/Customer';
import { Group } from '../models/Group';
import { Payment } from '../models/Payment';
import { recordCashbookEntry } from '../services/cashbookService';
import { getNextReceiptNumber } from '../services/receiptService';
import { getPendingOverdueRegister } from '../services/pendingService';
import { authenticate } from '../middleware/auth';
import { enforceBranchScope } from '../middleware/roles';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

// Get pending overdue register
router.get('/', async (req: Request, res: Response) => {
  try {
    const { weekday, branchId, status = 'PENDING', search } = req.query;

    const targetBranchId = req.user?.role !== 'MAIN_ADMIN'
      ? req.user?.branchId
      : (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '' && branchId !== 'ALL' ? branchId : undefined);

    const { followUps, summary } = await getPendingOverdueRegister({
      branchId: targetBranchId,
      weekday: weekday as string,
      status: status as string,
      search: search as string
    });

    res.json({
      success: true,
      followUps,
      summary
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Record follow-up remark, promise date, payment recovery, and status update
router.post('/follow-up', async (req: Request, res: Response) => {
  try {
    const { id, remarks, nextFollowUpDate, status = 'OVERDUE', actionTaken, amountPaidNow = 0, paymentMethod = 'CASH' } = req.body;
    if (!id || !remarks) {
      res.status(400).json({ success: false, message: 'ID and remarks are required' });
      return;
    }

    let followUp = await FollowUp.findById(id);
    if (!followUp) {
      followUp = await FollowUp.findOne({ $or: [{ loanId: id }, { customerId: id }] });
    }

    let loan: any = null;
    if (followUp?.loanId) {
      loan = await Loan.findById(followUp.loanId).populate('customerId').populate('groupId');
    } else {
      loan = await Loan.findById(id).populate('customerId').populate('groupId');
    }

    if (!followUp && loan) {
      const c: any = loan.customerId;
      const g: any = loan.groupId;
      followUp = new FollowUp({
        loanId: loan._id,
        customerId: c?._id,
        customerName: c?.name || 'Borrower',
        customerPhone: c?.phone || c?.mobileNumber || '',
        groupId: g?._id || loan.groupId,
        groupName: g?.name || 'Group',
        collectionDay: g?.collectionDay || 'TUESDAY',
        actualPending: 0,
        status: 'PENDING',
        history: []
      });
    }

    if (!followUp) {
      res.status(404).json({ success: false, message: 'Follow-up or loan record not found' });
      return;
    }

    const payAmt = Number(amountPaidNow);
    let paymentRecord: any = null;

    if (loan && !isNaN(payAmt) && payAmt > 0) {
      const paymentDate = new Date(); // Physical cash received today

      // Find overdue / pending installments in sequence
      const targetInsts = await Installment.find({
        loanId: loan._id,
        status: { $in: ['OVERDUE', 'PARTIAL', 'PENDING'] }
      }).sort({ installmentNumber: 1 });

      let rem = payAmt;
      const allocations: any[] = [];

      for (const inst of targetInsts) {
        if (rem <= 0) break;
        const due = inst.balanceAmount;
        const alloc = Math.min(rem, due);
        inst.paidAmount += alloc;
        inst.balanceAmount -= alloc;
        rem -= alloc;

        if (inst.balanceAmount <= 0) {
          inst.status = 'PAID';
          inst.paidDate = paymentDate;
        } else {
          inst.status = 'PARTIAL';
        }
        await inst.save();

        allocations.push({
          installmentId: inst._id,
          installmentNumber: inst.installmentNumber,
          amount: alloc
        });
      }

      // Generate unique collision-proof receipt
      const receiptNumber = await getNextReceiptNumber();

      paymentRecord = await Payment.create({
        receiptNumber,
        loanId: loan._id,
        customerId: loan.customerId,
        groupId: loan.groupId,
        branchId: loan.branchId,
        collectorId: req.user?.id,
        paymentDate,
        amount: payAmt,
        paymentMethod,
        remarks: `Delinquency Recovery: ${remarks}`,
        allocations
      });

      // Update loan balance
      loan.totalPaid += payAmt;
      loan.outstandingTotal = Math.max(0, loan.outstandingTotal - payAmt);
      const interestPortion = Math.round((payAmt * loan.interestAmount) / loan.totalPayable);
      const principalPortion = payAmt - interestPortion;
      loan.outstandingInterest = Math.max(0, loan.outstandingInterest - interestPortion);
      loan.outstandingPrincipal = Math.max(0, loan.outstandingPrincipal - principalPortion);

      const remainingOverdueCount = await Installment.countDocuments({
        loanId: loan._id,
        status: 'OVERDUE',
        balanceAmount: { $gt: 0 }
      });

      if (loan.outstandingTotal <= 0) {
        loan.status = 'CLOSED';
        loan.closedDate = paymentDate;
      } else if (remainingOverdueCount === 0) {
        loan.status = 'ACTIVE';
      }
      await loan.save();

      // Record cashbook inflow for TODAY
      await recordCashbookEntry({
        branchId: loan.branchId,
        transactionDate: paymentDate,
        type: 'CREDIT',
        accountType: paymentMethod === 'CASH' ? 'CASH' : 'BANK',
        category: `${followUp.groupName || 'OVERDUE'} RECOVERY RECEIVED`,
        amount: payAmt,
        relatedEntityType: 'COLLECTION',
        relatedEntityId: paymentRecord._id,
        description: `Delinquency recovery receipt ${receiptNumber} (${paymentMethod}). Remarks: ${remarks}`,
        createdById: req.user?.id
      });

      // Reduce follow-up actualPending
      if (followUp.actualPending) {
        followUp.actualPending = Math.max(0, followUp.actualPending - payAmt);
      }
    }

    followUp.remarks = remarks;
    if (nextFollowUpDate) {
      followUp.nextFollowUpDate = new Date(nextFollowUpDate);
    }
    
    // Set status
    if (status === 'RESOLVED' || (followUp.actualPending === 0 && payAmt > 0)) {
      followUp.status = 'RESOLVED';
    } else if (status === 'PARTIAL' || (payAmt > 0 && followUp.actualPending > 0)) {
      followUp.status = 'PARTIAL';
    } else {
      followUp.status = 'PENDING';
    }

    followUp.history.push({
      date: new Date(),
      remarks: remarks + (payAmt > 0 ? ` (Collected ₹${payAmt})` : ''),
      staffName: req.user?.name || 'Staff',
      actionTaken: payAmt > 0 ? `Collected ₹${payAmt} on field recovery` : (actionTaken || 'Follow-up visit')
    });

    await followUp.save();

    res.json({
      success: true,
      followUp,
      payment: paymentRecord,
      message: payAmt > 0 ? `Collected ₹${payAmt} and updated follow-up record` : 'Follow-up remarks saved'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
