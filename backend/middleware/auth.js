import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function requireAuth(req, res, next){
  try{
    const auth = req.headers.authorization || req.headers.Authorization;
    if(!auth) return res.status(401).json({ msg: 'No autorizado', code: 'NO_TOKEN' });
    const parts = auth.split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
    console.log('🔐 requireAuth - Verificando token...');
    console.log('   Secret usado:', secret);
    console.log('   Token (primeros 50 caracteres):', token.substring(0, 50) + '...');
    const payload = jwt.verify(token, secret);
    console.log('   ✅ Token válido para usuario ID:', payload.id);
    const user = await User.findById(payload.id);
    if(!user) return res.status(401).json({ msg: 'Usuario no encontrado', code: 'USER_NOT_FOUND' });
    if(!user.isActive) return res.status(403).json({ msg: 'Cuenta deshabilitada', code: 'ACCOUNT_DISABLED' });
    req.user = user;
    next();
  }catch(err){
    console.error('requireAuth error', err.name);
    if(err.name === 'TokenExpiredError'){
      return res.status(401).json({ msg: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', code: 'TOKEN_EXPIRED', expiredAt: err.expiredAt });
    }
    if(err.name === 'JsonWebTokenError'){
      return res.status(401).json({ msg: 'Token inválido', code: 'INVALID_TOKEN' });
    }
    return res.status(401).json({ msg: 'Error de autenticación', code: 'AUTH_ERROR' });
  }
}

export function requireRole(role){
  return function(req, res, next){
    try{
      if(!req.user) return res.status(401).json({ msg: 'No autorizado' });
      if(req.user.role !== role && req.user.role !== 'admin') return res.status(403).json({ msg: 'Se requiere rol '+role });
      next();
    }catch(err){ next(err); }
  };
}
