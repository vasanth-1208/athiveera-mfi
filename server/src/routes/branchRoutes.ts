import { Router, Request, Response } from 'express';
import { Branch } from '../models/Branch';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    let branches;
    if (req.user?.role === 'MAIN_ADMIN') {
      branches = await Branch.find().sort({ createdAt: 1 });
    } else {
      branches = await Branch.find({ _id: req.user?.branchId, active: true });
    }
    res.json({ success: true, branches });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      res.status(404).json({ success: false, message: 'Branch not found' });
      return;
    }
    res.json({ success: true, branch });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { code, name, address, phone } = req.body;
    const branch = await Branch.create({ code, name, address, phone });
    res.status(201).json({ success: true, branch });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update branch (MAIN_ADMIN only)
router.put('/:id', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { code, name, address, phone } = req.body;
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      res.status(404).json({ success: false, message: 'Branch not found' });
      return;
    }

    if (code) branch.code = code;
    if (name) branch.name = name;
    if (address !== undefined) branch.address = address;
    if (phone !== undefined) branch.phone = phone;

    await branch.save();
    res.json({ success: true, branch, message: 'Branch updated successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete branch (MAIN_ADMIN only)
router.delete('/:id', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      res.status(404).json({ success: false, message: 'Branch not found' });
      return;
    }

    await Branch.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: `Branch ${branch.name} (${branch.code}) deleted successfully` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
