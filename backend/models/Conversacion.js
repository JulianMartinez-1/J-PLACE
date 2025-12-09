import mongoose from 'mongoose';

const mensajeSchema = new mongoose.Schema({
  remitente: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contenido: {
    type: String,
    required: true,
    maxlength: 2000
  },
  leido: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const conversacionSchema = new mongoose.Schema({
  participantes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto'
  },
  oferta: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Oferta'
  },
  mensajes: [mensajeSchema],
  ultimoMensaje: {
    type: Date,
    default: Date.now
  },
  archivosPara: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
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
conversacionSchema.index({ participantes: 1 });
conversacionSchema.index({ producto: 1 });
conversacionSchema.index({ ultimoMensaje: -1 });

// Middleware para actualizar ultimoMensaje y updatedAt
conversacionSchema.pre('save', function(next) {
  if (this.mensajes.length > 0) {
    const ultimoMsg = this.mensajes[this.mensajes.length - 1];
    this.ultimoMensaje = ultimoMsg.createdAt;
  }
  this.updatedAt = Date.now();
  next();
});

// Método para agregar un mensaje
conversacionSchema.methods.addMensaje = function(remitenteId, contenido) {
  this.mensajes.push({
    remitente: remitenteId,
    contenido: contenido.trim()
  });
};

// Método para marcar mensajes como leídos
conversacionSchema.methods.marcarComoLeido = function(usuarioId) {
  this.mensajes.forEach(msg => {
    if (msg.remitente.toString() !== usuarioId.toString() && !msg.leido) {
      msg.leido = true;
    }
  });
};

// Método para contar mensajes no leídos de un usuario
conversacionSchema.methods.contarNoLeidos = function(usuarioId) {
  return this.mensajes.filter(msg => 
    msg.remitente.toString() !== usuarioId.toString() && !msg.leido
  ).length;
};

// Método para archivar conversación para un usuario
conversacionSchema.methods.archivar = function(usuarioId) {
  if (!this.archivosPara.includes(usuarioId)) {
    this.archivosPara.push(usuarioId);
  }
};

// Método para desarchivar conversación
conversacionSchema.methods.desarchivar = function(usuarioId) {
  this.archivosPara = this.archivosPara.filter(id => 
    id.toString() !== usuarioId.toString()
  );
};

// Método estático para buscar o crear conversación entre dos usuarios
conversacionSchema.statics.findOrCreate = async function(usuario1Id, usuario2Id, productoId = null) {
  let conversacion = await this.findOne({
    participantes: { $all: [usuario1Id, usuario2Id] },
    producto: productoId
  });

  if (!conversacion) {
    conversacion = new this({
      participantes: [usuario1Id, usuario2Id],
      producto: productoId
    });
    await conversacion.save();
  }

  return conversacion;
};

const Conversacion = mongoose.model('Conversacion', conversacionSchema);

export default Conversacion;
