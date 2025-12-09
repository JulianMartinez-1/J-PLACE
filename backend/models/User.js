import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  // Roles y estado de la cuenta
  role: { type: String, enum: ['user','moderator','admin'], default: 'user' },
  isActive: { type: Boolean, default: true },
  permissions: { type: [String], default: [] },
  // No requerir aprobación de administrador para registro de usuarios
  isApproved: { type: Boolean, default: true },
  approvedBy: { type: String, default: null },
  approvedAt: { type: Date, default: null },
  // Verificación de identidad para vendedores
  isVerifiedSeller: { type: Boolean, default: false },
  verificationDocuments: { type: [String], default: [] },
  verificationStatus: { type: String, enum: ['pending', 'approved', 'rejected', 'none'], default: 'none' },
  verificationDate: { type: Date, default: null },
  // Recuperación de contraseña
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  // Seguridad y rate limiting
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
  lastLogin: { type: Date, default: null },
  // Auditoría
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
});

const User = mongoose.model("Usuario", userSchema);

export default User;
