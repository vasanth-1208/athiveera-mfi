import { Router, Request, Response } from 'express';
import { ImportEngine } from '../services/importService';
import { authenticate } from '../middleware/auth';
import { requireRole } from '../middleware/roles';

const router = Router();

router.use(authenticate);

// Dry-run preview
router.get('/preview', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const engine = new ImportEngine();
    const preview = await engine.preview();
    res.json({ success: true, preview });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Commit historical data migration
router.post('/execute', requireRole('MAIN_ADMIN'), async (req: Request, res: Response) => {
  try {
    const engine = new ImportEngine();
    const result = await engine.execute(req.user?.id || '');
    res.json({
      success: true,
      message: 'Historical data migrated successfully into system database',
      result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
