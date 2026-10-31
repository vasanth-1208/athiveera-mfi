import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const query: any = {};
    if (req.user?.role !== 'MAIN_ADMIN') {
      query.branchId = req.user?.branchId;
    } else if (req.query.branchId && req.query.branchId !== 'undefined' && req.query.branchId !== 'null' && req.query.branchId !== '') {
      query.branchId = req.query.branchId;
    }

    if (req.query.role) {
      query.role = req.query.role;
    }

    if (req.query.includeInactive === 'true') {
      if (req.query.active !== undefined) {
        query.active = req.query.active === 'true';
      }
    } else {
      // By default: ONLY active staff are returned anywhere across any tab or dropdown
      query.active = true;
    }

    const users = await User.find(query).select('-passwordHash').populate('branchId').sort({ name: 1 });
    res.json({ success: true, users });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { username, password, name, role, branchId, phone } = req.body;
    if (!username || !password || !name || !role) {
      res.status(400).json({ success: false, message: 'Missing required user fields' });
      return;
    }

    const existing = await User.findOne({ username: username.toLowerCase() });
    if (existing) {
      res.status(400).json({ success: false, message: 'Username already in use' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      username: username.toLowerCase(),
      passwordHash,
      name,
      role,
      branchId: role === 'MAIN_ADMIN' ? null : branchId,
      phone
    });

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        branchId: user.branchId,
        phone: user.phone
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', requireRole('MAIN_ADMIN', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    const existing = await User.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (req.user?.role !== 'MAIN_ADMIN' && String(existing.branchId) !== String(req.user?.branchId)) {
      res.status(403).json({ success: false, message: 'Forbidden: Cannot edit users outside your branch' });
      return;
    }

    const { name, role, branchId, phone, active, password } = req.body;
    const updates: any = {};
    if (name) updates.name = name;
    if (role && req.user?.role === 'MAIN_ADMIN') updates.role = role;
    if (branchId !== undefined && req.user?.role === 'MAIN_ADMIN') updates.branchId = role === 'MAIN_ADMIN' ? null : branchId;
    if (phone !== undefined) updates.phone = phone;
    if (active !== undefined) updates.active = active;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updates.passwordHash = await bcrypt.hash(password, salt);
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-passwordHash');

    res.json({ success: true, user, message: 'Staff profile updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete user (MAIN_ADMIN only)
router.delete('/:id', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.role === 'MAIN_ADMIN') {
      res.status(400).json({ success: false, message: 'Cannot delete Main Administrator' });
      return;
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `Staff member ${user.name} deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
