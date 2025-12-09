import express from 'express';
import User from '../models/User.js';
// import { requireAuth, requireRole } from '../middleware/auth.js'; // JWT DESHABILITADO
import bcrypt from 'bcryptjs';

const router = express.Router();

// Listar usuarios (con búsqueda y filtros) - JWT DESHABILITADO
router.get('/', async (req, res) => {
  try{
    const { q, role, state } = req.query;
    const filter = {};
    if(role) filter.role = role;
    if(state === 'active') filter.isActive = true;
    if(state === 'disabled') filter.isActive = false;
    if(q) filter.$or = [{ nombre: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }];
    const users = await User.find(filter, '-password').sort({ createdAt: -1 }).limit(100);
    res.json(users);
  }catch(err){ console.error('GET /api/admin/users', err); res.status(500).json({ msg: 'Error al listar usuarios' }); }
});

// Crear usuario - JWT DESHABILITADO
router.post('/', async (req, res) => {
  try{
    const { nombre, email, password, role='user', isActive=true, permissions=[] } = req.body;
    if(!nombre || !email || !password) return res.status(400).json({ msg: 'Faltan campos requeridos' });
    const exists = await User.findOne({ email });
    if(exists) return res.status(400).json({ msg: 'Ya existe un usuario con ese correo' });
    const hashed = await bcrypt.hash(password, 10);
    const u = new User({ nombre, email, password: hashed, role, isActive, permissions });
    await u.save();
    res.status(201).json({ msg: 'Usuario creado', user: { _id: u._id, nombre: u.nombre, email: u.email, role: u.role, isActive: u.isActive } });
  }catch(err){ console.error('POST /api/admin/users', err); res.status(500).json({ msg: 'Error creando usuario' }); }
});

// Obtener un usuario - JWT DESHABILITADO
router.get('/:id', async (req, res) => {
  try{
    const u = await User.findById(req.params.id, '-password');
    if(!u) return res.status(404).json({ msg: 'Usuario no encontrado' });
    res.json(u);
  }catch(err){ console.error('GET user', err); res.status(500).json({ msg: 'Error buscando usuario' }); }
});

// Editar usuario (incluye role y estado) - JWT DESHABILITADO
router.put('/:id', async (req, res) => {
  try{
    const { nombre, email, password, role, isActive, permissions } = req.body;
    const u = await User.findById(req.params.id);
    if(!u) return res.status(404).json({ msg: 'Usuario no encontrado' });
    if(nombre) u.nombre = nombre;
    if(email) u.email = email;
    if(typeof isActive === 'boolean') u.isActive = isActive;
    if(role) u.role = role;
    if(Array.isArray(permissions)) u.permissions = permissions;
    if(password) u.password = await bcrypt.hash(password, 10);
    await u.save();
    res.json({ msg: 'Usuario actualizado', user: { _id: u._id, nombre: u.nombre, email: u.email, role: u.role, isActive: u.isActive } });
  }catch(err){ console.error('PUT user', err); res.status(500).json({ msg: 'Error actualizando usuario' }); }
});

// Eliminar usuario - JWT DESHABILITADO
router.delete('/:id', async (req, res) => {
  try{
    const u = await User.findById(req.params.id);
    if(!u) return res.status(404).json({ msg: 'Usuario no encontrado' });
    await u.deleteOne();
    res.json({ msg: 'Usuario eliminado' });
  }catch(err){ console.error('DELETE user', err); res.status(500).json({ msg: 'Error eliminando usuario' }); }
});

export default router;
