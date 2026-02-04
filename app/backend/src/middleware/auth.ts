/**
 * Authentication Middleware
 * Uses Supabase JWT tokens for authentication
 */

import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        organizationId?: string;
        role?: string;
      };
    }
  }
}

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:3001';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn('Invalid token', { error });
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', user.id)
      .single();

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email || '',
      organizationId: orgMember?.organization_id,
      role: orgMember?.role
    };

    next();

  } catch (error) {
    logger.error('Auth middleware error', { error });
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Optional auth - doesn't require token but attaches user if present
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const { data: { user } } = await supabase.auth.getUser(token);

    if (user) {
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .single();

      req.user = {
        id: user.id,
        email: user.email || '',
        organizationId: orgMember?.organization_id,
        role: orgMember?.role
      };
    }

    next();

  } catch (error) {
    // Continue without auth
    next();
  }
};

// Role-based authorization
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role || '')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
