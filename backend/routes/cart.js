import express from 'express';
// import jwt from 'jsonwebtoken'; // JWT DESHABILITADO
import Cart from '../models/Cart.js';
import Producto from '../models/Producto.js';

const router = express.Router();

// JWT DESHABILITADO - Usar usuario de prueba
async function authMiddleware(req, res, next) {
  try {
    // Usar el usuario admin por defecto para pruebas
    req.userId = '691d2ba4d1e31fd42461170a'; // ID del usuario admin
    console.log('🛒 Cart - Usuario simulado:', req.userId);
    next();
  } catch (err) {
    console.error('authMiddleware error', err);
    return res.status(401).json({ msg: 'Error en autenticación' });
  }
}

// GET /api/cart - Obtener carrito del usuario
router.get('/', authMiddleware, async (req, res) => {
  try {
    let cart = await Cart.findOne({ usuario: req.userId })
      .populate({
        path: 'items.producto',
        select: 'nombre precio images category isApproved'
      });

    if (!cart) {
      // Crear carrito vacío si no existe
      cart = new Cart({ usuario: req.userId, items: [] });
      await cart.save();
    }

    res.json(cart);
  } catch (error) {
    console.error('Error al obtener carrito:', error);
    res.status(500).json({ msg: 'Error al obtener el carrito' });
  }
});

// POST /api/cart - Agregar producto al carrito
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { productoId, cantidad = 1 } = req.body;

    if (!productoId) {
      return res.status(400).json({ msg: 'El ID del producto es requerido' });
    }

    // Verificar que el producto exista
    const producto = await Producto.findById(productoId);
    
    console.log('🔍 Verificando producto:', {
      productoId,
      encontrado: !!producto,
      isApproved: producto?.isApproved,
      owner: producto?.owner,
      userId: req.userId
    });

    if (!producto) {
      return res.status(404).json({ msg: 'Producto no encontrado' });
    }

    // Verificar que el producto esté aprobado
    if (!producto.isApproved) {
      console.log('❌ Producto no aprobado:', productoId);
      return res.status(400).json({ msg: 'Este producto no está disponible (pendiente de aprobación)' });
    }

    // Verificar que el usuario no esté intentando agregar su propio producto
    if (producto.owner.toString() === req.userId) {
      console.log('❌ Usuario intentando agregar su propio producto');
      return res.status(400).json({ msg: 'No puedes agregar tus propios productos al carrito' });
    }

    // Buscar o crear carrito
    let cart = await Cart.findOne({ usuario: req.userId });
    if (!cart) {
      cart = new Cart({ usuario: req.userId, items: [] });
    }

    // Agregar producto usando el método del modelo
    cart.addItem(productoId, producto.precio, cantidad);
    await cart.save();

    // Poblar datos del producto antes de responder
    await cart.populate({
      path: 'items.producto',
      select: 'nombre precio images category isApproved'
    });

    res.json({ 
      msg: 'Producto agregado al carrito', 
      cart 
    });
  } catch (error) {
    console.error('Error al agregar al carrito:', error);
    res.status(500).json({ msg: 'Error al agregar el producto al carrito' });
  }
});

// PUT /api/cart/:itemId - Actualizar cantidad de un item
router.put('/:itemId', authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.params;
    const { cantidad } = req.body;

    if (cantidad === undefined || cantidad < 0) {
      return res.status(400).json({ msg: 'Cantidad inválida' });
    }

    const cart = await Cart.findOne({ usuario: req.userId });
    if (!cart) {
      return res.status(404).json({ msg: 'Carrito no encontrado' });
    }

    cart.updateItemQuantity(itemId, cantidad);
    await cart.save();

    await cart.populate({
      path: 'items.producto',
      select: 'nombre precio images category isActive'
    });

    res.json({ 
      msg: cantidad === 0 ? 'Producto eliminado del carrito' : 'Cantidad actualizada', 
      cart 
    });
  } catch (error) {
    console.error('Error al actualizar carrito:', error);
    res.status(500).json({ msg: 'Error al actualizar el carrito' });
  }
});

// DELETE /api/cart/:itemId - Eliminar un item del carrito
router.delete('/:itemId', authMiddleware, async (req, res) => {
  try {
    const { itemId } = req.params;

    const cart = await Cart.findOne({ usuario: req.userId });
    if (!cart) {
      return res.status(404).json({ msg: 'Carrito no encontrado' });
    }

    cart.removeItem(itemId);
    await cart.save();

    await cart.populate({
      path: 'items.producto',
      select: 'nombre precio images category isActive'
    });

    res.json({ 
      msg: 'Producto eliminado del carrito', 
      cart 
    });
  } catch (error) {
    console.error('Error al eliminar del carrito:', error);
    res.status(500).json({ msg: 'Error al eliminar el producto del carrito' });
  }
});

// DELETE /api/cart - Vaciar carrito completo
router.delete('/', authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ usuario: req.userId });
    if (!cart) {
      return res.status(404).json({ msg: 'Carrito no encontrado' });
    }

    cart.clear();
    await cart.save();

    res.json({ 
      msg: 'Carrito vaciado', 
      cart 
    });
  } catch (error) {
    console.error('Error al vaciar carrito:', error);
    res.status(500).json({ msg: 'Error al vaciar el carrito' });
  }
});

// GET /api/cart/count - Obtener número de items en el carrito
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ usuario: req.userId });
    const count = cart ? cart.items.reduce((sum, item) => sum + item.cantidad, 0) : 0;
    
    res.json({ count });
  } catch (error) {
    console.error('Error al contar items:', error);
    res.status(500).json({ msg: 'Error al obtener el conteo' });
  }
});

export default router;
