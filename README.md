# J-PLACE - Marketplace Multi-Vendedor

## 🚀 Descripción
J-PLACE es un marketplace completo que permite a múltiples vendedores publicar y gestionar sus productos, mientras los compradores pueden navegar, agregar al carrito y realizar compras seguras.

## 📁 Estructura del Proyecto

```
J-PLACE/
├── backend/                    # Servidor Node.js + Express
│   ├── middleware/            # Middlewares de autenticación y validación
│   ├── models/               # Modelos de MongoDB (User, Product, Cart, etc.)
│   ├── routes/               # Rutas de la API REST
│   ├── scripts/              # Scripts de utilidad (promote_admin.js)
│   ├── uploads/              # Imágenes de productos subidas
│   ├── utils/                # Utilidades (email, etc.)
│   ├── server.js             # Punto de entrada del servidor
│   ├── db.js                 # Conexión a MongoDB
│   └── package.json          # Dependencias del backend
│
├── frontend/                  # Aplicación web del cliente
│   ├── i18n/                 # Traducciones (es, en, fr, de, pt)
│   ├── images/               # Imágenes estáticas
│   ├── partials/             # Componentes reutilizables (footer, etc.)
│   ├── index.html            # Página principal
│   ├── cart.html             # Carrito de compras
│   ├── checkout.html         # Proceso de pago
│   ├── mensajes.html         # Sistema de mensajería
│   ├── ofertas.html          # Gestión de ofertas
│   ├── main.js               # JavaScript principal
│   ├── cart.js               # Lógica del carrito
│   └── styles.css            # Estilos CSS
│
└── docs/                      # Documentación del proyecto

## 🔧 Tecnologías

### Backend
- Node.js + Express
- MongoDB + Mongoose
- JWT para autenticación
- Multer para subida de archivos
- Nodemailer para emails

### Frontend
- HTML5, CSS3, JavaScript (Vanilla)
- Diseño responsive
- Multi-idioma (i18n)

## 🚀 Instalación

### 1. Configurar Backend

```bash
cd backend
npm install
```

Crear archivo `.env`:
```env
PORT=4000
MONGODB_URI=mongodb://localhost:27017/jplace
JWT_SECRET=tu_secreto_super_seguro
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_password_de_app
```

### 2. Iniciar el servidor

```bash
cd backend
node server.js
```

### 3. Abrir Frontend

Abrir `frontend/index.html` en un navegador o usar un servidor local:

```bash
# Con Python
python -m http.server 8080

# Con Node.js (http-server)
npx http-server frontend -p 8080
```

## 📋 Características Principales

### Para Compradores
- ✅ Navegación por 18 categorías de productos
- ✅ Carrito de compras multi-vendedor
- ✅ Sistema de ofertas y negociación
- ✅ Mensajería directa con vendedores
- ✅ Proceso de checkout completo
- ✅ Multi-idioma (5 idiomas)

### Para Vendedores
- ✅ Publicación de productos con imágenes
- ✅ Gestión de inventario
- ✅ Recepción y gestión de ofertas
- ✅ Mensajería con compradores

### Para Administradores
- ✅ Panel de administración completo
- ✅ Gestión de usuarios y productos
- ✅ Sistema de aprobación de productos
- ✅ Gestión de categorías y comisiones

## 🔐 Seguridad

- Autenticación JWT
- Rate limiting en endpoints críticos
- Validación de datos en backend
- Protección contra inyecciones
- Encriptación de contraseñas con bcrypt

## 📱 Páginas del Frontend

### Públicas
- `index.html` - Landing page
- `login.html` - Inicio de sesión
- `registro.html` - Registro de usuarios
- `forgot-password.html` - Recuperación de contraseña
- `[categoria].html` - Páginas de categorías (18 categorías)

### Usuario Autenticado
- `cart.html` - Carrito de compras
- `checkout.html` - Proceso de pago
- `mensajes.html` - Sistema de mensajería
- `ofertas.html` - Gestión de ofertas
- `subir_producto.html` - Publicar productos
- `editar_producto.html` - Editar productos

### Administradores
- `admin_users.html` - Gestión de usuarios
- `admin_products.html` - Gestión de productos
- `admin_categories.html` - Gestión de categorías
- `admin_commissions.html` - Gestión de comisiones

## 🛠️ Scripts Útiles

### Backend

```bash
# Promover usuario a administrador
node backend/scripts/promote_admin.js usuario@email.com
```

## 📝 API Endpoints

### Autenticación
- `POST /auth/register` - Registro de usuario
- `POST /auth/login` - Inicio de sesión
- `POST /auth/forgot-password` - Recuperar contraseña

### Productos
- `GET /productos` - Listar productos
- `POST /productos` - Crear producto (requiere auth)
- `PUT /productos/:id` - Actualizar producto (requiere auth)
- `DELETE /productos/:id` - Eliminar producto (requiere auth)

### Carrito
- `GET /cart` - Obtener carrito (requiere auth)
- `POST /cart` - Agregar al carrito (requiere auth)
- `DELETE /cart/:itemId` - Eliminar del carrito (requiere auth)

### Ofertas
- `GET /ofertas` - Listar ofertas (requiere auth)
- `POST /ofertas` - Crear oferta (requiere auth)

### Mensajes
- `GET /mensajes` - Listar conversaciones (requiere auth)
- `POST /mensajes` - Enviar mensaje (requiere auth)

## 🎨 Personalización

El tema del sitio utiliza un sistema de variables CSS en `styles.css`:

```css
:root {
  --primary: #20A86F;
  --primary-dark: #16824f;
  --text-on-primary: #ffffff;
}
```

## 📄 Licencia

Proyecto privado - Todos los derechos reservados

## 👨‍💻 Autor

Julian - J-PLACE

---

Para más información o soporte, contacta al administrador del proyecto.
