import { Router, Request, Response } from 'express';
import { AuditLog } from '../models/AuditLog';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);

router.get('/', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { entityType, page = 1, limit = 50 } = req.query;
    const query: any = {};
    if (entityType) query.entityType = entityType;

    const p = parseInt(String(page));
    const l = parseInt(String(limit));
    const total = await AuditLog.countDocuments(query);

    const logs = await AuditLog.find(query)
      .populate('userId', 'name username role')
      .populate('branchId', 'name code')
      .sort({ timestamp: -1 })
      .skip((p - 1) * l)
      .limit(l);

    res.json({
      success: true,
      logs,
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

export default router;
