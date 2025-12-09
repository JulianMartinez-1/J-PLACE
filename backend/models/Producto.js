import mongoose from "mongoose";

const productoSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  precio: { type: Number, required: true },
  descripcion: { type: String, required: true },
  category: { type: String, required: true },
  images: { type: [String], default: [] },
  // Ediciones pendientes propuestas por el propietario
  editPending: { type: Boolean, default: false },
  pendingEdits: {
    nombre: { type: String },
    precio: { type: Number },
    descripcion: { type: String },
    images: { type: [String] }
  },
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: String, default: null },
  approvedAt: { type: Date, default: null },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
});

export default mongoose.model("Producto", productoSchema);
