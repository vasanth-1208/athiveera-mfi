import { Router, Request, Response } from 'express';
import { Group } from '../models/Group';
import { Customer } from '../models/Customer';
import { Loan } from '../models/Loan';
import { authenticate } from '../middleware/auth';
import { enforceBranchScope, requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { collectionDay, status, branchId, search } = req.query;
    const query: any = {};

    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (branchId && branchId !== 'undefined' && branchId !== 'null' && branchId !== '') {
      query.branchId = branchId;
    }

    if (collectionDay) query.collectionDay = collectionDay;
    if (status) query.status = status;
    if (search) query.name = new RegExp(String(search), 'i');

    if (req.user?.role === 'COLLECTION_STAFF') {
      // Hide CLOSED groups for collection staff
      query.status = { $ne: 'CLOSED' };

      // Only show groups assigned to this collection staff member
      const staffId = req.user?.id || req.user?._id;
      const staffUsername = req.user?.username || '';
      const staffName = req.user?.name || '';
      const nameParts = staffName.split(' ').filter(Boolean);
      const nameRegexes = [
        new RegExp(`^${staffUsername}$`, 'i'),
        new RegExp(`^${staffName}$`, 'i'),
        ...nameParts.map(p => new RegExp(`^${p}$`, 'i'))
      ];

      const assignedLoanGroupIds = await Loan.find({
        $or: [
          { assignedStaffId: staffId },
          { assignedStaffName: { $in: nameRegexes } }
        ],
        status: { $in: ['ACTIVE', 'OVERDUE'] }
      }).distinct('groupId');

      query.$or = [
        { staffId: staffId },
        { staffName: { $in: nameRegexes } },
        { _id: { $in: assignedLoanGroupIds } }
      ];
    }

    const groups = await Group.find(query)
      .populate('branchId', 'name code')
      .populate('staffId', 'name')
      .populate('headCustomerId', 'name phone')
      .sort({ groupCode: 1 });

    res.json({ success: true, groups });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('branchId')
      .populate('staffId', 'name')
      .populate('headCustomerId');

    if (!group) {
      res.status(404).json({ success: false, message: 'Group not found' });
      return;
    }

    if (req.user?.role !== 'MAIN_ADMIN' && String(group.branchId._id) !== String(req.user?.branchId)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    // Get loans for this group
    const loans = await Loan.find({ groupId: group._id })
      .populate('customerId')
      .populate('assignedStaffId', 'name')
      .sort({ createdAt: -1 });

    const loanCustomerIds = loans
      .map(l => (l.customerId?._id || l.customerId))
      .filter(Boolean);

    // Get members of this group: all customers with loans in this group OR activeGroupId set to this group
    const members = await Customer.find({
      $or: [
        { _id: { $in: loanCustomerIds } },
        { activeGroupId: group._id }
      ]
    }).sort({ name: 1 });

    // Sync group totalMembers count if necessary
    if (group.totalMembers !== members.length) {
      group.totalMembers = members.length;
      await group.save();
    }

    let totalPrincipal = 0;
    let totalCollected = 0;
    let totalOutstanding = 0;

    loans.forEach(l => {
      totalPrincipal += l.principal;
      totalCollected += l.totalPaid;
      totalOutstanding += l.outstandingTotal;
    });

    res.json({
      success: true,
      group,
      members,
      loans,
      summary: {
        totalMembers: members.length,
        totalLoans: loans.length,
        totalPrincipal,
        totalCollected,
        totalOutstanding
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, collectionDay, area, staffName, headName, headPhone, cycle } = req.body;
    if (!name || !collectionDay) {
      res.status(400).json({ success: false, message: 'Name and collectionDay are required' });
      return;
    }

    const branchId = req.user?.role === 'MAIN_ADMIN' ? (req.body.branchId || req.user?.branchId) : req.user?.branchId;
    if (!branchId) {
      res.status(400).json({ success: false, message: 'Branch ID is required' });
      return;
    }

    const highestGroup = await Group.findOne({ branchId }).sort({ groupCode: -1 });
    const groupCode = highestGroup ? highestGroup.groupCode + 1 : 1;

    const group = await Group.create({
      groupCode,
      name,
      branchId,
      headName: headName || '',
      headPhone: headPhone || '',
      collectionDay,
      area: area || '',
      staffName: staffName || '',
      cycle: cycle || 1,
      status: 'LIVE'
    });

    res.status(201).json({ success: true, group });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ success: false, message: 'Group not found' });
      return;
    }

    if (req.user?.role !== 'MAIN_ADMIN' && String(group.branchId) !== String(req.user?.branchId)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }

    const { name, groupCode, collectionDay, area, staffId, staffName, headName, headPhone, status, cycle } = req.body;
    if (name) group.name = name;
    if (groupCode !== undefined) group.groupCode = Number(groupCode);
    if (collectionDay) group.collectionDay = collectionDay;
    if (area !== undefined) group.area = area;
    if (staffId !== undefined) group.staffId = staffId || null;
    if (staffName !== undefined) group.staffName = staffName;
    if (headName !== undefined) group.headName = headName;
    if (headPhone !== undefined) group.headPhone = headPhone;
    if (status) group.status = status;
    if (cycle !== undefined) group.cycle = Number(cycle);

    await group.save();
    res.json({ success: true, group, message: 'Group details updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete group (MAIN_ADMIN only)
router.delete('/:id', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      res.status(404).json({ success: false, message: 'Group not found' });
      return;
    }

    await Group.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `Group ${group.name} deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
