import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import { sendMailWithFallback } from "../utils/mail.js";
import { 
  loginLimiter, 
  registerLimiter, 
  passwordResetLimiter 
} from "../middleware/rateLimiter.js";
import { 
  validateRegister, 
  validateLogin, 
  handleValidationErrors 
} from "../middleware/validation.js";

const router = express.Router();

console.log('🔧 Cargando rutas de auth');

// Configuración
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const JWT_EXPIRES_IN = '7d'; // Token expira en 7 días
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 horas de bloqueo

// usamos helper compartido sendMailWithFallback desde utils/mail.js

// Ruta de comprobación rápida
router.get('/ping', (req, res) => {
  return res.json({ ok: true, msg: 'auth routes alive' });
});

// Ruta de registro con rate limiting y validación
router.post("/registro", registerLimiter, validateRegister, handleValidationErrors, async (req, res) => {
  try {
    console.log('🔔 POST /api/auth/registro body:', req.body);
    const { nombre, email, password } = req.body;

    // Validar que no exista el usuario
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ msg: "El usuario ya existe" });

    // Encriptar contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    // Crear nuevo usuario
    const newUser = new User({
      nombre,
      email,
      password: hashedPassword,
      updatedAt: new Date()
    });

    await newUser.save();

    // Responder con usuario mínimo (sin password)
    return res.status(201).json({ 
      msg: "Usuario registrado correctamente. Ya puedes iniciar sesión.", 
      user: { nombre: newUser.nombre, email: newUser.email } 
    });
  } catch (error) {
    console.error('Error en /registro', error);
    res.status(500).json({ msg: "Error en el servidor" });
  }
});

// Ruta de aprobación (link enviado a administradores)
/* La ruta /approve para aprobación de usuarios ha sido removida: ya no hacemos approval de usuarios.
   Los usuarios pueden iniciar sesión inmediatamente tras registrarse. */

// Ruta de login con rate limiting, validación y protección contra fuerza bruta
router.post('/login', loginLimiter, validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔍 Intento de login con email:', email);

    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ Usuario no encontrado en BD:', email);
      return res.status(400).json({ msg: 'Usuario no encontrado' });
    }
    console.log('✅ Usuario encontrado:', user.email, '| Role:', user.role);

    // Verificar si la cuenta está bloqueada
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
      return res.status(423).json({ 
        msg: `Cuenta bloqueada por múltiples intentos fallidos. Intenta de nuevo en ${minutesLeft} minutos.` 
      });
    }

    // Verificar contraseña
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      // Incrementar intentos fallidos
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME);
        await user.save();
        return res.status(423).json({ 
          msg: `Cuenta bloqueada por ${MAX_LOGIN_ATTEMPTS} intentos fallidos. Intenta de nuevo en 2 horas.` 
        });
      }
      
      await user.save();
      const attemptsLeft = MAX_LOGIN_ATTEMPTS - user.loginAttempts;
      return res.status(400).json({ 
        msg: `Contraseña incorrecta. Te quedan ${attemptsLeft} intentos.` 
      });
    }

    // Login exitoso: resetear intentos fallidos
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();
    await user.save();

    // Generar token JWT con expiración de 7 días
    console.log('🔑 Generando token JWT...');
    console.log('   Secret usado:', JWT_SECRET);
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRES_IN }
    );
    console.log('   ✅ Token generado (primeros 50 caracteres):', token.substring(0, 50) + '...');

    // Respuesta: user mínimo + token
    return res.status(200).json({
      msg: 'Autenticación correcta',
      user: { 
        _id: user._id, 
        nombre: user.nombre, 
        email: user.email, 
        role: user.role, 
        isActive: user.isActive 
      },
      token,
      expiresIn: JWT_EXPIRES_IN
    });
  } catch (err) {
    console.error('Error en /login', err);
    res.status(500).json({ msg: 'Error en el servidor' });
  }
});

// Solicitar recuperación de contraseña
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ msg: 'El email es requerido' });
    }

    const user = await User.findOne({ email });
    
    // Por seguridad, siempre respondemos lo mismo aunque el usuario no exista
    if (!user) {
      return res.status(200).json({ 
        msg: 'Si el email existe en nuestra base de datos, recibirás un enlace de recuperación.' 
      });
    }

    // Generar token de recuperación
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save();

    // Enviar email con enlace de recuperación
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:4000'}/reset-password.html?token=${resetToken}`;
    
    const mailOptions = {
      from: process.env.SMTP_USER || 'noreply@jplace.com',
      to: user.email,
      subject: 'Recuperación de Contraseña - J-PLACE',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6366f1;">Recuperación de Contraseña</h2>
          <p>Hola <strong>${user.nombre}</strong>,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña. Si no fuiste tú, puedes ignorar este mensaje.</p>
          <p>Para crear una nueva contraseña, haz clic en el siguiente enlace (válido por 1 hora):</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Restablecer Contraseña
          </a>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p style="color: #666; word-break: break-all;">${resetUrl}</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px;">Este es un mensaje automático, por favor no respondas a este correo.</p>
        </div>
      `
    };

    await sendMailWithFallback(mailOptions);

    res.status(200).json({ 
      msg: 'Si el email existe en nuestra base de datos, recibirás un enlace de recuperación.' 
    });
  } catch (error) {
    console.error('Error en /forgot-password', error);
    res.status(500).json({ msg: 'Error al procesar la solicitud' });
  }
});

// Restablecer contraseña con token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ 
        msg: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    // Hashear el token para compararlo con el almacenado
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Buscar usuario con token válido y no expirado
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        msg: 'Token inválido o expirado. Solicita un nuevo enlace de recuperación.' 
      });
    }

    // Actualizar contraseña y limpiar tokens
    user.password = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.loginAttempts = 0;
    user.lockUntil = null;
    user.updatedAt = new Date();
    await user.save();

    // Enviar email de confirmación
    const mailOptions = {
      from: process.env.SMTP_USER || 'noreply@jplace.com',
      to: user.email,
      subject: 'Contraseña Actualizada - J-PLACE',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #10b981;">✓ Contraseña Actualizada</h2>
          <p>Hola <strong>${user.nombre}</strong>,</p>
          <p>Tu contraseña ha sido actualizada exitosamente.</p>
          <p>Si no realizaste este cambio, contacta inmediatamente a nuestro equipo de soporte.</p>
          <a href="${process.env.FRONTEND_URL || 'http://localhost:4000'}/login.html" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
            Iniciar Sesión
          </a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px;">Este es un mensaje automático, por favor no respondas a este correo.</p>
        </div>
      `
    };

    await sendMailWithFallback(mailOptions);

    res.status(200).json({ 
      msg: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' 
    });
  } catch (error) {
    console.error('Error en /reset-password', error);
    res.status(500).json({ msg: 'Error al restablecer la contraseña' });
  }
});

router.get("/usuarios", async (req, res) => {
  try {
    const usuarios = await User.find({}, "-password"); // excluye el campo password
    res.json(usuarios);
  } catch (error) {
    console.error('Error en /usuarios', error);
    res.status(500).json({ msg: "Error al obtener usuarios" });
  }
});

export default router;
