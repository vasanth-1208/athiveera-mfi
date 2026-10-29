import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';

export function requireRole(...permittedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    if (!permittedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        success: false, 
        message: `Forbidden: Action requires one of [${permittedRoles.join(', ')}] roles` 
      });
      return;
    }

    next();
  };
}

export function enforceBranchScope(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Unauthenticated' });
    return;
  }

  // MAIN_ADMIN has unrestricted branch access across all branches
  if (req.user.role === 'MAIN_ADMIN') {
    next();
    return;
  }

  // Non-admin users must have an assigned branch
  if (!req.user.branchId) {
    res.status(403).json({ success: false, message: 'User is not assigned to any branch' });
    return;
  }

  // Check requested branchId in params, query, or body
  let requestedBranchId = req.params.branchId || req.query.branchId || req.body?.branchId;
  if (requestedBranchId && typeof requestedBranchId === 'object' && ('_id' in requestedBranchId || 'id' in requestedBranchId)) {
    requestedBranchId = requestedBranchId._id || requestedBranchId.id;
  }
  const reqStr = String(requestedBranchId || '').trim();
  const isInvalid = !reqStr || reqStr === '[object Object]' || reqStr === 'undefined' || reqStr === 'null';

  if (!isInvalid && reqStr !== String(req.user.branchId)) {
    res.status(403).json({ 
      success: false, 
      message: 'Forbidden: You do not have permission to access another branch' 
    });
    return;
  }

  // Force branchId to user's assigned branch for security
  if (req.body && typeof req.body === 'object') {
    req.body.branchId = req.user.branchId;
  }
  if (req.query) {
    req.query.branchId = req.user.branchId;
  }

  next();
}
