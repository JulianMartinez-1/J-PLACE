# Estructura del Proyecto J-PLACE

## 📂 Organización de Carpetas

### Raíz del Proyecto
```
J-PLACE/
├── .gitignore          # Archivos ignorados por Git
├── README.md           # Documentación principal
├── backend/            # Servidor y API
├── frontend/           # Aplicación web del cliente
└── docs/              # Documentación adicional
```

### Backend (Node.js + Express)
```
backend/
├── middleware/         # Middlewares personalizados
│   ├── auth.js        # Autenticación JWT
│   ├── rateLimiter.js # Control de rate limiting
│   └── validation.js  # Validación de datos
│
├── models/            # Modelos de MongoDB
│   ├── User.js        # Modelo de usuarios
│   ├── Producto.js    # Modelo de productos
│   ├── Cart.js        # Modelo del carrito
│   ├── Pedido.js      # Modelo de pedidos
│   ├── Oferta.js      # Modelo de ofertas
│   └── Conversacion.js # Modelo de mensajes
│
├── routes/            # Rutas de la API
│   ├── auth.js        # Autenticación
│   ├── productos.js   # CRUD de productos
│   ├── cart.js        # Carrito de compras
│   ├── checkout.js    # Proceso de pago
│   ├── ofertas.js     # Sistema de ofertas
│   ├── mensajes.js    # Mensajería
│   └── admin_users.js # Panel de admin
│
├── scripts/           # Scripts de utilidad
│   └── promote_admin.js # Promover usuarios a admin
│
├── uploads/           # Imágenes subidas
│   └── [archivos]     # Imágenes de productos
│
├── utils/             # Utilidades
│   └── mail.js        # Envío de emails
│
├── .env              # Variables de entorno (NO VERSIONAR)
├── db.js             # Conexión a MongoDB
├── server.js         # Punto de entrada
└── package.json      # Dependencias
```

### Frontend (HTML + CSS + JavaScript)
```
frontend/
├── i18n/                      # Internacionalización
│   ├── es.json               # Español
│   ├── en.json               # Inglés
│   ├── fr.json               # Francés
│   ├── de.json               # Alemán
│   └── pt.json               # Portugués
│
├── images/                    # Recursos visuales
│   ├── J-PLACE.png           # Logo
│   ├── slide1.jpg            # Carrusel
│   └── [categorías].jpg      # Imágenes de categorías
│
├── partials/                  # Componentes reutilizables
│   └── footer.html           # Footer del sitio
│
├── Páginas Públicas:
│   ├── index.html            # Landing page
│   ├── login.html            # Inicio de sesión
│   ├── registro.html         # Registro
│   ├── forgot-password.html  # Recuperar contraseña
│   └── reset-password.html   # Resetear contraseña
│
├── Páginas de Categorías (18):
│   ├── tecnologia.html
│   ├── moda.html
│   ├── hogar.html
│   ├── deportes.html
│   ├── electronica.html
│   ├── electrodomesticos.html
│   ├── juguetes.html
│   ├── herramientas.html
│   ├── libros.html
│   ├── belleza.html
│   ├── musica.html
│   ├── mascotas.html
│   ├── jardin.html
│   ├── alimentos.html
│   ├── automoviles.html
│   ├── arte.html
│   ├── fotografia.html
│   ├── oficina.html
│   ├── bebes.html
│   └── salud.html
│
├── Páginas de Usuario:
│   ├── cart.html             # Carrito de compras
│   ├── checkout.html         # Checkout
│   ├── mensajes.html         # Sistema de mensajería
│   ├── ofertas.html          # Gestión de ofertas
│   ├── subir_producto.html   # Publicar producto
│   ├── editar_producto.html  # Editar producto
│   └── producto_aprobacion.html # Aprobación de productos
│
├── Páginas de Admin:
│   ├── admin_users.html      # Gestión de usuarios
│   ├── admin_products.html   # Gestión de productos
│   ├── admin_categories.html # Gestión de categorías
│   ├── admin_commissions.html # Gestión de comisiones
│   ├── admin_sellers.html    # Gestión de vendedores
│   └── admin_dashboard.html  # Dashboard admin
│
├── Scripts y Estilos:
│   ├── main.js               # JavaScript principal
│   ├── cart.js               # Lógica del carrito
│   └── styles.css            # Estilos CSS
```

## 🗂️ Archivos Eliminados (Limpieza)

### Archivos de documentación redundantes:
- ❌ `apply_improvements.ps1`
- ❌ `FUNCIONALIDADES_IMPLEMENTADAS.md`
- ❌ `MEJORAS_PROFESIONALES.md`
- ❌ `SISTEMA_APROBACION.md`
- ❌ `SISTEMA_CARRITO.md`
- ❌ `SISTEMA_SEGURIDAD.md`

### Scripts de prueba del backend:
- ❌ `backend/approve_pending.js`
- ❌ `backend/check_admin.js`
- ❌ `backend/delete_duplicates.js`
- ❌ `backend/duplicate_products.js`
- ❌ `backend/fix_image_paths.js`
- ❌ `backend/generate_approve_links.js`
- ❌ `backend/list_products.js`
- ❌ `backend/send_test_email.js`
- ❌ `backend/test_email.js`
- ❌ `backend/server.log`

### Carpetas duplicadas:
- ❌ `backend/backend/` (carpeta duplicada)

## ✅ Archivos Nuevos Agregados

- ✅ `README.md` - Documentación completa del proyecto
- ✅ `.gitignore` - Configuración de Git
- ✅ `docs/ESTRUCTURA.md` - Este archivo

## 📝 Convenciones de Nombres

### HTML
- Minúsculas con guiones: `admin-users.html`
- Descriptivos: `forgot-password.html`

### JavaScript
- camelCase para variables: `userName`
- PascalCase para clases: `UserModel`
- Archivos descriptivos: `main.js`, `cart.js`

### CSS
- clases con guiones: `.user-avatar`
- IDs con guiones: `#user-area`

### Imágenes
- Minúsculas con guiones
- Descriptivas: `tecnologia-card.jpg`

## 🔧 Mantenimiento

### Para agregar una nueva categoría:
1. Crear `frontend/nueva-categoria.html`
2. Agregar imagen en `frontend/images/`
3. Actualizar `frontend/index.html` (grid de categorías)
4. Agregar traducciones en `frontend/i18n/*.json`

### Para agregar una nueva ruta de API:
1. Crear archivo en `backend/routes/`
2. Importar en `backend/server.js`
3. Agregar middleware si es necesario

---

Última actualización: Diciembre 2025
