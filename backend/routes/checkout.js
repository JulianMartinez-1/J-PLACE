import express from 'express';
// import jwt from 'jsonwebtoken'; // JWT DESHABILITADO
import Pedido from '../models/Pedido.js';
import Cart from '../models/Cart.js';
import Producto from '../models/Producto.js';
import { sendMailWithFallback } from '../utils/mail.js';

const router = express.Router();

// JWT DESHABILITADO - Usar usuario de prueba
async function authMiddleware(req, res, next) {
  try {
    req.userId = '691d2ba4d1e31fd42461170a'; // Usuario admin
    console.log('💳 Checkout - Usuario simulado:', req.userId);
    next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.status(500).json({ msg: 'Error en autenticación' });
  }
}

// POST /api/checkout - Crear pedido desde el carrito
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      metodoPago, 
      direccionEnvio, 
      detallesPago = {},
      notas = '' 
    } = req.body;

    // Validar método de pago
    const metodosValidos = ['tarjeta', 'paypal', 'transferencia', 'efectivo'];
    if (!metodoPago || !metodosValidos.includes(metodoPago)) {
      return res.status(400).json({ msg: 'Método de pago inválido' });
    }

    // Validar dirección de envío
    if (!direccionEnvio || !direccionEnvio.nombreCompleto || 
        !direccionEnvio.direccion || !direccionEnvio.ciudad || 
        !direccionEnvio.codigoPostal || !direccionEnvio.telefono) {
      return res.status(400).json({ msg: 'Dirección de envío incompleta' });
    }

    // Obtener carrito del usuario
    const cart = await Cart.findOne({ usuario: req.userId })
      .populate({
        path: 'items.producto',
        select: 'nombre precio images category owner isActive'
      });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ msg: 'El carrito está vacío' });
    }

    // Verificar que todos los productos estén activos
    const productosInactivos = cart.items.filter(item => !item.producto.isActive);
    if (productosInactivos.length > 0) {
      return res.status(400).json({ 
        msg: 'Algunos productos ya no están disponibles',
        productosInactivos: productosInactivos.map(i => i.producto.nombre)
      });
    }

    // Crear items del pedido con información del vendedor
    const items = cart.items.map(item => ({
      producto: item.producto._id,
      nombre: item.producto.nombre,
      precio: item.precio,
      cantidad: item.cantidad,
      vendedor: item.producto.owner
    }));

    // Crear pedido
    const pedido = new Pedido({
      usuario: req.userId,
      items,
      direccionEnvio,
      notas,
      metodoPago: {
        tipo: metodoPago,
        estado: 'pendiente',
        detalles: detallesPago
      }
    });

    // Calcular totales
    pedido.calcularTotales();

    // Establecer fecha estimada de entrega (7 días)
    pedido.fechaEstimadaEntrega = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Agregar estado inicial al historial
    pedido.actualizarEstado('pendiente', 'Pedido creado');

    await pedido.save();

    // Vaciar el carrito
    cart.clear();
    await cart.save();

    // Poblar información del pedido
    await pedido.populate([
      { path: 'usuario', select: 'nombre email' },
      { path: 'items.producto', select: 'nombre precio images' },
      { path: 'items.vendedor', select: 'nombre email' }
    ]);

    // Enviar email de confirmación al comprador
    try {
      const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';
      const itemsHtml = pedido.items.map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.nombre}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.cantidad}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${item.precio.toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: bold;">$${(item.precio * item.cantidad).toFixed(2)}</td>
        </tr>
      `).join('');

      const mailOptions = {
        from: process.env.SMTP_USER || 'noreply@jplace.com',
        to: pedido.usuario.email,
        subject: `✅ Pedido Confirmado #${pedido._id.toString().slice(-8)} - J-PLACE`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0;">✅ ¡Pedido Confirmado!</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Gracias por tu compra en J-PLACE</p>
            </div>

            <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
              <p>Hola <strong>${pedido.usuario.nombre}</strong>,</p>
              <p>Hemos recibido tu pedido y lo estamos procesando.</p>

              <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Número de Pedido:</strong> #${pedido._id.toString().slice(-8).toUpperCase()}</p>
                <p style="margin: 5px 0 0 0;"><strong>Fecha:</strong> ${new Date(pedido.createdAt).toLocaleDateString('es-MX')}</p>
                <p style="margin: 5px 0 0 0;"><strong>Método de Pago:</strong> ${metodoPago === 'tarjeta' ? 'Tarjeta de Crédito/Débito' : metodoPago === 'paypal' ? 'PayPal' : metodoPago === 'transferencia' ? 'Transferencia Bancaria' : 'Efectivo Contra Entrega'}</p>
              </div>

              <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">Resumen del Pedido</h3>
              
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 10px; text-align: left; border-bottom: 2px solid #e5e7eb;">Producto</th>
                    <th style="padding: 10px; text-align: center; border-bottom: 2px solid #e5e7eb;">Cant.</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Precio</th>
                    <th style="padding: 10px; text-align: right; border-bottom: 2px solid #e5e7eb;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div style="text-align: right; padding: 15px; background: #f9fafb; border-radius: 8px;">
                <p style="margin: 5px 0;"><strong>Subtotal:</strong> $${pedido.subtotal.toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>IVA (16%):</strong> $${pedido.impuestos.toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Envío:</strong> ${pedido.envio === 0 ? '<span style="color: #10b981;">¡GRATIS!</span>' : '$' + pedido.envio.toFixed(2)}</p>
                <hr style="margin: 10px 0; border: none; border-top: 2px solid #e5e7eb;">
                <p style="margin: 5px 0; font-size: 20px; color: #10b981;"><strong>TOTAL:</strong> $${pedido.total.toFixed(2)}</p>
              </div>

              <h3 style="color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-top: 30px;">Dirección de Envío</h3>
              <div style="background: #f9fafb; padding: 15px; border-radius: 8px;">
                <p style="margin: 5px 0;"><strong>${direccionEnvio.nombreCompleto}</strong></p>
                <p style="margin: 5px 0;">${direccionEnvio.direccion}</p>
                <p style="margin: 5px 0;">${direccionEnvio.ciudad}, ${direccionEnvio.estado || ''} ${direccionEnvio.codigoPostal}</p>
                <p style="margin: 5px 0;">${direccionEnvio.pais || 'México'}</p>
                <p style="margin: 5px 0;"><strong>Tel:</strong> ${direccionEnvio.telefono}</p>
              </div>

              <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; color: #1e40af;">📦 <strong>Entrega estimada:</strong> ${new Date(pedido.fechaEstimadaEntrega).toLocaleDateString('es-MX')}</p>
              </div>

              ${metodoPago === 'transferencia' ? `
              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
                <h4 style="margin: 0 0 10px 0; color: #92400e;">💳 Instrucciones de Pago por Transferencia</h4>
                <p style="margin: 5px 0;"><strong>Banco:</strong> BBVA</p>
                <p style="margin: 5px 0;"><strong>CLABE:</strong> 012180001234567890</p>
                <p style="margin: 5px 0;"><strong>Beneficiario:</strong> J-PLACE S.A. de C.V.</p>
                <p style="margin: 5px 0;"><strong>Referencia:</strong> ${pedido._id.toString().slice(-8).toUpperCase()}</p>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #92400e;">⚠️ Por favor, envía tu comprobante de pago a pagos@jplace.com</p>
              </div>
              ` : ''}

              ${metodoPago === 'efectivo' ? `
              <div style="background: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
                <h4 style="margin: 0 0 10px 0; color: #065f46;">💵 Pago Contra Entrega</h4>
                <p style="margin: 5px 0; color: #065f46;">Prepara el monto exacto: <strong>$${pedido.total.toFixed(2)}</strong></p>
                <p style="margin: 5px 0; font-size: 13px; color: #065f46;">El repartidor aceptará efectivo o tarjeta.</p>
              </div>
              ` : ''}

              <div style="text-align: center; margin: 30px 0;">
                <a href="${BACKEND_URL}/mis-pedidos.html" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
                  Ver Estado del Pedido
                </a>
              </div>
            </div>

            <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="color: #6b7280; font-size: 13px; margin: 0;">¿Tienes preguntas? Contáctanos en soporte@jplace.com</p>
              <p style="color: #9ca3af; font-size: 12px; margin: 10px 0 0 0;">© 2025 J-PLACE - Todos los derechos reservados</p>
            </div>
          </div>
        `
      };

      await sendMailWithFallback(mailOptions);
    } catch (emailError) {
      console.error('Error al enviar email de confirmación:', emailError);
    }

    // Notificar a cada vendedor
    const vendedoresUnicos = [...new Set(pedido.items.map(i => i.vendedor._id.toString()))];
    
    for (const vendedorId of vendedoresUnicos) {
      try {
        const itemsVendedor = pedido.items.filter(i => i.vendedor._id.toString() === vendedorId);
        const vendedor = itemsVendedor[0].vendedor;

        const itemsVendedorHtml = itemsVendedor.map(item => `
          <li style="margin: 8px 0;">${item.nombre} (x${item.cantidad}) - $${(item.precio * item.cantidad).toFixed(2)}</li>
        `).join('');

        const mailVendedor = {
          from: process.env.SMTP_USER || 'noreply@jplace.com',
          to: vendedor.email,
          subject: `🛒 Nueva Venta - Pedido #${pedido._id.toString().slice(-8)} - J-PLACE`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #10b981;">🎉 ¡Nueva Venta!</h2>
              <p>Hola <strong>${vendedor.nombre}</strong>,</p>
              <p>Has recibido un nuevo pedido:</p>
              
              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Pedido:</strong> #${pedido._id.toString().slice(-8).toUpperCase()}</p>
                <p><strong>Productos vendidos:</strong></p>
                <ul style="margin: 10px 0;">
                  ${itemsVendedorHtml}
                </ul>
              </div>

              <p>Por favor, prepara los productos para envío.</p>
              <p><strong>Dirección de envío:</strong><br>
              ${direccionEnvio.nombreCompleto}<br>
              ${direccionEnvio.direccion}, ${direccionEnvio.ciudad}</p>
            </div>
          `
        };

        await sendMailWithFallback(mailVendedor);
      } catch (emailError) {
        console.error(`Error al notificar al vendedor ${vendedorId}:`, emailError);
      }
    }

    res.status(201).json({ 
      msg: 'Pedido creado exitosamente', 
      pedido 
    });
  } catch (error) {
    console.error('Error en checkout:', error);
    res.status(500).json({ msg: 'Error al procesar el pedido' });
  }
});

// GET /api/checkout/pedidos - Obtener pedidos del usuario
router.get('/pedidos', authMiddleware, async (req, res) => {
  try {
    const pedidos = await Pedido.find({ usuario: req.userId })
      .populate('items.producto', 'nombre precio images')
      .populate('items.vendedor', 'nombre')
      .sort({ createdAt: -1 });

    res.json(pedidos);
  } catch (error) {
    console.error('Error al obtener pedidos:', error);
    res.status(500).json({ msg: 'Error al obtener los pedidos' });
  }
});

// GET /api/checkout/pedidos/:id - Obtener un pedido específico
router.get('/pedidos/:id', authMiddleware, async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id)
      .populate('usuario', 'nombre email')
      .populate('items.producto', 'nombre precio images category')
      .populate('items.vendedor', 'nombre email');

    if (!pedido) {
      return res.status(404).json({ msg: 'Pedido no encontrado' });
    }

    // Verificar que el usuario sea el dueño del pedido o vendedor de algún item
    const esComprador = pedido.usuario._id.toString() === req.userId;
    const esVendedor = pedido.items.some(item => 
      item.vendedor._id.toString() === req.userId
    );

    if (!esComprador && !esVendedor) {
      return res.status(403).json({ msg: 'No tienes permiso para ver este pedido' });
    }

    res.json(pedido);
  } catch (error) {
    console.error('Error al obtener pedido:', error);
    res.status(500).json({ msg: 'Error al obtener el pedido' });
  }
});

// GET /api/checkout/ventas - Obtener ventas del vendedor
router.get('/ventas', authMiddleware, async (req, res) => {
  try {
    const pedidos = await Pedido.find({ 'items.vendedor': req.userId })
      .populate('usuario', 'nombre email')
      .populate('items.producto', 'nombre precio images')
      .sort({ createdAt: -1 });

    // Filtrar solo los items que pertenecen a este vendedor
    const ventasConItemsFiltrados = pedidos.map(pedido => {
      const pedidoObj = pedido.toObject();
      pedidoObj.items = pedidoObj.items.filter(item => 
        item.vendedor.toString() === req.userId
      );
      return pedidoObj;
    });

    res.json(ventasConItemsFiltrados);
  } catch (error) {
    console.error('Error al obtener ventas:', error);
    res.status(500).json({ msg: 'Error al obtener las ventas' });
  }
});

export default router;
