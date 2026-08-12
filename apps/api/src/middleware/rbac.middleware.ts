import { Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import type { AuthenticatedRequest } from './auth.middleware';
import type { RoleName } from '@crm/shared';

/** Require one of the specified roles */
export function requireRoles(...roles: RoleName[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError());
      return;
    }
    if (req.user.role === 'SYSTEM_ADMIN') {
      next();
      return;
    }
    if (!roles.includes(req.user.role as RoleName)) {
      next(new ForbiddenError('Insufficient role permissions'));
      return;
    }
    next();
  };
}

/** Require all specified permissions */
export function requirePermissions(...permissions: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError());
      return;
    }
    const hasAll = permissions.every((p) => req.user!.permissions.includes(p));
    if (!hasAll) {
      next(new ForbiddenError('Missing required permissions'));
      return;
    }
    next();
  };
}

/** Require any of the specified permissions */
export function requireAnyPermission(...permissions: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError());
      return;
    }
    const hasAny = permissions.some((p) => req.user!.permissions.includes(p));
    if (!hasAny) {
      next(new ForbiddenError('Missing required permissions'));
      return;
    }
    next();
  };
}
