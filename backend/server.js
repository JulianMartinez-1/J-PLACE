import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import productosRoutes from "./routes/productos.js";
import adminUsersRoutes from './routes/admin_users.js';
import cartRoutes from './routes/cart.js';
import ofertasRoutes from './routes/ofertas.js';
import checkoutRoutes from './routes/checkout.js';
import mensajesRoutes from './routes/mensajes.js';
import path from 'path';
import { fileURLToPath } from 'url';
import User from './models/User.js';
import bcrypt from 'bcryptjs';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Determinar las rutas correctamente (compatible con ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const uploadsDir = path.join(__dirname, 'uploads');
const frontendDir = path.join(rootDir, 'frontend');

console.log('📂 Rutas configuradas:');
console.log('   Root:', rootDir);
console.log('   Uploads:', uploadsDir);
console.log('   Frontend:', frontendDir);

// servir archivos subidos (imagenes de productos)
app.use('/uploads', express.static(uploadsDir));

// API routes PRIMERO (antes de servir archivos estáticos)
app.use("/api/auth", authRoutes);
app.use("/api/productos", productosRoutes);
app.use('/api/admin/users', adminUsersRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/ofertas', ofertasRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/mensajes', mensajesRoutes);

// servir archivos estáticos del frontend (DESPUÉS de las rutas API)
app.use(express.static(frontendDir));

mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/maketplaceDB")
  .then(async () => {
    console.log("✅ Conectado a MongoDB");
    // Auto-crear admin al arrancar si se configuran variables de entorno
    const adminEmail = process.env.BOOT_ADMIN_EMAIL;
    const adminPassword = process.env.BOOT_ADMIN_PASSWORD;
    if (adminEmail && adminPassword) {
      try {
        let existing = await User.findOne({ email: adminEmail });
        if (!existing) {
          const hashed = await bcrypt.hash(adminPassword, 10);
          const u = new User({ nombre: 'Administrator', email: adminEmail, password: hashed, role: 'admin', isActive: true });
          await u.save();
          console.log('🔐 Admin creado automáticamente:', adminEmail);
        } else if (existing.role !== 'admin') {
          existing.role = 'admin';
          existing.isActive = true;
          await existing.save();
          console.log('🔐 Usuario existente promovido a admin:', adminEmail);
        } else {
          console.log('🔐 Admin ya existente:', adminEmail);
        }
      } catch (e) {
        console.error('Error creando/promoviendo admin inicial:', e);
      }
    }
  })
  .catch((err) => console.error("❌ Error al conectar a MongoDB:", err));

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});
