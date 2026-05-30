import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '../enums/role.enum';

// Secret key configuration
export const JWT_SECRET = process.env.JWT_SECRET || 'lms_super_secret_jwt_key_2026';

// Fully typed payload expected inside JWT
export interface UserPayload {
  id: string;
  email: string;
  role: Role;
}

// Custom interface extending standard Express Request
export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
}

/**
 * Authentication Middleware
 * Validates the Authorization header's Bearer JWT.
 * Attaches the decoded user profile data (ID, Email, Role) directly to `req.user`.
 */
export function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];
  
  // Format expectation: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({
      success: false,
      error: 'Authentication Required: Access token is missing from the request header.'
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserPayload;
    req.user = decoded;
    return next();
  } catch (error: any) {
    res.status(403).json({
      success: false,
      error: 'Access Denied: The provided access token is expired or invalid.',
      details: error.message
    });
    return;
  }
}

/**
 * Role-Based Access Control (RBAC) Middleware
 * Higher-order middleware function to verify that the client has the required system permissions.
 * 
 * @param allowedRoles Array of Role enums permitted to access this endpoint
 */
export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // 1. Ensure the user was authenticated
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication Required: No user metadata associated with this request.'
      });
      return;
    }

    // 2. Perform Role Authorization checks
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden: You do not possess the required security permissions to access this route.',
        details: {
          yourRole: req.user.role,
          authorizedRoles: allowedRoles
        }
      });
      return;
    }

    // 3. User possesses an authorized role; proceed to controller
    return next();
  };
}
