import { Router, Request, Response } from 'express';
import { Enquiry, IEnquiryMemberKYC } from '../models/Enquiry';
import { authenticate } from '../middleware/auth';
import { enforceBranchScope, requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);
router.use(enforceBranchScope);

// List enquiries
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const query: any = {};

    // Branch scoping
    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    }

    // Role-specific view: Collection staff can see their own enquiries or branch enquiries
    if (req.user?.role === 'COLLECTION_STAFF') {
      // Show enquiries created by this staff member
      const staffId = req.user?.id || req.user?._id;
      query.staffId = staffId;
    }

    if (status && status !== 'ALL') {
      query.status = status;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      query.$or = [
        { enquiryNo: { $regex: term, $options: 'i' } },
        { name: { $regex: term, $options: 'i' } },
        { place: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } }
      ];
    }

    const p = parseInt(String(page));
    const l = parseInt(String(limit));
    const total = await Enquiry.countDocuments(query);

    const enquiries = await Enquiry.find(query)
      .populate('branchId', 'name code')
      .populate('staffId', 'name username phone')
      .populate('reviewedById', 'name username')
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l);

    res.json({
      success: true,
      enquiries,
      pagination: {
        page: p,
        limit: l,
        total,
        pages: Math.ceil(total / l)
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Create new enquiry (Collection Staff, Manager, Admin)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { place, membersCount, name, phone, amount, remarks } = req.body;

    if (!place || !membersCount || !name || !amount) {
      res.status(400).json({
        success: false,
        message: 'Place, members count, customer name, and requested amount are required'
      });
      return;
    }

    const branchId = req.user?.branchId;
    if (!branchId) {
      res.status(400).json({ success: false, message: 'User must belong to a branch to create enquiries' });
      return;
    }

    const staffId = req.user?.id || req.user?._id;
    const staffName = req.user?.name || req.user?.username || 'Field Staff';

    const count = (await Enquiry.countDocuments()) + 1;
    const dateStr = new Date().toISOString().slice(2, 7).replace('-', '');
    const enquiryNo = `ENQ-${dateStr}-${String(count).padStart(4, '0')}`;

    const enquiry = await Enquiry.create({
      enquiryNo,
      place: String(place).trim(),
      membersCount: parseInt(String(membersCount)),
      name: String(name).trim(),
      phone: phone ? String(phone).trim() : '',
      amount: parseFloat(String(amount)),
      remarks: remarks ? String(remarks).trim() : '',
      branchId,
      staffId,
      staffName,
      status: 'PENDING'
    });

    res.status(201).json({
      success: true,
      enquiry,
      message: 'Loan enquiry submitted successfully. Manager visit will be scheduled.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Manager Review / Record Visit (Approved or Rejected with Remarks)
router.put('/:id/review', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const { status, managerRemarks } = req.body;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      res.status(400).json({
        success: false,
        message: 'Valid status (APPROVED or REJECTED) is required'
      });
      return;
    }

    if (!managerRemarks || !String(managerRemarks).trim()) {
      res.status(400).json({
        success: false,
        message: 'Manager remarks are required when recording a visit decision'
      });
      return;
    }

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      res.status(404).json({ success: false, message: 'Enquiry not found' });
      return;
    }

    const reviewerId = req.user?.id || req.user?._id;
    const reviewerName = req.user?.name || req.user?.username || 'Manager';

    enquiry.status = status;
    enquiry.managerRemarks = String(managerRemarks).trim();
    enquiry.reviewedById = reviewerId as any;
    enquiry.reviewedByName = reviewerName;
    enquiry.reviewedAt = new Date();

    await enquiry.save();

    res.json({
      success: true,
      enquiry,
      message: `Enquiry successfully marked as ${status} with manager visit remarks.`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/enquiries/:id/member-kyc - Save field verification for an individual member (supports house-by-house visits)
router.post('/:id/member-kyc', async (req: Request, res: Response) => {
  try {
    const {
      memberIndex,
      memberName,
      spouseName,
      nomineeName,
      nomineeRelationship,
      phone,
      smartCardNumber,
      aadharNumber,
      voterIdNumber,
      panNumber,
      remarks,
      totalGroupMembers
    } = req.body;

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      res.status(404).json({ success: false, message: 'Enquiry not found' });
      return;
    }

    if (enquiry.status !== 'APPROVED' && enquiry.status !== 'KYC_SUBMITTED') {
      res.status(400).json({
        success: false,
        message: 'KYC details can only be entered after the manager has visited and approved the loan enquiry.'
      });
      return;
    }

    const currentUserId = req.user?.id || req.user?._id;
    const creatorStaffId = (enquiry.staffId as any)?._id || enquiry.staffId;
    if (req.user?.role === 'COLLECTION_STAFF' && String(creatorStaffId) !== String(currentUserId)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only the field staff who logged/created this enquiry can enter KYC details.'
      });
      return;
    }

    // Validate mandatory identification for this member
    if (!memberName || !String(memberName).trim()) {
      res.status(400).json({ success: false, message: 'Member Full Name is required.' });
      return;
    }
    if (!spouseName || !String(spouseName).trim()) {
      res.status(400).json({ success: false, message: 'Spouse / Husband / Father Name is required.' });
      return;
    }
    if (!nomineeName || !String(nomineeName).trim()) {
      res.status(400).json({ success: false, message: 'Nominee Full Name is required.' });
      return;
    }
    if (!smartCardNumber || !String(smartCardNumber).trim()) {
      res.status(400).json({ success: false, message: 'Smart Card Number is required.' });
      return;
    }
    if (!aadharNumber || !String(aadharNumber).trim()) {
      res.status(400).json({ success: false, message: 'Aadhaar Number is required.' });
      return;
    }
    if (!voterIdNumber || !String(voterIdNumber).trim()) {
      res.status(400).json({ success: false, message: 'Voter ID Number is required.' });
      return;
    }
    if (!panNumber || !String(panNumber).trim()) {
      res.status(400).json({ success: false, message: 'PAN Card Number is required.' });
      return;
    }

    const idx = Number(memberIndex) || 1;
    const memberData: IEnquiryMemberKYC = {
      memberIndex: idx,
      memberName: String(memberName).trim(),
      spouseName: String(spouseName).trim(),
      nomineeName: String(nomineeName).trim(),
      nomineeRelationship: nomineeRelationship ? String(nomineeRelationship).trim() : 'Spouse',
      phone: phone ? String(phone).trim() : '',
      smartCardNumber: String(smartCardNumber).trim(),
      aadharNumber: String(aadharNumber).trim(),
      voterIdNumber: String(voterIdNumber).trim(),
      panNumber: String(panNumber).trim().toUpperCase()
    };

    if (!enquiry.kyc) {
      enquiry.kyc = {
        members: [],
        smartCardNumber: '',
        aadharNumber: '',
        voterIdNumber: '',
        panNumber: '',
        remarks: '',
        submittedAt: new Date(),
        submittedById: currentUserId as any,
        submittedByName: req.user?.name || req.user?.username || 'Field Staff'
      };
    }

    let existingMembers = enquiry.kyc.members ? [...enquiry.kyc.members] : [];
    const existingIndex = existingMembers.findIndex(m => m.memberIndex === idx);
    if (existingIndex >= 0) {
      existingMembers[existingIndex] = memberData;
    } else {
      existingMembers.push(memberData);
    }

    existingMembers.sort((a, b) => a.memberIndex - b.memberIndex);
    enquiry.kyc.members = existingMembers;

    // If totalGroupMembers was provided, keep enquiry.membersCount synchronized
    if (totalGroupMembers && Number(totalGroupMembers) > 0) {
      const newTotal = Number(totalGroupMembers);
      enquiry.membersCount = newTotal;
      if (existingMembers.length > newTotal) {
        existingMembers = existingMembers.slice(0, newTotal);
        enquiry.kyc.members = existingMembers;
      }
    }

    if (idx === 1 || !enquiry.kyc.smartCardNumber) {
      enquiry.kyc.smartCardNumber = memberData.smartCardNumber;
      enquiry.kyc.aadharNumber = memberData.aadharNumber;
      enquiry.kyc.voterIdNumber = memberData.voterIdNumber;
      enquiry.kyc.panNumber = memberData.panNumber;
    }
    if (remarks) {
      enquiry.kyc.remarks = String(remarks).trim();
    }
    enquiry.kyc.submittedAt = new Date();
    enquiry.kyc.submittedById = currentUserId as any;
    enquiry.kyc.submittedByName = req.user?.name || req.user?.username || 'Field Staff';

    // Verification check: Only after updating all members does it show verified!
    const targetCount = enquiry.membersCount || 1;
    const verifiedMembers = existingMembers.filter(m =>
      m.memberName && m.smartCardNumber && m.aadharNumber && m.voterIdNumber && m.panNumber
    );

    const isAllCompleted = verifiedMembers.length >= targetCount;

    if (isAllCompleted) {
      enquiry.status = 'KYC_SUBMITTED';
    } else {
      // Remain in APPROVED status until all members are verified
      enquiry.status = 'APPROVED';
    }

    await enquiry.save();

    res.json({
      success: true,
      enquiry,
      savedMemberIndex: idx,
      verifiedCount: verifiedMembers.length,
      targetCount,
      isAllCompleted,
      message: isAllCompleted
        ? `All ${targetCount} group members successfully verified! Group KYC completed.`
        : `Member #${idx} (${memberData.memberName}) verified & saved. (${verifiedMembers.length} of ${targetCount} members completed)`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/enquiries/:id/member/:memberIndex - Remove a member from the group KYC
router.delete('/:id/member/:memberIndex', async (req: Request, res: Response) => {
  try {
    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      res.status(404).json({ success: false, message: 'Enquiry not found' });
      return;
    }

    const currentUserId = req.user?.id || req.user?._id;
    const creatorStaffId = (enquiry.staffId as any)?._id || enquiry.staffId;
    if (req.user?.role === 'COLLECTION_STAFF' && String(creatorStaffId) !== String(currentUserId)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only the field staff who logged/created this enquiry can modify members.'
      });
      return;
    }

    const memberIdx = Number(req.params.memberIndex);
    let remainingMembers: any[] = [];
    if (enquiry.kyc && Array.isArray(enquiry.kyc.members)) {
      const plainMembers = enquiry.kyc.members.map((m: any) => (m.toObject ? m.toObject() : m));
      remainingMembers = plainMembers.filter((m: any) => m.memberIndex !== memberIdx);
      if (remainingMembers.length === plainMembers.length && memberIdx >= 1 && memberIdx <= plainMembers.length) {
        remainingMembers = plainMembers.filter((_: any, i: number) => i + 1 !== memberIdx);
      }
      remainingMembers = remainingMembers.map((m, i) => ({
        ...m,
        memberIndex: i + 1
      }));
      enquiry.kyc.members = remainingMembers;
    }

    enquiry.membersCount = Math.max(1, (enquiry.membersCount || 1) - 1);
    if (remainingMembers.length > 0) {
      enquiry.membersCount = Math.max(1, remainingMembers.length);
      enquiry.kyc!.smartCardNumber = remainingMembers[0].smartCardNumber || '';
      enquiry.kyc!.aadharNumber = remainingMembers[0].aadharNumber || '';
      enquiry.kyc!.voterIdNumber = remainingMembers[0].voterIdNumber || '';
      enquiry.kyc!.panNumber = remainingMembers[0].panNumber || '';
    }

    // Check if all remaining members are verified
    const verifiedMembers = remainingMembers.filter(m =>
      m.memberName && m.smartCardNumber && m.aadharNumber && m.voterIdNumber && m.panNumber
    );
    const isAllCompleted = verifiedMembers.length >= enquiry.membersCount && remainingMembers.length > 0;

    if (isAllCompleted) {
      enquiry.status = 'KYC_SUBMITTED';
    } else {
      enquiry.status = 'APPROVED';
    }

    await enquiry.save();

    res.json({
      success: true,
      enquiry,
      remainingCount: enquiry.membersCount,
      verifiedCount: verifiedMembers.length,
      isAllCompleted,
      message: isAllCompleted
        ? `Member removed. All remaining ${enquiry.membersCount} member(s) are verified! Group KYC completed.`
        : `Member removed. Group now has ${enquiry.membersCount} member(s) (${verifiedMembers.length} verified).`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/enquiries/:id/kyc - Collection Staff / Creator submits borrower KYC (bulk update)
router.post('/:id/kyc', async (req: Request, res: Response) => {
  try {
    const { members, smartCardNumber, aadharNumber, voterIdNumber, panNumber, remarks } = req.body;

    const enquiry = await Enquiry.findById(req.params.id);
    if (!enquiry) {
      res.status(404).json({ success: false, message: 'Enquiry not found' });
      return;
    }

    // Ensure manager has visited and approved before KYC details can be entered
    if (enquiry.status !== 'APPROVED' && enquiry.status !== 'KYC_SUBMITTED') {
      res.status(400).json({
        success: false,
        message: 'KYC details can only be entered after the manager has visited and approved the loan enquiry.'
      });
      return;
    }

    const currentUserId = req.user?.id || req.user?._id;
    // Check if collection staff is the one who logged/created this enquiry or manager/admin
    const creatorStaffId = (enquiry.staffId as any)?._id || enquiry.staffId;
    if (req.user?.role === 'COLLECTION_STAFF' && String(creatorStaffId) !== String(currentUserId)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: Only the field staff who logged/created this enquiry can enter KYC details.'
      });
      return;
    }

    let parsedMembers: any[] = [];
    if (Array.isArray(members) && members.length > 0) {
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (!m.memberName || !m.smartCardNumber || !m.aadharNumber || !m.voterIdNumber || !m.panNumber) {
          res.status(400).json({
            success: false,
            message: `Member #${i + 1} (${m.memberName || 'Unnamed'}): Member Name, Smart Card, Aadhaar, Voter ID, and PAN are mandatory.`
          });
          return;
        }

        parsedMembers.push({
          memberIndex: m.memberIndex || (i + 1),
          memberName: String(m.memberName).trim(),
          spouseName: m.spouseName ? String(m.spouseName).trim() : '',
          nomineeName: m.nomineeName ? String(m.nomineeName).trim() : '',
          nomineeRelationship: m.nomineeRelationship ? String(m.nomineeRelationship).trim() : 'Spouse',
          phone: m.phone ? String(m.phone).trim() : '',
          smartCardNumber: String(m.smartCardNumber).trim(),
          aadharNumber: String(m.aadharNumber).trim(),
          voterIdNumber: String(m.voterIdNumber).trim(),
          panNumber: String(m.panNumber).trim().toUpperCase()
        });
      }
    } else {
      // Fallback for single-member payload
      if (!smartCardNumber || !aadharNumber || !voterIdNumber || !panNumber) {
        res.status(400).json({
          success: false,
          message: 'All 4 KYC identification details are mandatory: Smart Card No, Aadhaar No, Voter ID No, and PAN No.'
        });
        return;
      }
      parsedMembers.push({
        memberIndex: 1,
        memberName: enquiry.name,
        spouseName: '',
        nomineeName: '',
        nomineeRelationship: 'Spouse',
        phone: enquiry.phone || '',
        smartCardNumber: String(smartCardNumber).trim(),
        aadharNumber: String(aadharNumber).trim(),
        voterIdNumber: String(voterIdNumber).trim(),
        panNumber: String(panNumber).trim().toUpperCase()
      });
    }

    const primaryMember = parsedMembers[0] || {};

    enquiry.kyc = {
      members: parsedMembers,
      smartCardNumber: primaryMember.smartCardNumber || '',
      aadharNumber: primaryMember.aadharNumber || '',
      voterIdNumber: primaryMember.voterIdNumber || '',
      panNumber: primaryMember.panNumber || '',
      remarks: remarks ? String(remarks).trim() : '',
      submittedAt: new Date(),
      submittedById: currentUserId as any,
      submittedByName: req.user?.name || req.user?.username || 'Field Staff'
    };

    // If members were deleted/reduced, sync enquiry.membersCount with remaining active members
    if (Array.isArray(members) && parsedMembers.length > 0) {
      enquiry.membersCount = parsedMembers.length;
    }

    const targetCount = enquiry.membersCount || 1;
    const isAllCompleted = !Array.isArray(members) || (parsedMembers.length >= targetCount);

    if (isAllCompleted) {
      enquiry.status = 'KYC_SUBMITTED';
    } else {
      enquiry.status = 'APPROVED';
    }

    await enquiry.save();

    res.json({
      success: true,
      enquiry,
      verifiedCount: parsedMembers.length,
      targetCount,
      isAllCompleted,
      message: isAllCompleted
        ? `KYC verification for all ${parsedMembers.length} member(s) submitted successfully.`
        : `KYC for ${parsedMembers.length} member(s) saved (${parsedMembers.length} of ${targetCount} completed).`
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete enquiry (Admin / Manager)
router.delete('/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) {
      res.status(404).json({ success: false, message: 'Enquiry not found' });
      return;
    }
    res.json({ success: true, message: 'Enquiry deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
