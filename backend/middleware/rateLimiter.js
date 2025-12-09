import rateLimit from 'express-rate-limit';

// Rate limiter general para API
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por ventana
  message: { msg: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter estricto para login
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos de login
  message: { msg: 'Demasiados intentos de inicio de sesión. Por favor intenta de nuevo en 15 minutos.' },
  skipSuccessfulRequests: true, // No contar solicitudes exitosas
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para registro
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 registros por hora por IP
  message: { msg: 'Demasiadas cuentas creadas desde esta IP. Por favor intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para publicación de productos
export const productPublishLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // máximo 10 productos por hora
  message: { msg: 'Has alcanzado el límite de publicaciones por hora. Por favor intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para recuperación de contraseña
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // máximo 3 solicitudes por hora
  message: { msg: 'Demasiadas solicitudes de recuperación. Por favor intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para contactos y emails
export const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // máximo 5 mensajes por hora
  message: { msg: 'Demasiados mensajes enviados. Por favor intenta más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});
