import mongoose from 'mongoose';

const pedidoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    producto: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto',
      required: true
    },
    nombre: String,
    precio: Number,
    cantidad: Number,
    vendedor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  impuestos: {
    type: Number,
    default: 0,
    min: 0
  },
  envio: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  metodoPago: {
    tipo: {
      type: String,
      enum: ['tarjeta', 'paypal', 'transferencia', 'efectivo'],
      required: true
    },
    estado: {
      type: String,
      enum: ['pendiente', 'procesando', 'completado', 'fallido', 'reembolsado'],
      default: 'pendiente'
    },
    transaccionId: String,
    detalles: {
      // Para tarjeta
      ultimos4Digitos: String,
      tipoTarjeta: String, // visa, mastercard, amex
      // Para transferencia
      banco: String,
      referencia: String,
      // Para PayPal
      paypalEmail: String,
      paypalOrderId: String
    }
  },
  direccionEnvio: {
    nombreCompleto: {
      type: String,
      required: true
    },
    direccion: {
      type: String,
      required: true
    },
    ciudad: {
      type: String,
      required: true
    },
    estado: String,
    codigoPostal: {
      type: String,
      required: true
    },
    pais: {
      type: String,
      default: 'México'
    },
    telefono: {
      type: String,
      required: true
    },
    instrucciones: String
  },
  estado: {
    type: String,
    enum: ['pendiente', 'confirmado', 'procesando', 'enviado', 'entregado', 'cancelado'],
    default: 'pendiente'
  },
  historialEstado: [{
    estado: String,
    fecha: {
      type: Date,
      default: Date.now
    },
    nota: String
  }],
  numeroSeguimiento: String,
  fechaEstimadaEntrega: Date,
  notas: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Índices
pedidoSchema.index({ usuario: 1, createdAt: -1 });
pedidoSchema.index({ 'items.vendedor': 1 });
pedidoSchema.index({ estado: 1 });

// Middleware para actualizar updatedAt
pedidoSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Método para actualizar estado
pedidoSchema.methods.actualizarEstado = function(nuevoEstado, nota = '') {
  this.estado = nuevoEstado;
  this.historialEstado.push({
    estado: nuevoEstado,
    fecha: new Date(),
    nota
  });
};

// Método para calcular totales
pedidoSchema.methods.calcularTotales = function() {
  this.subtotal = this.items.reduce((sum, item) => {
    return sum + (item.precio * item.cantidad);
  }, 0);

  // Calcular impuestos (16% IVA en México)
  this.impuestos = this.subtotal * 0.16;

  // Calcular envío (ejemplo: $99 base, gratis para compras > $500)
  this.envio = this.subtotal > 500 ? 0 : 99;

  this.total = this.subtotal + this.impuestos + this.envio;
};

const Pedido = mongoose.model('Pedido', pedidoSchema);

export default Pedido;
