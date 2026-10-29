import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Branch } from '../models/Branch';
import { Settings } from '../models/Settings';
import { ENV } from '../config/env';
import { authenticate } from '../middleware/auth';

const router = Router();

// Check if system has been initialized with an admin
router.get('/setup-status', async (req: Request, res: Response) => {
  try {
    const adminCount = await User.countDocuments({ role: 'MAIN_ADMIN' });
    const totalUsers = await User.countDocuments();
    const branchCount = await Branch.countDocuments();
    res.json({
      success: true,
      isInitialized: adminCount > 0,
      totalUsers,
      branchCount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Setup initial Main Admin account (only allowed when no MAIN_ADMIN exists)
router.post('/setup-initial', async (req: Request, res: Response) => {
  try {
    const adminCount = await User.countDocuments({ role: 'MAIN_ADMIN' });
    if (adminCount > 0) {
      res.status(403).json({
        success: false,
        message: 'System is already initialized. Additional users must be created by an authenticated administrator.'
      });
      return;
    }

    const { username, password, name, phone, branchCode, branchName } = req.body;
    if (!username || !password || !name) {
      res.status(400).json({ success: false, message: 'Username, password, and full name are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create Main Admin
    const user = await User.create({
      username: username.toLowerCase().trim(),
      passwordHash,
      name: name.trim(),
      role: 'MAIN_ADMIN',
      branchId: null,
      phone: phone ? phone.trim() : ''
    });

    // Optionally create initial branch if specified
    if (branchCode && branchName) {
      const branchExists = await Branch.findOne({ code: branchCode.toUpperCase().trim() });
      if (!branchExists) {
        await Branch.create({
          code: branchCode.toUpperCase().trim(),
          name: branchName.trim(),
          cashBalance: 0,
          bankBalance: 0
        });
      }
    }

    // Ensure default settings exist in DB if not already present
    const settingsExists = await Settings.findOne();
    if (!settingsExists) {
      await Settings.create({
        fuelPricePerLiter: 108,
        fuelMileageKmPerLiter: 50,
        fuelRatePerKm: 2.16,
        docChargesPercent: 6.0,
        earlySettlementTiers: [
          { minWeeks: 0, maxWeeks: 10, interestDiscountPercent: 75, balanceInterestPercent: 25 },
          { minWeeks: 11, maxWeeks: 20, interestDiscountPercent: 50, balanceInterestPercent: 50 },
          { minWeeks: 21, maxWeeks: 30, interestDiscountPercent: 25, balanceInterestPercent: 75 },
          { minWeeks: 31, maxWeeks: 52, interestDiscountPercent: 0, balanceInterestPercent: 100 }
        ]
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        branchId: null
      },
      ENV.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'Initial administrator created successfully',
      token,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        role: user.role,
        phone: user.phone
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, message: 'Username and password are required' });
      return;
    }

    const user = await User.findOne({ username: username.toLowerCase(), active: true }).populate('branchId');
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid username or password' });
      return;
    }

    const branchObj = user.branchId as any;
    const branchIdStr = branchObj ? ((branchObj._id || branchObj).toString()) : null;

    const token = jwt.sign(
      {
        id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        branchId: branchIdStr
      },
      ENV.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        branchId: branchIdStr,
        branch: branchObj && typeof branchObj === 'object' ? branchObj : null,
        phone: user.phone
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.user?.id).select('-passwordHash').populate('branchId');
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const branchObj = user.branchId as any;
    const branchIdStr = branchObj ? ((branchObj._id || branchObj).toString()) : null;
    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        _id: user._id.toString(),
        username: user.username,
        name: user.name,
        role: user.role,
        branchId: branchIdStr,
        branch: branchObj && typeof branchObj === 'object' ? branchObj : null,
        phone: user.phone
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
