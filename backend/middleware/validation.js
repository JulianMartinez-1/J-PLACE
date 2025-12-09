import { body, validationResult } from 'express-validator';

// Palabras y patrones sospechosos
const suspiciousPatterns = [
  // Scripts y código malicioso
  /<script[^>]*>.*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // onclick, onerror, etc.
  /<iframe/gi,
  /<object/gi,
  /<embed/gi,
  
  // Phishing común
  /paypal.*verify/gi,
  /suspended.*account/gi,
  /click.*here.*urgent/gi,
  /winner.*prize/gi,
  /claim.*reward/gi,
  
  // Enlaces sospechosos
  /bit\.ly/gi,
  /tinyurl/gi,
  /goo\.gl/gi,
  
  // Spam
  /click\s+here\s+now/gi,
  /limited\s+time\s+offer/gi,
  /act\s+now/gi,
  /100%\s+free/gi,
];

// Palabras prohibidas (contenido inapropiado)
const bannedWords = [
  'drogas', 'armas', 'explosivos', 'pornografia', 'ilegal',
  'estafa', 'fraude', 'robo', 'hackear', 'crack'
];

// Función para detectar contenido malicioso
export function detectMaliciousContent(text) {
  if (!text) return { safe: true };
  
  const lowerText = text.toLowerCase();
  
  // Verificar patrones sospechosos
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: 'Contenido potencialmente malicioso detectado',
        type: 'suspicious_pattern'
      };
    }
  }
  
  // Verificar palabras prohibidas
  for (const word of bannedWords) {
    if (lowerText.includes(word)) {
      return {
        safe: false,
        reason: 'Contenido prohibido detectado',
        type: 'banned_word',
        word: word
      };
    }
  }
  
  // Verificar exceso de enlaces (posible spam)
  const urlCount = (text.match(/https?:\/\//gi) || []).length;
  if (urlCount > 5) {
    return {
      safe: false,
      reason: 'Demasiados enlaces en el contenido',
      type: 'excessive_links'
    };
  }
  
  // Verificar texto excesivamente repetitivo (spam)
  const words = lowerText.split(/\s+/);
  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  for (const word in wordFreq) {
    if (word.length > 3 && wordFreq[word] > words.length * 0.3) {
      return {
        safe: false,
        reason: 'Contenido spam detectado (texto repetitivo)',
        type: 'spam'
      };
    }
  }
  
  return { safe: true };
}

// Middleware para validar productos
export const validateProduct = [
  body('nombre')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('El nombre debe tener entre 3 y 200 caracteres')
    .custom((value) => {
      const check = detectMaliciousContent(value);
      if (!check.safe) {
        throw new Error(check.reason);
      }
      return true;
    }),
  
  body('descripcion')
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('La descripción debe tener entre 20 y 5000 caracteres')
    .custom((value) => {
      const check = detectMaliciousContent(value);
      if (!check.safe) {
        throw new Error(check.reason);
      }
      return true;
    }),
  
  body('precio')
    .isFloat({ min: 0.01, max: 1000000 })
    .withMessage('El precio debe ser un número válido entre 0.01 y 1,000,000'),
  
  body('category')
    .trim()
    .isLength({ min: 2 })
    .withMessage('La categoría es requerida'),
];

// Middleware para validar registro de usuario
export const validateRegister = [
  body('nombre')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres')
    .matches(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)
    .withMessage('El nombre solo puede contener letras'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('La contraseña debe contener al menos una mayúscula, una minúscula y un número'),
];

// Middleware para validar login
export const validateLogin = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Email inválido')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
];

// Middleware para manejar errores de validación
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      msg: 'Errores de validación',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }
  next();
}

// Sanitizar HTML de input
export function sanitizeHtml(text) {
  if (!text) return '';
  
  return text
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
