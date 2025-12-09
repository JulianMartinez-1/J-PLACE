// ============================================
// CART.JS - Sistema de Carrito de Compras
// ============================================

const API_URL = 'http://localhost:4000/api';

// ============================================
// Funciones de Autenticación
// ============================================

function getAuthToken() {
  return localStorage.getItem('jplace_token');
}

function isAuthenticated() {
  return !!getAuthToken();
}

function redirectToLogin() {
  window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.pathname);
}

// ============================================
// Funciones del Carrito
// ============================================

/**
 * Obtener el carrito del usuario
 */
async function getCart() {
  // JWT DESHABILITADO - funciona sin autenticación
  try {
    const response = await fetch(`${API_URL}/cart`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 404) {
      // Carrito vacío
      return { items: [], total: 0 };
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al obtener el carrito');
    }

    return await response.json();
  } catch (error) {
    console.error('Error en getCart:', error);
    throw error;
  }
}

/**
 * Agregar producto al carrito
 */
async function addToCart(productoId, cantidad = 1) {
  // JWT DESHABILITADO - funciona sin autenticación
  
  // Validar que el producto tenga un ID válido de MongoDB
  if (!productoId || !/^[a-f\d]{24}$/i.test(productoId)) {
    throw new Error('Este producto no está disponible para compra. Solo los productos reales pueden agregarse al carrito.');
  }

  try {
    const response = await fetch(`${API_URL}/cart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ productoId, cantidad })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || error.msg || 'Error al agregar al carrito');
    }

    const cart = await response.json();
    
    // Actualizar contador del carrito
    updateCartCount();
    
    return cart;
  } catch (error) {
    console.error('Error en addToCart:', error);
    throw error;
  }
}

/**
 * Actualizar cantidad de un item en el carrito
 */
async function updateCartItem(itemId, cantidad) {
  if (!isAuthenticated()) {
    redirectToLogin();
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/cart/${itemId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ cantidad })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al actualizar el carrito');
    }

    const cart = await response.json();
    
    // Actualizar contador del carrito
    updateCartCount();
    
    return cart;
  } catch (error) {
    console.error('Error en updateCartItem:', error);
    throw error;
  }
}

/**
 * Eliminar un item del carrito
 */
async function removeCartItem(itemId) {
  if (!isAuthenticated()) {
    redirectToLogin();
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/cart/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al eliminar del carrito');
    }

    const cart = await response.json();
    
    // Actualizar contador del carrito
    updateCartCount();
    
    return cart;
  } catch (error) {
    console.error('Error en removeCartItem:', error);
    throw error;
  }
}

/**
 * Vaciar el carrito completamente
 */
async function clearCart() {
  if (!isAuthenticated()) {
    redirectToLogin();
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/cart`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error al vaciar el carrito');
    }

    // Actualizar contador del carrito
    updateCartCount();
    
    return { message: 'Carrito vaciado' };
  } catch (error) {
    console.error('Error en clearCart:', error);
    throw error;
  }
}

/**
 * Obtener la cantidad de items en el carrito
 */
async function getCartCount() {
  if (!isAuthenticated()) {
    return 0;
  }

  try {
    const response = await fetch(`${API_URL}/cart/count`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.count || 0;
  } catch (error) {
    console.error('Error en getCartCount:', error);
    return 0;
  }
}

/**
 * Actualizar el contador visual del carrito en el navbar
 */
async function updateCartCount() {
  const cartCountElement = document.getElementById('cart-count');
  if (!cartCountElement) return;

  if (!isAuthenticated()) {
    cartCountElement.textContent = '0';
    cartCountElement.style.display = 'none';
    return;
  }

  try {
    const count = await getCartCount();
    cartCountElement.textContent = count;
    cartCountElement.style.display = count > 0 ? 'flex' : 'none';
  } catch (error) {
    console.error('Error al actualizar contador del carrito:', error);
    cartCountElement.textContent = '0';
    cartCountElement.style.display = 'none';
  }
}

// ============================================
// Funciones de UI
// ============================================

/**
 * Mostrar notificación temporal
 */
function showNotification(message, type = 'success') {
  // Crear elemento de notificación
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  
  // Agregar estilos inline si no existen en CSS
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    padding: 15px 20px;
    background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  // Eliminar después de 3 segundos
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 3000);
}

/**
 * Agregar botón de "Agregar al Carrito" a una tarjeta de producto
 */
function addCartButtonToProductCard(productCard, productId) {
  const cardBody = productCard.querySelector('.card-body');
  if (!cardBody) return;

  // Verificar si ya tiene botón de carrito
  if (productCard.querySelector('.add-to-cart-btn')) return;

  // Crear contenedor para el botón si no existe
  let buttonContainer = cardBody.querySelector('.cart-button-container');
  if (!buttonContainer) {
    buttonContainer = document.createElement('div');
    buttonContainer.className = 'cart-button-container';
    buttonContainer.style.cssText = 'margin-top: 1rem;';
    cardBody.appendChild(buttonContainer);
  }

  // Crear botón
  const button = document.createElement('button');
  button.className = 'btn-primary add-to-cart-btn';
  button.textContent = '🛒 Agregar al Carrito';
  button.setAttribute('data-product-id', productId);
  button.style.cssText = 'width: 100%; padding: 0.75rem; font-size: 0.95rem;';
  
  // Agregar evento
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated()) {
      showNotification('Debes iniciar sesión para agregar al carrito', 'error');
      setTimeout(() => redirectToLogin(), 1500);
      return;
    }
    
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Agregando...';
    
    try {
      await addToCart(productId, 1);
      showNotification('¡Producto agregado al carrito!', 'success');
      button.textContent = '✓ Agregado';
      
      setTimeout(() => {
        button.textContent = originalText;
        button.disabled = false;
      }, 2000);
    } catch (error) {
      showNotification(error.message || 'Error al agregar al carrito', 'error');
      button.textContent = originalText;
      button.disabled = false;
    }
  });
  
  // Agregar el botón al contenedor
  buttonContainer.appendChild(button);
}

/**
 * Inicializar botones de carrito en todas las tarjetas de producto
 */
function initializeCartButtons() {
  const productCards = document.querySelectorAll('.product-card');
  
  productCards.forEach((card, index) => {
    // Extraer ID del producto del atributo data-product-id
    let productId = card.getAttribute('data-product-id') || card.dataset.productId;
    
    if (!productId) {
      // Si no tiene ID, intentar extraer de la URL del enlace
      const href = card.getAttribute('href');
      if (href && href.includes('producto_id=')) {
        const urlParams = new URLSearchParams(href.split('?')[1]);
        productId = urlParams.get('producto_id');
      }
    }
    
    // Solo agregar botón si el producto tiene un ID válido (no temporal)
    // Los IDs válidos de MongoDB tienen 24 caracteres hexadecimales
    const isValidMongoId = productId && /^[a-f\d]{24}$/i.test(productId);
    
    if (isValidMongoId) {
      addCartButtonToProductCard(card, productId);
    } else {
      // Para productos sin ID válido, mostrar mensaje informativo
      addInfoMessageToProductCard(card);
    }
  });
}

/**
 * Agregar mensaje informativo a productos sin ID válido
 */
function addInfoMessageToProductCard(productCard) {
  const cardBody = productCard.querySelector('.card-body');
  if (!cardBody) return;

  // Verificar si ya tiene mensaje
  if (productCard.querySelector('.product-info-message')) return;

  // Crear mensaje
  const message = document.createElement('div');
  message.className = 'product-info-message';
  message.style.cssText = 'margin-top: 0.75rem; padding: 0.5rem; background: #f8f9fa; border-radius: 6px; font-size: 0.85rem; color: #6c757d; text-align: center;';
  message.innerHTML = '💡 <em>Producto de ejemplo</em>';
  
  cardBody.appendChild(message);
}

// ============================================
// Inicialización
// ============================================

// Actualizar contador del carrito cuando carga la página
document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
  initializeCartButtons();
});

// Exportar funciones para uso global
window.CartAPI = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  getCartCount,
  updateCartCount,
  showNotification,
  initializeCartButtons
};
