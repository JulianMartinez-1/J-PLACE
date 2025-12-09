import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  cantidad: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  precio: {
    type: Number,
    required: true,
    min: 0
  }
});

const cartSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // Un usuario solo tiene un carrito
  },
  items: [cartItemSchema],
  total: {
    type: Number,
    default: 0,
    min: 0
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

// Middleware para actualizar el total antes de guardar
cartSchema.pre('save', function(next) {
  this.total = this.items.reduce((sum, item) => {
    return sum + (item.precio * item.cantidad);
  }, 0);
  this.updatedAt = Date.now();
  next();
});

// Método para agregar un producto al carrito
cartSchema.methods.addItem = function(productoId, precio, cantidad = 1) {
  const existingItem = this.items.find(item => 
    item.producto.toString() === productoId.toString()
  );

  if (existingItem) {
    existingItem.cantidad += cantidad;
  } else {
    this.items.push({ producto: productoId, precio, cantidad });
  }
};

// Método para actualizar cantidad de un item
cartSchema.methods.updateItemQuantity = function(itemId, cantidad) {
  const item = this.items.id(itemId);
  if (item) {
    if (cantidad <= 0) {
      this.items.pull(itemId);
    } else {
      item.cantidad = cantidad;
    }
  }
};

// Método para eliminar un item
cartSchema.methods.removeItem = function(itemId) {
  this.items.pull(itemId);
};

// Método para vaciar el carrito
cartSchema.methods.clear = function() {
  this.items = [];
  this.total = 0;
};

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
