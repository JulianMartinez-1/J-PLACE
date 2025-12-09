import express from 'express';
// import jwt from 'jsonwebtoken'; // JWT DESHABILITADO
import Oferta from '../models/Oferta.js';
import Producto from '../models/Producto.js';
import User from '../models/User.js';
import { sendMailWithFallback } from '../utils/mail.js';

const router = express.Router();

// JWT DESHABILITADO - Usar usuario de prueba
async function authMiddleware(req, res, next) {
  try {
    req.userId = '691d2ba4d1e31fd42461170a'; // Usuario admin
    console.log('🤝 Ofertas - Usuario simulado:', req.userId);
    next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.status(500).json({ msg: 'Error en autenticación' });
  }
}

// POST /api/ofertas - Crear una oferta
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { productoId, monto, mensaje } = req.body;

    if (!productoId || !monto) {
      return res.status(400).json({ msg: 'Producto y monto son requeridos' });
    }

    if (monto <= 0) {
      return res.status(400).json({ msg: 'El monto debe ser mayor a 0' });
    }

    // Verificar que el producto exista
    const producto = await Producto.findById(productoId).populate('owner', 'nombre email');
    if (!producto) {
      return res.status(404).json({ msg: 'Producto no encontrado' });
    }

    if (!producto.isActive) {
      return res.status(400).json({ msg: 'Este producto no está disponible' });
    }

    // Verificar que el usuario no sea el dueño del producto
    if (producto.owner._id.toString() === req.userId) {
      return res.status(400).json({ msg: 'No puedes hacer una oferta por tu propio producto' });
    }

    // Verificar si ya existe una oferta activa del mismo comprador para el mismo producto
    const ofertaExistente = await Oferta.findOne({
      producto: productoId,
      comprador: req.userId,
      estado: { $in: ['pendiente', 'contraoferta'] }
    });

    if (ofertaExistente) {
      return res.status(400).json({ msg: 'Ya tienes una oferta activa para este producto' });
    }

    // Crear la oferta
    const oferta = new Oferta({
      producto: productoId,
      comprador: req.userId,
      vendedor: producto.owner._id,
      montoInicial: monto,
      montoActual: monto,
      precioOriginal: producto.precio
    });

    // Agregar mensaje inicial si existe
    if (mensaje) {
      oferta.addMensaje(req.userId, mensaje, monto, false);
    }

    await oferta.save();

    // Poblar datos antes de responder
    await oferta.populate([
      { path: 'producto', select: 'nombre precio images' },
      { path: 'comprador', select: 'nombre email' },
      { path: 'vendedor', select: 'nombre email' }
    ]);

    // Enviar notificación al vendedor
    try {
      const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
      const mailOptions = {
        from: process.env.SMTP_USER || 'noreply@jplace.com',
        to: producto.owner.email,
        subject: `💰 Nueva Oferta por "${producto.nombre}" - J-PLACE`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #6366f1;">💰 ¡Nueva Oferta Recibida!</h2>
            <p>Hola <strong>${producto.owner.nombre}</strong>,</p>
            <p>Has recibido una nueva oferta por tu producto:</p>
            
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">${producto.nombre}</h3>
              <p><strong>Precio original:</strong> $${producto.precio.toFixed(2)}</p>
              <p><strong>Oferta recibida:</strong> <span style="color: #10b981; font-size: 20px; font-weight: bold;">$${monto.toFixed(2)}</span></p>
              ${mensaje ? `<p><strong>Mensaje:</strong> "${mensaje}"</p>` : ''}
            </div>

            <p>Puedes revisar la oferta, aceptarla, rechazarla o hacer una contraoferta desde tu panel.</p>
            
            <a href="${BACKEND_URL}/admin_dashboard.html" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Ver Oferta
            </a>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px;">Esta oferta expira en 72 horas.</p>
          </div>
        `
      };

      await sendMailWithFallback(mailOptions);
    } catch (emailError) {
      console.error('Error al enviar email de notificación:', emailError);
    }

    res.status(201).json({ 
      msg: 'Oferta creada exitosamente', 
      oferta 
    });
  } catch (error) {
    console.error('Error al crear oferta:', error);
    res.status(500).json({ msg: 'Error al crear la oferta' });
  }
});

// GET /api/ofertas - Obtener ofertas del usuario (como comprador o vendedor)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { tipo = 'todas' } = req.query; // 'compras', 'ventas', 'todas'

    let query = {};
    if (tipo === 'compras') {
      query.comprador = req.userId;
    } else if (tipo === 'ventas') {
      query.vendedor = req.userId;
    } else {
      query.$or = [
        { comprador: req.userId },
        { vendedor: req.userId }
      ];
    }

    const ofertas = await Oferta.find(query)
      .populate('producto', 'nombre precio images category')
      .populate('comprador', 'nombre email')
      .populate('vendedor', 'nombre email')
      .populate('mensajes.autor', 'nombre')
      .sort({ updatedAt: -1 });

    res.json(ofertas);
  } catch (error) {
    console.error('Error al obtener ofertas:', error);
    res.status(500).json({ msg: 'Error al obtener las ofertas' });
  }
});

// GET /api/ofertas/:id - Obtener una oferta específica
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const oferta = await Oferta.findById(req.params.id)
      .populate('producto', 'nombre precio images category')
      .populate('comprador', 'nombre email')
      .populate('vendedor', 'nombre email')
      .populate('mensajes.autor', 'nombre');

    if (!oferta) {
      return res.status(404).json({ msg: 'Oferta no encontrada' });
    }

    // Verificar que el usuario sea parte de la oferta
    if (oferta.comprador._id.toString() !== req.userId && 
        oferta.vendedor._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'No tienes permiso para ver esta oferta' });
    }

    res.json(oferta);
  } catch (error) {
    console.error('Error al obtener oferta:', error);
    res.status(500).json({ msg: 'Error al obtener la oferta' });
  }
});

// POST /api/ofertas/:id/aceptar - Aceptar una oferta
router.post('/:id/aceptar', authMiddleware, async (req, res) => {
  try {
    const oferta = await Oferta.findById(req.params.id)
      .populate('producto', 'nombre')
      .populate('comprador', 'nombre email')
      .populate('vendedor', 'nombre email');

    if (!oferta) {
      return res.status(404).json({ msg: 'Oferta no encontrada' });
    }

    // Solo el vendedor puede aceptar
    if (oferta.vendedor._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Solo el vendedor puede aceptar la oferta' });
    }

    if (oferta.estado !== 'pendiente' && oferta.estado !== 'contraoferta') {
      return res.status(400).json({ msg: 'Esta oferta ya no está activa' });
    }

    if (oferta.isExpired()) {
      oferta.estado = 'expirada';
      await oferta.save();
      return res.status(400).json({ msg: 'Esta oferta ha expirado' });
    }

    oferta.aceptar();
    await oferta.save();

    // Notificar al comprador
    try {
      const mailOptions = {
        from: process.env.SMTP_USER || 'noreply@jplace.com',
        to: oferta.comprador.email,
        subject: `✅ Oferta Aceptada - "${oferta.producto.nombre}" - J-PLACE`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #10b981;">✅ ¡Tu Oferta Fue Aceptada!</h2>
            <p>Hola <strong>${oferta.comprador.nombre}</strong>,</p>
            <p>Buenas noticias! Tu oferta por <strong>${oferta.producto.nombre}</strong> ha sido aceptada.</p>
            
            <div style="background: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #10b981;">
              <p><strong>Monto acordado:</strong> <span style="color: #10b981; font-size: 24px; font-weight: bold;">$${oferta.montoActual.toFixed(2)}</span></p>
            </div>

            <p>Por favor, coordina con el vendedor los detalles de entrega y pago.</p>
            <p><strong>Vendedor:</strong> ${oferta.vendedor.nombre}</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px;">Gracias por usar J-PLACE</p>
          </div>
        `
      };

      await sendMailWithFallback(mailOptions);
    } catch (emailError) {
      console.error('Error al enviar email:', emailError);
    }

    res.json({ 
      msg: 'Oferta aceptada', 
      oferta 
    });
  } catch (error) {
    console.error('Error al aceptar oferta:', error);
    res.status(500).json({ msg: 'Error al aceptar la oferta' });
  }
});

// POST /api/ofertas/:id/rechazar - Rechazar una oferta
router.post('/:id/rechazar', authMiddleware, async (req, res) => {
  try {
    const { motivo } = req.body;

    const oferta = await Oferta.findById(req.params.id)
      .populate('producto', 'nombre')
      .populate('comprador', 'nombre email')
      .populate('vendedor', 'nombre email');

    if (!oferta) {
      return res.status(404).json({ msg: 'Oferta no encontrada' });
    }

    // Solo el vendedor puede rechazar
    if (oferta.vendedor._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Solo el vendedor puede rechazar la oferta' });
    }

    if (oferta.estado === 'aceptada') {
      return res.status(400).json({ msg: 'No puedes rechazar una oferta ya aceptada' });
    }

    oferta.rechazar();
    if (motivo) {
      oferta.addMensaje(req.userId, `Oferta rechazada: ${motivo}`);
    }
    await oferta.save();

    // Notificar al comprador
    try {
      const mailOptions = {
        from: process.env.SMTP_USER || 'noreply@jplace.com',
        to: oferta.comprador.email,
        subject: `❌ Oferta Rechazada - "${oferta.producto.nombre}" - J-PLACE`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ef4444;">❌ Oferta Rechazada</h2>
            <p>Hola <strong>${oferta.comprador.nombre}</strong>,</p>
            <p>Tu oferta por <strong>${oferta.producto.nombre}</strong> ha sido rechazada.</p>
            ${motivo ? `<p><strong>Motivo:</strong> ${motivo}</p>` : ''}
            <p>No te desanimes, hay muchos otros productos disponibles en J-PLACE.</p>
          </div>
        `
      };

      await sendMailWithFallback(mailOptions);
    } catch (emailError) {
      console.error('Error al enviar email:', emailError);
    }

    res.json({ 
      msg: 'Oferta rechazada', 
      oferta 
    });
  } catch (error) {
    console.error('Error al rechazar oferta:', error);
    res.status(500).json({ msg: 'Error al rechazar la oferta' });
  }
});

// POST /api/ofertas/:id/contraofertar - Hacer una contraoferta
router.post('/:id/contraofertar', authMiddleware, async (req, res) => {
  try {
    const { monto, mensaje } = req.body;

    if (!monto || monto <= 0) {
      return res.status(400).json({ msg: 'El monto debe ser mayor a 0' });
    }

    const oferta = await Oferta.findById(req.params.id)
      .populate('producto', 'nombre precio')
      .populate('comprador', 'nombre email')
      .populate('vendedor', 'nombre email');

    if (!oferta) {
      return res.status(404).json({ msg: 'Oferta no encontrada' });
    }

    // Solo el vendedor puede contraofertar
    if (oferta.vendedor._id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Solo el vendedor puede hacer una contraoferta' });
    }

    if (oferta.estado !== 'pendiente' && oferta.estado !== 'contraoferta') {
      return res.status(400).json({ msg: 'Esta oferta ya no está activa' });
    }

    if (oferta.isExpired()) {
      oferta.estado = 'expirada';
      await oferta.save();
      return res.status(400).json({ msg: 'Esta oferta ha expirado' });
    }

    // Agregar mensaje de contraoferta
    const mensajeContraoferta = mensaje || `Contraoferta: $${monto.toFixed(2)}`;
    oferta.addMensaje(req.userId, mensajeContraoferta, monto, true);
    await oferta.save();

    // Notificar al comprador
    try {
      const mailOptions = {
        from: process.env.SMTP_USER || 'noreply@jplace.com',
        to: oferta.comprador.email,
        subject: `🔄 Contraoferta Recibida - "${oferta.producto.nombre}" - J-PLACE`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f59e0b;">🔄 Nueva Contraoferta</h2>
            <p>Hola <strong>${oferta.comprador.nombre}</strong>,</p>
            <p>El vendedor ha hecho una contraoferta por <strong>${oferta.producto.nombre}</strong>:</p>
            
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #f59e0b;">
              <p><strong>Tu oferta:</strong> $${oferta.montoInicial.toFixed(2)}</p>
              <p><strong>Contraoferta:</strong> <span style="color: #f59e0b; font-size: 24px; font-weight: bold;">$${monto.toFixed(2)}</span></p>
              ${mensaje ? `<p><strong>Mensaje:</strong> "${mensaje}"</p>` : ''}
            </div>

            <p>Puedes aceptar la contraoferta, rechazarla o hacer una nueva oferta.</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px;">Esta oferta expira en 72 horas.</p>
          </div>
        `
      };

      await sendMailWithFallback(mailOptions);
    } catch (emailError) {
      console.error('Error al enviar email:', emailError);
    }

    await oferta.populate('mensajes.autor', 'nombre');

    res.json({ 
      msg: 'Contraoferta enviada', 
      oferta 
    });
  } catch (error) {
    console.error('Error al contraofertar:', error);
    res.status(500).json({ msg: 'Error al hacer la contraoferta' });
  }
});

// POST /api/ofertas/:id/mensaje - Agregar un mensaje a la negociación
router.post('/:id/mensaje', authMiddleware, async (req, res) => {
  try {
    const { contenido } = req.body;

    if (!contenido || contenido.trim().length === 0) {
      return res.status(400).json({ msg: 'El mensaje no puede estar vacío' });
    }

    const oferta = await Oferta.findById(req.params.id);
    if (!oferta) {
      return res.status(404).json({ msg: 'Oferta no encontrada' });
    }

    // Verificar que el usuario sea parte de la oferta
    if (oferta.comprador.toString() !== req.userId && 
        oferta.vendedor.toString() !== req.userId) {
      return res.status(403).json({ msg: 'No puedes enviar mensajes en esta oferta' });
    }

    oferta.addMensaje(req.userId, contenido.trim());
    await oferta.save();

    await oferta.populate('mensajes.autor', 'nombre');

    res.json({ 
      msg: 'Mensaje enviado', 
      oferta 
    });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ msg: 'Error al enviar el mensaje' });
  }
});

// DELETE /api/ofertas/:id - Cancelar una oferta (solo comprador)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const oferta = await Oferta.findById(req.params.id);
    if (!oferta) {
      return res.status(404).json({ msg: 'Oferta no encontrada' });
    }

    // Solo el comprador puede cancelar
    if (oferta.comprador.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Solo el comprador puede cancelar la oferta' });
    }

    if (oferta.estado === 'aceptada') {
      return res.status(400).json({ msg: 'No puedes cancelar una oferta ya aceptada' });
    }

    oferta.cancelar();
    await oferta.save();

    res.json({ 
      msg: 'Oferta cancelada', 
      oferta 
    });
  } catch (error) {
    console.error('Error al cancelar oferta:', error);
    res.status(500).json({ msg: 'Error al cancelar la oferta' });
  }
});

export default router;
