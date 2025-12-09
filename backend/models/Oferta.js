import mongoose from 'mongoose';

const mensajeOfertaSchema = new mongoose.Schema({
  autor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contenido: {
    type: String,
    required: true,
    maxlength: 500
  },
  monto: {
    type: Number,
    min: 0
  },
  esContraoferta: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ofertaSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  comprador: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vendedor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  montoInicial: {
    type: Number,
    required: true,
    min: 0
  },
  montoActual: {
    type: Number,
    required: true,
    min: 0
  },
  precioOriginal: {
    type: Number,
    required: true,
    min: 0
  },
  estado: {
    type: String,
    enum: ['pendiente', 'aceptada', 'rechazada', 'contraoferta', 'expirada', 'cancelada'],
    default: 'pendiente'
  },
  mensajes: [mensajeOfertaSchema],
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 72 * 60 * 60 * 1000) // 72 horas
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices para búsquedas rápidas
ofertaSchema.index({ producto: 1, comprador: 1 });
ofertaSchema.index({ vendedor: 1, estado: 1 });
ofertaSchema.index({ comprador: 1, estado: 1 });

// Middleware para actualizar updatedAt
ofertaSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para agregar un mensaje
ofertaSchema.methods.addMensaje = function(autorId, contenido, monto = null, esContraoferta = false) {
  this.mensajes.push({
    autor: autorId,
    contenido,
    monto,
    esContraoferta
  });

  if (esContraoferta && monto) {
    this.montoActual = monto;
    this.estado = 'contraoferta';
  }
};

// Método para aceptar oferta
ofertaSchema.methods.aceptar = function() {
  this.estado = 'aceptada';
};

// Método para rechazar oferta
ofertaSchema.methods.rechazar = function() {
  this.estado = 'rechazada';
};

// Método para cancelar oferta
ofertaSchema.methods.cancelar = function() {
  this.estado = 'cancelada';
};

// Método para verificar si la oferta está vencida
ofertaSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Método estático para expirar ofertas antiguas
ofertaSchema.statics.expireOldOffers = async function() {
  return this.updateMany(
    {
      expiresAt: { $lt: new Date() },
      estado: { $in: ['pendiente', 'contraoferta'] }
    },
    { estado: 'expirada' }
  );
};

const Oferta = mongoose.model('Oferta', ofertaSchema);

export default Oferta;
