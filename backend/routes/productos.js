import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import Producto from "../models/Producto.js";
import User from "../models/User.js";
import { sendMailWithFallback } from "../utils/mail.js";
import { productPublishLimiter, contactLimiter } from "../middleware/rateLimiter.js";
import { 
  validateProduct, 
  handleValidationErrors,
  detectMaliciousContent,
  sanitizeHtml 
} from "../middleware/validation.js";

// URL base del backend para construir enlaces a imágenes y endpoints
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 4000}`;

const router = express.Router();

// configurar multer para subir imágenes a backend/uploads
const uploadDir = path.join(process.cwd(), 'backend', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) { const unique = Date.now() + '-' + Math.round(Math.random()*1E9); cb(null, unique + '-' + file.originalname.replace(/\s+/g,'_')); }
});
const upload = multer({ storage });

// Middleware simple de autenticación JWT
async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ msg: 'No autorizado' });
    const token = auth.slice(7);
    const secret = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
    const payload = jwt.verify(token, secret);
    req.userId = payload.id || payload.userId || payload.id;
    next();
  } catch (err) { console.error('authMiddleware error', err); return res.status(401).json({ msg: 'Token inválido' }); }
}

// Crear producto con protección contra contenido malicioso
router.post('/', authMiddleware, productPublishLimiter, upload.array('images', 6), validateProduct, handleValidationErrors, async (req, res) => {
  try {
    console.log('POST /api/productos body:', req.body);
    console.log('POST /api/productos files:', (req.files || []).map(f => f.filename));
    const { nombre, precio, descripcion, category } = req.body;
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ msg: 'Se requiere al menos 1 foto del producto' });

    // Detectar contenido malicioso en nombre y descripción
    const nombreCheck = detectMaliciousContent(nombre);
    if (!nombreCheck.safe) {
      return res.status(400).json({ 
        msg: `Contenido no permitido en el nombre: ${nombreCheck.reason}`,
        type: nombreCheck.type 
      });
    }

    const descripcionCheck = detectMaliciousContent(descripcion);
    if (!descripcionCheck.safe) {
      return res.status(400).json({ 
        msg: `Contenido no permitido en la descripción: ${nombreCheck.reason}`,
        type: descripcionCheck.type 
      });
    }

    // Sanitizar HTML en campos de texto
    const nombreSanitized = sanitizeHtml(nombre);
    const descripcionSanitized = sanitizeHtml(descripcion);

    const imagePaths = files.map(f => `/uploads/${f.filename}`);
    const producto = new Producto({ 
      nombre: nombreSanitized, 
      precio: Number(precio), 
      descripcion: descripcionSanitized, 
      category, 
      images: imagePaths, 
      owner: req.userId 
    });
    await producto.save();

    // Notificar a administradores para aprobación del producto
    try {
      const adminList = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
      console.log('📧 Administradores a notificar:', adminList);
      
      const approvalSecret = process.env.APPROVAL_SECRET || (process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
      const token = jwt.sign({ productId: producto._id }, approvalSecret, { expiresIn: '30d' });
      const approveUrl = `${BACKEND_URL}/api/productos/approve/${token}`;
      console.log('🔗 URL de aprobación generada:', approveUrl);

      const firstImage = imagePaths[0] ? `${BACKEND_URL}${imagePaths[0]}` : null;
      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com',
        to: adminList.length ? adminList.join(',') : undefined,
        subject: `🔔 [J-PLACE] Nuevo producto pendiente: ${producto.nombre}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f8f8; padding: 20px; border-radius: 10px;">
            <div style="background: linear-gradient(135deg, #20A86F 0%, #16824f 100%); padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 24px;">🛒 J-PLACE</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">Panel de Administración</p>
            </div>
            
            <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <div style="background: #FFF3E0; padding: 15px; border-radius: 8px; border-left: 4px solid #FFA726; margin-bottom: 20px;">
                <h2 style="color: #F57C00; margin: 0 0 5px 0; font-size: 18px;">⏳ Nuevo producto pendiente de aprobación</h2>
                <p style="color: #666; margin: 0; font-size: 14px;">Se requiere tu revisión para publicar este producto</p>
              </div>

              <div style="margin: 20px 0;">
                <h3 style="color: #333; margin: 0 0 15px 0; font-size: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">${producto.nombre}</h3>
                
                <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                  <tr>
                    <td style="padding: 8px 0; color: #888; font-size: 12px; text-transform: uppercase; font-weight: 600;">Categoría</td>
                    <td style="padding: 8px 0; color: #333; font-size: 14px; text-align: right;">
                      <span style="background: #20A86F; color: white; padding: 4px 12px; border-radius: 12px; font-weight: 600;">${producto.category}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #888; font-size: 12px; text-transform: uppercase; font-weight: 600;">Precio</td>
                    <td style="padding: 8px 0; color: #20A86F; font-size: 18px; font-weight: 700; text-align: right;">$${Number(producto.precio).toLocaleString('es-MX')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; color: #888; font-size: 12px; text-transform: uppercase; font-weight: 600;">Vendedor</td>
                    <td style="padding: 8px 0; color: #666; font-size: 14px; text-align: right;">${req.userId}</td>
                  </tr>
                </table>

                <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #20A86F;">
                  <p style="color: #888; font-size: 12px; text-transform: uppercase; font-weight: 600; margin: 0 0 8px 0;">Descripción</p>
                  <p style="color: #555; margin: 0; line-height: 1.6; font-size: 14px;">${producto.descripcion}</p>
                </div>

                ${firstImage ? `
                  <div style="text-align: center; margin: 20px 0;">
                    <img src="${firstImage}" alt="Producto" style="max-width: 100%; height: auto; border-radius: 8px; border: 2px solid #e0e0e0;"/>
                    ${imagePaths.length > 1 ? `<p style="color: #888; font-size: 12px; margin-top: 8px;">+${imagePaths.length - 1} imagen${imagePaths.length > 2 ? 'es' : ''} adicional${imagePaths.length > 2 ? 'es' : ''}</p>` : ''}
                  </div>
                ` : ''}
              </div>

              <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #f0f0f0;">
                <a href="${approveUrl}" style="display: inline-block; background: linear-gradient(135deg, #20A86F 0%, #16824f 100%); color: white; padding: 14px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(32, 168, 111, 0.3);">
                  ✅ Revisar y Aprobar Producto
                </a>
              </div>

              <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px; line-height: 1.5;">
                Al hacer clic en el botón, serás redirigido a una página donde podrás ver todos los detalles del producto y decidir si aprobarlo o rechazarlo.
              </p>
            </div>

            <div style="text-align: center; margin-top: 20px;">
              <p style="color: #999; font-size: 12px; margin: 0;">Este email fue enviado automáticamente por J-PLACE</p>
            </div>
          </div>
        `
      };
      
      console.log('📨 Intentando enviar correo a:', mailOptions.to);
      const mailResult = await sendMailWithFallback(mailOptions);
      
      if (mailResult && mailResult.preview) {
        console.log('✅ Correo de prueba enviado - Preview URL:', mailResult.preview);
        console.log('🔑 Credenciales Ethereal (para pruebas):', mailResult.testAccount);
      } else if (mailResult && mailResult.provider === 'smtp') {
        console.log('✅ Correo enviado exitosamente vía SMTP');
      } else {
        console.warn('⚠️ No se pudo enviar el correo');
      }
    } catch (mailErr) { 
      console.error('❌ Error preparando notificación admins producto:', mailErr); 
    }

    return res.status(201).json({ mensaje: 'Producto creado y pendiente de aprobación del administrador', producto });
  } catch (error) {
    console.error('Error creando producto', error && error.stack ? error.stack : error);
    res.status(500).json({ error: error && error.message ? error.message : String(error) });
  }
});

// Endpoint para mostrar el producto en la página de revisión (GET con token)
router.get('/review/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const approvalSecret = process.env.APPROVAL_SECRET || (process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
    const payload = jwt.verify(token, approvalSecret);
    const productId = payload.productId;
    const producto = await Producto.findById(productId).populate('owner', '-password');
    if (!producto) return res.status(404).json({ msg: 'Producto no encontrado' });
    
    return res.json({ producto, token });
  } catch (err) {
    console.error('Error obteniendo producto para revisión', err);
    return res.status(400).json({ msg: 'Token inválido o expirado' });
  }
});

// Endpoint para aprobar producto desde la página de revisión (POST con token)
router.post('/approve-confirmed/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const approvalSecret = process.env.APPROVAL_SECRET || (process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
    const payload = jwt.verify(token, approvalSecret);
    const productId = payload.productId;
    const producto = await Producto.findById(productId);
    if (!producto) return res.status(404).json({ msg: 'Producto no encontrado' });
    if (producto.isApproved) return res.json({ msg: 'Producto ya aprobado previamente' });

    producto.isApproved = true;
    producto.approvedAt = new Date();
    producto.approvedBy = 'admin-review';
    await producto.save();

    // notificar al propietario con detalles y enlace a la categoría
    try {
      const owner = await User.findById(producto.owner);
      if (owner && owner.email) {
        const productUrlFrontend = (process.env.FRONTEND_URL || 'http://localhost:8000') + `/${producto.category}.html?productId=${producto._id}`;
        const firstImage = producto.images && producto.images[0] ? `${BACKEND_URL}${producto.images[0]}` : null;
        const mailToUser = {
          from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com',
          to: owner.email,
          subject: `✅ Tu producto "${producto.nombre}" ha sido aprobado`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #20A86F;">¡Producto Aprobado!</h2>
              <p>Hola ${owner.nombre || ''},</p>
              <p>Tu producto <strong>${producto.nombre}</strong> ha sido aprobado por un administrador y ahora está visible en la categoría <strong>${producto.category}</strong>.</p>
              <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <h3 style="margin-top: 0;">Detalles del producto:</h3>
                <ul style="list-style: none; padding: 0;">
                  <li><strong>Nombre:</strong> ${producto.nombre}</li>
                  <li><strong>Precio:</strong> $${producto.precio}</li>
                  <li><strong>Categoría:</strong> ${producto.category}</li>
                </ul>
              </div>
              ${ firstImage ? `<p style="text-align: center;"><img src="${firstImage}" alt="imagen" style="max-width:240px;border:1px solid #ddd;padding:4px;border-radius:8px;"/></p>` : '' }
              <p style="text-align: center; margin-top: 30px;">
                <a href="${productUrlFrontend}" style="background: #20A86F; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">Ver producto en J-PLACE</a>
              </p>
              <p style="color: #888; font-size: 14px; margin-top: 30px;">Gracias por publicar en J-PLACE.</p>
            </div>
          `
        };
        sendMailWithFallback(mailToUser).then(r=>{ if(r && r.preview) console.log('Preview URL owner approval:', r.preview); }).catch(e=>console.error('Error notificando owner:', e));
      }
    } catch (err) { console.error('Error notificando propietario:', err); }

    return res.json({ msg: 'Producto aprobado exitosamente', producto });
  } catch (err) {
    console.error('Error aprobando producto', err);
    return res.status(400).json({ msg: 'Token inválido o expirado' });
  }
});

// Endpoint para rechazar producto desde la página de revisión (POST con token)
router.post('/reject/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const approvalSecret = process.env.APPROVAL_SECRET || (process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
    const payload = jwt.verify(token, approvalSecret);
    const productId = payload.productId;
    const producto = await Producto.findById(productId);
    if (!producto) return res.status(404).json({ msg: 'Producto no encontrado' });

    // Notificar al propietario sobre el rechazo antes de eliminar
    try {
      const owner = await User.findById(producto.owner);
      if (owner && owner.email) {
        const firstImage = producto.images && producto.images[0] ? `${BACKEND_URL}${producto.images[0]}` : null;
        const mailToUser = {
          from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com',
          to: owner.email,
          subject: `❌ Tu producto "${producto.nombre}" no fue aprobado`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #f44336;">Producto No Aprobado</h2>
              <p>Hola ${owner.nombre || ''},</p>
              <p>Lamentamos informarte que tu producto <strong>${producto.nombre}</strong> no ha sido aprobado para publicación en J-PLACE.</p>
              <div style="background: #fff3f3; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
                <h3 style="margin-top: 0; color: #f44336;">Producto rechazado:</h3>
                <ul style="list-style: none; padding: 0;">
                  <li><strong>Nombre:</strong> ${producto.nombre}</li>
                  <li><strong>Categoría:</strong> ${producto.category}</li>
                  <li><strong>Precio:</strong> $${producto.precio}</li>
                </ul>
              </div>
              ${ firstImage ? `<p style="text-align: center;"><img src="${firstImage}" alt="imagen" style="max-width:240px;border:1px solid #ddd;padding:4px;border-radius:8px;"/></p>` : '' }
              <p>Posibles razones del rechazo:</p>
              <ul>
                <li>El producto no cumple con nuestras políticas de publicación</li>
                <li>Las imágenes no son adecuadas o de calidad suficiente</li>
                <li>La descripción no es suficientemente clara</li>
                <li>El producto no corresponde a la categoría seleccionada</li>
              </ul>
              <p>Puedes intentar publicar nuevamente con un producto diferente o corregir los aspectos mencionados.</p>
              <p style="text-align: center; margin-top: 30px;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:8000'}/subir_producto.html" style="background: #20A86F; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; display: inline-block;">Publicar otro producto</a>
              </p>
              <p style="color: #888; font-size: 14px; margin-top: 30px;">Si tienes dudas, contacta al equipo de soporte.</p>
            </div>
          `
        };
        sendMailWithFallback(mailToUser).then(r=>{ if(r && r.preview) console.log('Preview URL owner rejection:', r.preview); }).catch(e=>console.error('Error notificando owner sobre rechazo:', e));
      }
    } catch (err) { console.error('Error notificando propietario sobre rechazo:', err); }

    // Eliminar el producto rechazado
    await Producto.findByIdAndDelete(productId);

    return res.json({ msg: 'Producto rechazado y eliminado exitosamente' });
  } catch (err) {
    console.error('Error rechazando producto', err);
    return res.status(400).json({ msg: 'Token inválido o expirado' });
  }
});

// Endpoint heredado para aprobar producto por token (redirige a página de revisión)
router.get('/approve/:token', async (req, res) => {
  try {
    const token = req.params.token;
    console.log('🔗 Redirigiendo a página de aprobación con token:', token);
    // Redirigir a la página de aprobación con el token en la URL
    const redirectTo = `/producto_aprobacion.html?token=${token}`;
    console.log('📍 URL de redirección:', redirectTo);
    return res.redirect(redirectTo);
  } catch (err) {
    console.error('❌ Error redirigiendo a página de aprobación', err);
    return res.status(400).send('Token inválido');
  }
});

// Enviar edición pendiente (propietario puede solicitar cambios que requieren aprobación)
router.post('/:id/edits', authMiddleware, upload.array('images', 6), async (req, res) => {
  try {
    const productId = req.params.id;
    const producto = await Producto.findById(productId);
    if (!producto) return res.status(404).json({ msg: 'Producto no encontrado' });
    if (!producto.owner || producto.owner.toString() !== req.userId) return res.status(403).json({ msg: 'No autorizado: solo el propietario puede solicitar ediciones' });

    const { nombre, precio, descripcion } = req.body;
    const files = req.files || [];
    if (!nombre && !precio && !descripcion && !files.length) return res.status(400).json({ msg: 'Debe enviar al menos un campo a editar o una imagen nueva' });

    const pendingEdits = {};
    if (nombre) pendingEdits.nombre = nombre;
    if (precio) pendingEdits.precio = Number(precio);
    if (descripcion) pendingEdits.descripcion = descripcion;
    if (files.length) pendingEdits.images = files.map(f => `/uploads/${f.filename}`);

    producto.editPending = true;
    producto.pendingEdits = pendingEdits;
    await producto.save();

    // Notificar a administradores para aprobar la edición
    try {
      const adminList = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
      const approvalSecret = process.env.APPROVAL_SECRET || (process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
      const token = jwt.sign({ editProductId: producto._id }, approvalSecret, { expiresIn: '30d' });
      const approveUrl = `${BACKEND_URL}/api/productos/approve-edit/${token}`;

      const currentImage = producto.images && producto.images[0] ? `${BACKEND_URL}${producto.images[0]}` : null;
      const newImage = pendingEdits.images && pendingEdits.images[0] ? `${BACKEND_URL}${pendingEdits.images[0]}` : null;

      const mailOptions = {
        from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com',
        to: adminList.length ? adminList.join(',') : undefined,
        subject: `[J-PLACE] Edición pendiente: ${producto.nombre} (${producto.category})`,
        html: `
          <h3>Edición de producto pendiente de aprobación</h3>
          <p>El propietario solicita cambios para el producto:</p>
          <p><strong>Nombre (actual / propuesto):</strong> ${producto.nombre} / ${pendingEdits.nombre || '(sin cambio)'}<br/>
             <strong>Precio (actual / propuesto):</strong> ${producto.precio} / ${pendingEdits.precio != null ? pendingEdits.precio : '(sin cambio)'}<br/>
          </p>
          <p><strong>Descripción (propuesta):</strong><br/>${pendingEdits.descripcion || '(sin cambio)'}</p>
          ${ currentImage ? `<p>Imagen actual:<br/><img src="${currentImage}" style="max-width:240px;border:1px solid #ddd;padding:4px;"/></p>` : '' }
          ${ newImage ? `<p>Imagen propuesta:<br/><img src="${newImage}" style="max-width:240px;border:1px solid #ddd;padding:4px;"/></p>` : '' }
          <p>Solicitado por: <em>${req.userId}</em></p>
          <p>Para aprobar la edición haga clic aquí: <a href="${approveUrl}">Aprobar edición</a></p>
        `
      };
      sendMailWithFallback(mailOptions).then(r => { if (r && r.preview) console.log('Preview URL admin approve-edit:', r.preview); }).catch(e => console.error('Error notificando admins sobre edición:', e));
    } catch (mailErr) { console.error('Error preparando notificación admins edición producto:', mailErr); }

    return res.json({ msg: 'Edición enviada y pendiente de aprobación por un administrador', productoId: producto._id });
  } catch (err) {
    console.error('Error solicitando edición de producto', err);
    return res.status(500).json({ msg: 'Error interno' });
  }
});

// Endpoint para aprobar una edición pendiente (enlace enviado a admin)
router.get('/approve-edit/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const approvalSecret = process.env.APPROVAL_SECRET || (process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
    const payload = jwt.verify(token, approvalSecret);
    const productId = payload.editProductId;
    const producto = await Producto.findById(productId);
    if (!producto) return res.status(404).send('Producto no encontrado');
    if (!producto.editPending || !producto.pendingEdits) return res.send('No hay ediciones pendientes para este producto');

    // Aplicar cambios pendientes
    const edits = producto.pendingEdits || {};
    if (edits.nombre) producto.nombre = edits.nombre;
    if (edits.precio != null) producto.precio = edits.precio;
    if (edits.descripcion) producto.descripcion = edits.descripcion;
    if (edits.images && edits.images.length) producto.images = edits.images;

    producto.editPending = false;
    producto.pendingEdits = undefined;
    producto.approvedAt = new Date();
    producto.approvedBy = 'admin-edit';
    await producto.save();

    // Notificar al propietario
    try {
      const owner = await User.findById(producto.owner);
      if (owner && owner.email) {
        const productUrlFrontend = (process.env.FRONTEND_URL || 'http://localhost:8000') + `/${producto.category}.html?productId=${producto._id}`;
        const firstImage = producto.images && producto.images[0] ? `${BACKEND_URL}${producto.images[0]}` : null;
        const mailToUser = {
          from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com',
          to: owner.email,
          subject: `Tu edición del producto "${producto.nombre}" ha sido aprobada`,
          html: `
            <p>Hola ${owner.nombre || ''},</p>
            <p>Los cambios que solicitaste para tu producto <strong>${producto.nombre}</strong> han sido aprobados por un administrador.</p>
            <p>Ver en el sitio: <a href="${productUrlFrontend}">Ver producto</a></p>
            ${ firstImage ? `<p><img src="${firstImage}" style="max-width:240px;border:1px solid #ddd;padding:4px;"/></p>` : '' }
          `
        };
        sendMailWithFallback(mailToUser).then(r=>{ if(r && r.preview) console.log('Preview URL owner edit-approved:', r.preview); }).catch(e=>console.error('Error notificando owner sobre edición aprobada:', e));
      }
    } catch (err) { console.error('Error notificando propietario sobre edición aprobada:', err); }

    // Redirigir al admin a la página de la categoría en el frontend para ver el producto actualizado
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8000';
      const redirectTo = `${frontendUrl}/${producto.category}.html?editApproved=1&productId=${producto._id}`;
      return res.redirect(redirectTo);
    } catch (redirErr) {
      console.error('Error redirigiendo al frontend tras aprobación de edición', redirErr);
      return res.send(`Edición del producto '${producto.nombre}' aprobada y aplicada.`);
    }
  } catch (err) {
    console.error('Error aprobando edición de producto', err);
    return res.status(400).send('Token inválido o expirado');
  }
});

// Listar ediciones pendientes (útil para interfaces admin)
router.get('/pending-edits', async (req, res) => {
  try {
    const pendientes = await Producto.find({ editPending: true });
    res.json(pendientes);
  } catch (err) {
    console.error('Error listando ediciones pendientes', err);
    res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Rechazar edición vía token (enlace enviado a admin) — elimina pendingEdits y notifica al propietario
router.get('/reject-edit/:token', async (req, res) => {
  try {
    const token = req.params.token;
    const approvalSecret = process.env.APPROVAL_SECRET || (process.env.JWT_SECRET || 'dev_jwt_secret_change_me');
    const payload = jwt.verify(token, approvalSecret);
    const productId = payload.editProductId;
    const producto = await Producto.findById(productId);
    if (!producto) return res.status(404).send('Producto no encontrado');
    if (!producto.editPending) return res.send('No hay ediciones pendientes para este producto');

    // limpiar edición pendiente
    producto.editPending = false;
    producto.pendingEdits = undefined;
    await producto.save();

    // notificar al propietario sobre el rechazo
    try {
      const owner = await User.findById(producto.owner);
      if (owner && owner.email) {
        const mailToUser = {
          from: process.env.FROM_EMAIL || process.env.SMTP_USER || 'no-reply@example.com',
          to: owner.email,
          subject: `Tu edición del producto "${producto.nombre}" ha sido rechazada`,
          html: `
            <p>Hola ${owner.nombre || ''},</p>
            <p>La edición que solicitaste para tu producto <strong>${producto.nombre}</strong> ha sido revisada y <strong>rechazada</strong> por un administrador.</p>
            <p>Si quieres, vuelve a enviar los cambios desde tu panel de usuario o contacta al equipo de soporte.</p>
          `
        };
        sendMailWithFallback(mailToUser).then(r=>{ if(r && r.preview) console.log('Preview URL owner edit-rejected:', r.preview); }).catch(e=>console.error('Error notificando owner sobre edición rechazada:', e));
      }
    } catch (err) { console.error('Error notificando propietario sobre edición rechazada:', err); }

    try { const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8000'; const redirectTo = `${frontendUrl}/${producto.category}.html?editRejected=1&productId=${producto._id}`; return res.redirect(redirectTo); } catch(e){ return res.send('Edición rechazada y propietario notificado.'); }
  } catch (err) {
    console.error('Error rechazando edición de producto', err);
    return res.status(400).send('Token inválido o expirado');
  }
});

// Obtener producto por id (visible para admins o para comprobar)
router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const producto = await Producto.findById(id).populate('owner', '-password');
    if (!producto) return res.status(404).json({ msg: 'Producto no encontrado' });
    return res.json(producto);
  } catch (err) {
    console.error('Error obteniendo producto por id', err);
    return res.status(500).json({ msg: 'Error del servidor' });
  }
});

// Listar productos pendientes de aprobación (solo admin)
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    // Verificar que el usuario sea admin
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ msg: 'Acceso denegado' });
    }
    
    const productos = await Producto.find({ isApproved: false }).populate('owner', '-password').sort({ createdAt: -1 });
    res.json(productos);
  } catch (error) {
    console.error('Error listando productos pendientes', error);
    res.status(500).json({ msg: 'Error al listar productos pendientes' });
  }
});

// Listar productos públicos (aprobados)
router.get('/', async (req, res) => {
  try {
    const filter = { isApproved: true };
    const { category } = req.query;
    if (category) filter.category = category;
    const productos = await Producto.find(filter).populate('owner', '-password');
    res.json(productos);
  } catch (error) {
    console.error('Error listando productos', error);
    res.status(500).json({ msg: 'Error al listar productos' });
  }
});

export default router;
