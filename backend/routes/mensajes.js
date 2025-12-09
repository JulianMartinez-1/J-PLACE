import express from 'express';
// import jwt from 'jsonwebtoken'; // JWT DESHABILITADO
import Conversacion from '../models/Conversacion.js';
import User from '../models/User.js';
import Producto from '../models/Producto.js';
import { contactLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// JWT DESHABILITADO - Usar usuario de prueba
async function authMiddleware(req, res, next) {
  try {
    req.userId = '691d2ba4d1e31fd42461170a'; // Usuario admin
    console.log('💬 Mensajes - Usuario simulado:', req.userId);
    next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.status(500).json({ msg: 'Error en autenticación' });
  }
}

// GET /api/mensajes - Obtener todas las conversaciones del usuario
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { archivadas = 'false' } = req.query;
    const mostrarArchivadas = archivadas === 'true';

    let query = { participantes: req.userId };
    
    if (mostrarArchivadas) {
      query.archivosPara = req.userId;
    } else {
      query.archivosPara = { $ne: req.userId };
    }

    const conversaciones = await Conversacion.find(query)
      .populate('participantes', 'nombre email')
      .populate('producto', 'nombre images precio')
      .populate('mensajes.remitente', 'nombre')
      .sort({ ultimoMensaje: -1 });

    // Agregar contador de no leídos para cada conversación
    const conversacionesConInfo = conversaciones.map(conv => {
      const convObj = conv.toObject();
      convObj.mensajesNoLeidos = conv.contarNoLeidos(req.userId);
      
      // Identificar al otro participante
      convObj.otroParticipante = convObj.participantes.find(p => 
        p._id.toString() !== req.userId
      );
      
      return convObj;
    });

    res.json(conversacionesConInfo);
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    res.status(500).json({ msg: 'Error al obtener las conversaciones' });
  }
});

// GET /api/mensajes/:id - Obtener una conversación específica
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const conversacion = await Conversacion.findById(req.params.id)
      .populate('participantes', 'nombre email')
      .populate('producto', 'nombre images precio category')
      .populate('mensajes.remitente', 'nombre');

    if (!conversacion) {
      return res.status(404).json({ msg: 'Conversación no encontrada' });
    }

    // Verificar que el usuario sea participante
    const esParticipante = conversacion.participantes.some(p => 
      p._id.toString() === req.userId
    );

    if (!esParticipante) {
      return res.status(403).json({ msg: 'No tienes acceso a esta conversación' });
    }

    // Marcar mensajes como leídos
    conversacion.marcarComoLeido(req.userId);
    await conversacion.save();

    res.json(conversacion);
  } catch (error) {
    console.error('Error al obtener conversación:', error);
    res.status(500).json({ msg: 'Error al obtener la conversación' });
  }
});

// POST /api/mensajes - Crear o encontrar conversación y enviar mensaje
router.post('/', authMiddleware, contactLimiter, async (req, res) => {
  try {
    const { destinatarioId, productoId = null, contenido } = req.body;

    if (!destinatarioId || !contenido || contenido.trim().length === 0) {
      return res.status(400).json({ msg: 'Destinatario y contenido son requeridos' });
    }

    if (contenido.length > 2000) {
      return res.status(400).json({ msg: 'El mensaje es demasiado largo (máximo 2000 caracteres)' });
    }

    // Verificar que el destinatario exista
    const destinatario = await User.findById(destinatarioId);
    if (!destinatario) {
      return res.status(404).json({ msg: 'Usuario no encontrado' });
    }

    // No permitir enviarse mensajes a sí mismo
    if (destinatarioId === req.userId) {
      return res.status(400).json({ msg: 'No puedes enviarte mensajes a ti mismo' });
    }

    // Buscar o crear conversación
    let conversacion = await Conversacion.findOrCreate(
      req.userId, 
      destinatarioId, 
      productoId
    );

    // Agregar mensaje
    conversacion.addMensaje(req.userId, contenido);
    await conversacion.save();

    // Poblar datos
    await conversacion.populate([
      { path: 'participantes', select: 'nombre email' },
      { path: 'producto', select: 'nombre images precio' },
      { path: 'mensajes.remitente', select: 'nombre' }
    ]);

    res.status(201).json({ 
      msg: 'Mensaje enviado', 
      conversacion 
    });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ msg: 'Error al enviar el mensaje' });
  }
});

// POST /api/mensajes/:id/mensaje - Agregar mensaje a conversación existente
router.post('/:id/mensaje', authMiddleware, contactLimiter, async (req, res) => {
  try {
    const { contenido } = req.body;

    if (!contenido || contenido.trim().length === 0) {
      return res.status(400).json({ msg: 'El contenido no puede estar vacío' });
    }

    if (contenido.length > 2000) {
      return res.status(400).json({ msg: 'El mensaje es demasiado largo (máximo 2000 caracteres)' });
    }

    const conversacion = await Conversacion.findById(req.params.id);
    if (!conversacion) {
      return res.status(404).json({ msg: 'Conversación no encontrada' });
    }

    // Verificar que el usuario sea participante
    const esParticipante = conversacion.participantes.some(p => 
      p.toString() === req.userId
    );

    if (!esParticipante) {
      return res.status(403).json({ msg: 'No puedes enviar mensajes en esta conversación' });
    }

    conversacion.addMensaje(req.userId, contenido);
    await conversacion.save();

    await conversacion.populate([
      { path: 'participantes', select: 'nombre email' },
      { path: 'producto', select: 'nombre images precio' },
      { path: 'mensajes.remitente', select: 'nombre' }
    ]);

    res.json({ 
      msg: 'Mensaje enviado', 
      conversacion 
    });
  } catch (error) {
    console.error('Error al enviar mensaje:', error);
    res.status(500).json({ msg: 'Error al enviar el mensaje' });
  }
});

// PUT /api/mensajes/:id/leer - Marcar mensajes como leídos
router.put('/:id/leer', authMiddleware, async (req, res) => {
  try {
    const conversacion = await Conversacion.findById(req.params.id);
    if (!conversacion) {
      return res.status(404).json({ msg: 'Conversación no encontrada' });
    }

    // Verificar que el usuario sea participante
    const esParticipante = conversacion.participantes.some(p => 
      p.toString() === req.userId
    );

    if (!esParticipante) {
      return res.status(403).json({ msg: 'No tienes acceso a esta conversación' });
    }

    conversacion.marcarComoLeido(req.userId);
    await conversacion.save();

    res.json({ msg: 'Mensajes marcados como leídos' });
  } catch (error) {
    console.error('Error al marcar como leído:', error);
    res.status(500).json({ msg: 'Error al actualizar los mensajes' });
  }
});

// PUT /api/mensajes/:id/archivar - Archivar conversación
router.put('/:id/archivar', authMiddleware, async (req, res) => {
  try {
    const conversacion = await Conversacion.findById(req.params.id);
    if (!conversacion) {
      return res.status(404).json({ msg: 'Conversación no encontrada' });
    }

    // Verificar que el usuario sea participante
    const esParticipante = conversacion.participantes.some(p => 
      p.toString() === req.userId
    );

    if (!esParticipante) {
      return res.status(403).json({ msg: 'No tienes acceso a esta conversación' });
    }

    conversacion.archivar(req.userId);
    await conversacion.save();

    res.json({ msg: 'Conversación archivada' });
  } catch (error) {
    console.error('Error al archivar:', error);
    res.status(500).json({ msg: 'Error al archivar la conversación' });
  }
});

// PUT /api/mensajes/:id/desarchivar - Desarchivar conversación
router.put('/:id/desarchivar', authMiddleware, async (req, res) => {
  try {
    const conversacion = await Conversacion.findById(req.params.id);
    if (!conversacion) {
      return res.status(404).json({ msg: 'Conversación no encontrada' });
    }

    // Verificar que el usuario sea participante
    const esParticipante = conversacion.participantes.some(p => 
      p.toString() === req.userId
    );

    if (!esParticipante) {
      return res.status(403).json({ msg: 'No tienes acceso a esta conversación' });
    }

    conversacion.desarchivar(req.userId);
    await conversacion.save();

    res.json({ msg: 'Conversación desarchivada' });
  } catch (error) {
    console.error('Error al desarchivar:', error);
    res.status(500).json({ msg: 'Error al desarchivar la conversación' });
  }
});

// GET /api/mensajes/no-leidos/count - Obtener total de mensajes no leídos
router.get('/no-leidos/count', authMiddleware, async (req, res) => {
  try {
    const conversaciones = await Conversacion.find({ 
      participantes: req.userId,
      archivosPara: { $ne: req.userId }
    });

    const totalNoLeidos = conversaciones.reduce((sum, conv) => {
      return sum + conv.contarNoLeidos(req.userId);
    }, 0);

    res.json({ count: totalNoLeidos });
  } catch (error) {
    console.error('Error al contar no leídos:', error);
    res.status(500).json({ msg: 'Error al obtener el conteo' });
  }
});

// POST /api/mensajes/contactar-vendedor - Iniciar conversación con vendedor de un producto
router.post('/contactar-vendedor', authMiddleware, async (req, res) => {
  try {
    const { productoId, mensaje } = req.body;

    if (!productoId) {
      return res.status(400).json({ msg: 'El ID del producto es requerido' });
    }

    const producto = await Producto.findById(productoId).populate('owner', 'nombre email');
    if (!producto) {
      return res.status(404).json({ msg: 'Producto no encontrado' });
    }

    if (producto.owner._id.toString() === req.userId) {
      return res.status(400).json({ msg: 'No puedes contactar tu propio producto' });
    }

    // Buscar o crear conversación
    let conversacion = await Conversacion.findOrCreate(
      req.userId,
      producto.owner._id,
      productoId
    );

    // Si hay mensaje, agregarlo
    if (mensaje && mensaje.trim().length > 0) {
      conversacion.addMensaje(req.userId, mensaje.trim());
      await conversacion.save();
    }

    await conversacion.populate([
      { path: 'participantes', select: 'nombre email' },
      { path: 'producto', select: 'nombre images precio' },
      { path: 'mensajes.remitente', select: 'nombre' }
    ]);

    res.status(201).json({ 
      msg: 'Conversación iniciada', 
      conversacion 
    });
  } catch (error) {
    console.error('Error al contactar vendedor:', error);
    res.status(500).json({ msg: 'Error al contactar al vendedor' });
  }
});

export default router;
