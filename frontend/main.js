// main.js — manejador de UI y i18n

// Efecto de aparición al hacer scroll
const fadeElements = document.querySelectorAll('.fade-in');
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('visible'); });
});

// --- Edit modal helpers (crear modal y abrir con datos) ---
function createEditModal(){
  if (document.getElementById('edit-product-modal')) return;
  const modal = document.createElement('div'); modal.id = 'edit-product-modal'; modal.className = 'modal'; modal.style.display='none';
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <header class="modal-header"><h3>Editar producto</h3><button type="button" class="modal-close">×</button></header>
        <form id="edit-product-form" enctype="multipart/form-data">
          <input type="hidden" name="productId" id="edit-product-id" />
          <label>Nombre<br/><input name="nombre" id="edit-nombre" required /></label>
          <label>Precio<br/><input name="precio" id="edit-precio" type="number" step="0.01" required /></label>
          <label>Descripción<br/><textarea name="descripcion" id="edit-descripcion" rows="4" required></textarea></label>
          <label>Imágenes (opcional, reemplazan existentes)<br/><input name="images" id="edit-images" type="file" accept="image/*" multiple /></label>
          <div class="modal-actions"><button type="submit" class="btn-primary">Enviar edición</button> <button type="button" class="btn-secondary modal-cancel">Cancelar</button></div>
          <p id="edit-form-feedback" role="status" aria-live="polite"></p>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.querySelector('.modal-close').addEventListener('click', ()=>closeEditModal());
  modal.querySelector('.modal-cancel').addEventListener('click', ()=>closeEditModal());
  const form = modal.querySelector('#edit-product-form');
  form.addEventListener('submit', async (ev)=>{
    ev.preventDefault();
    const feedback = modal.querySelector('#edit-form-feedback'); feedback.textContent='';
    const productId = document.getElementById('edit-product-id').value;
    if (!productId) { feedback.textContent='Producto inválido'; feedback.style.color='crimson'; return; }
    const nombre = document.getElementById('edit-nombre').value.trim();
    const precio = document.getElementById('edit-precio').value;
    const descripcion = document.getElementById('edit-descripcion').value.trim();
    const files = document.getElementById('edit-images').files;

    const fd = new FormData();
    if (nombre) fd.append('nombre', nombre);
    if (precio) fd.append('precio', precio);
    if (descripcion) fd.append('descripcion', descripcion);
    for (let i=0;i<files.length;i++) fd.append('images', files[i]);

    const token = localStorage.getItem('jplace_token');
    const apiOrigin = (location.protocol==='file:'||location.hostname==='localhost'||location.hostname==='127.0.0.1') ? 'http://localhost:4000' : location.origin;
    try {
      const res = await fetch(`${apiOrigin}/api/productos/${productId}/edits`, { method: 'POST', body: fd, headers: token ? { 'Authorization': 'Bearer '+token } : {} });
      const j = await res.json();
      if (!res.ok) { feedback.style.color='crimson'; feedback.textContent = j && j.msg ? j.msg : (j && j.error ? j.error : 'Error enviando edición'); return; }
      feedback.style.color='green'; feedback.textContent = j && j.msg ? j.msg : 'Edición enviada.';
      // después de un breve delay cerramos
      setTimeout(()=>{ closeEditModal(); }, 1100);
    } catch (err) {
      console.error('Error enviando edición', err);
      feedback.style.color='crimson'; feedback.textContent = 'Ocurrió un error al enviar la edición.';
    }
  });

// Normalizar precios estáticos: añadir signo de moneda si falta
document.addEventListener('DOMContentLoaded', () => {
  try {
    const prices = Array.from(document.querySelectorAll('.price'));
    prices.forEach(el => {
      const txt = (el.textContent || '').trim();
      if (!txt) return;
      if (/[$€£S\/]/.test(txt)) return; // ya tiene símbolo
      if (el.dataset && el.dataset.basePrice) {
        el.textContent = '$' + Number(el.dataset.basePrice).toFixed(2);
      } else {
        const num = parseFloat(txt.replace(/[^0-9.,-]/g, '').replace(/,/g, ''));
        if (Number.isFinite(num)) el.textContent = '$' + num.toFixed(2);
      }
    });
  } catch (e) { /* noop */ }
});
}

function openEditModal(product, apiOrigin){
  createEditModal();
  const modal = document.getElementById('edit-product-modal');
  if(!modal) return;
  document.getElementById('edit-product-id').value = product._id || product.id;
  document.getElementById('edit-nombre').value = product.nombre || '';
  document.getElementById('edit-precio').value = product.precio != null ? product.precio : '';
  document.getElementById('edit-descripcion').value = product.descripcion || '';
  // limpiar input file
  try { document.getElementById('edit-images').value = ''; } catch(e){}
  modal.style.display = 'block';
}

function closeEditModal(){ const modal = document.getElementById('edit-product-modal'); if(!modal) return; modal.style.display='none'; const fb = modal.querySelector('#edit-form-feedback'); if(fb) fb.textContent=''; }
fadeElements.forEach(el => observer.observe(el));

// Helper: fetch JSON i18n y cache
const translationsCache = {};
async function loadTranslations(code) {
  if (translationsCache[code]) return translationsCache[code];
  try {
    const res = await fetch(`i18n/${code}.json`, { cache: 'no-cache' });
    if (res.ok) { const j = await res.json(); translationsCache[code] = j; return j; }
  } catch (err) { console.warn('i18n fetch failed', err); }
  // fallback: english or spanish file present in cache
  if (translationsCache['en']) return translationsCache['en'];
  return {};
}

document.addEventListener('DOMContentLoaded', () => {
  // --- Manejo global de UI según sesión (login / register / publicar / footer CTA) ---
  try {
    const userJson = localStorage.getItem('jplace_user');
    const isLogged = !!userJson;

    // Ocultar cualquier enlace de registro en toda la página cuando el usuario esté logueado
    function updateRegisterLinks() {
      const regLinks = Array.from(document.querySelectorAll('.user-register-link'));
      const placeholders = Array.from(document.querySelectorAll('.register-placeholder'));
      const hide = isLogged;
      regLinks.forEach(el => { el.style.display = hide ? 'none' : ''; });
      placeholders.forEach(el => { el.style.display = hide ? 'none' : ''; });
    }

    // Footer CTA (Identifícate) — si el usuario está logueado, ocultarlo
    function updateFooterCTA() {
      const cta = document.querySelector('.footer-cta');
      if (!cta) return;
      cta.style.display = isLogged ? 'none' : '';
    }

    // Botón de login / publicar en la zona de usuario (navbar). Normalizamos clases:
    const userAreaRoot = document.getElementById('user-area');
    if (userAreaRoot) {
      // eliminar duplicados previos
      const existingLogin = userAreaRoot.querySelectorAll('.user-login-link');
      existingLogin.forEach(e => e.remove());
      const existingPublish = userAreaRoot.querySelectorAll('.user-publish-link');
      existingPublish.forEach(e => e.remove());
      const existingAdminLinks = userAreaRoot.querySelectorAll('.admin-panel-link');
      existingAdminLinks.forEach(e => e.remove());

      if (!isLogged) {
        const loginA = document.createElement('a');
        loginA.href = 'login.html';
        loginA.className = 'btn-primary user-login-link';
        loginA.setAttribute('data-i18n', 'auth.login.submit');
        loginA.textContent = 'Iniciar sesión';
        userAreaRoot.insertBefore(loginA, userAreaRoot.firstChild);
        // Ocultar carrito cuando no hay sesión
        const cartIcon = document.getElementById('cart-icon');
        if (cartIcon) cartIcon.style.display = 'none';
      } else {
        // si está logueado, mostrar el botón publicar como destacado y ocultar registro
        const publishA = document.createElement('a');
        publishA.href = 'subir_producto.html';
        publishA.className = 'btn-primary user-publish-link';
        publishA.textContent = 'Publicar';
        userAreaRoot.insertBefore(publishA, userAreaRoot.firstChild);
        
        // Mostrar Mensajes y Ofertas solo en carrito (no en checkout)
        const currentPage = window.location.pathname.split('/').pop();
        const showCartLinks = currentPage === 'cart.html';
        
        if (showCartLinks) {
          // Agregar enlace a Mensajes con diseño profesional
          const mensajesA = document.createElement('a');
          mensajesA.href = 'mensajes.html';
          mensajesA.className = 'btn-ghost user-mensajes-link';
          mensajesA.innerHTML = '<span style="font-size: 1.3rem;">💬</span> Mensajes';
          mensajesA.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 600; display: flex; align-items: center; gap: 0.6rem; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); transition: all 0.3s ease; border: 2px solid transparent;';
          mensajesA.onmouseover = function() {
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
          };
          mensajesA.onmouseout = function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
          };
          userAreaRoot.insertBefore(mensajesA, userAreaRoot.firstChild);
          
          // Agregar enlace a Ofertas con diseño profesional
          const ofertasA = document.createElement('a');
          ofertasA.href = 'ofertas.html';
          ofertasA.className = 'btn-ghost user-ofertas-link';
          ofertasA.innerHTML = '<span style="font-size: 1.3rem;">💰</span> Ofertas';
          ofertasA.style.cssText = 'background: white; color: #667eea; padding: 0.75rem 1.5rem; border-radius: 12px; font-weight: 600; display: flex; align-items: center; gap: 0.6rem; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); transition: all 0.3s ease; border: 2px solid #667eea;';
          ofertasA.onmouseover = function() {
            this.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            this.style.color = 'white';
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.4)';
          };
          ofertasA.onmouseout = function() {
            this.style.background = 'white';
            this.style.color = '#667eea';
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
          };
          userAreaRoot.insertBefore(ofertasA, userAreaRoot.firstChild);
        }
        
        // Mostrar carrito cuando hay sesión
        const cartIcon = document.getElementById('cart-icon');
        if (cartIcon) cartIcon.style.display = 'inline-flex';
        // Si el usuario actual es administrador, añadir enlace al panel de admin
        try {
          const parsedUser = userJson ? JSON.parse(userJson) : null;
          if (parsedUser && parsedUser.role === 'admin') {
            const adminA = document.createElement('a');
            adminA.href = 'admin_users.html';
            adminA.className = 'btn-ghost admin-panel-link';
            adminA.textContent = 'Panel administradores';
            // colocarlo junto al botón publicar
            userAreaRoot.insertBefore(adminA, publishA.nextSibling);
          }
        } catch (e) { /* noop */ }
      }
    }

    // función pública para actualizar la presencia del enlace admin (llamable desde otros listeners)
    function updateAdminLink() {
      try {
        const root = document.getElementById('user-area'); if (!root) return;
        Array.from(root.querySelectorAll('.admin-panel-link')).forEach(n=>n.remove());
        const ujson = localStorage.getItem('jplace_user'); if (!ujson) return;
        const u = JSON.parse(ujson);
        if (u && u.role === 'admin') {
          // crear enlace y colocarlo antes del primer hijo (o después del publicar si existe)
          const adminA = document.createElement('a'); adminA.href='admin_users.html'; adminA.className='btn-ghost admin-panel-link'; adminA.textContent='Panel administradores';
          const publishEl = root.querySelector('.user-publish-link');
          if (publishEl && publishEl.parentNode) publishEl.parentNode.insertBefore(adminA, publishEl.nextSibling); else root.insertBefore(adminA, root.firstChild);
        }
      } catch (err) { /* noop */ }
    }
    window.__jplace_updateAdminLink = updateAdminLink;

    // aplicar los cambios iniciales
    updateRegisterLinks();
    updateFooterCTA();

    // Exponer funciones para ser llamadas después de inyectar el footer
    window.__jplace_updateRegisterLinks = updateRegisterLinks;
    window.__jplace_updateFooterCTA = updateFooterCTA;
    // (Nota: el control por bandera 'blocked' fue eliminado — ahora sólo se oculta al estar logueado)

  } catch (err) { console.error('Error asegurando login/publish UI:', err); }

    // Escuchar cambios de sesión desde otras pestañas/ventanas y aplicar cambios UI
  try {
    window.addEventListener('storage', (ev) => {
      if (!ev) return;
      if (ev.key === 'jplace_user') {
        try { if (typeof window.__jplace_updateRegisterLinks === 'function') window.__jplace_updateRegisterLinks(); } catch(e){}
        try { if (typeof window.__jplace_updateFooterCTA === 'function') window.__jplace_updateFooterCTA(); } catch(e){}
        try { if (typeof window.__jplace_updateAdminLink === 'function') window.__jplace_updateAdminLink(); } catch(e){}
      }
    });
  } catch (e) { /* noop */ }

  // --- Carrusel  ---
  (function initCarousel(){
    const carousel = document.getElementById('heroCarousel');
    if (!carousel) return;
    const slides = Array.from(carousel.querySelectorAll('.carousel-slide'));
    const indicatorsContainer = carousel.querySelector('.carousel-indicators');
    if (!slides.length) return;
    slides.forEach((_, i) => {
      const btn = document.createElement('button'); btn.className='indicator'; btn.type='button';
      btn.setAttribute('aria-label', `Ir a la imagen ${i+1}`);
      btn.addEventListener('click', () => goTo(i));
      indicatorsContainer.appendChild(btn);
    });
    const indicators = Array.from(indicatorsContainer.children);
    let current = 0; const intervalMs = 3500; let timer = null;
    function update(){ slides.forEach((s, idx)=>{ s.classList.toggle('active', idx===current); s.setAttribute('aria-hidden', idx===current ? 'false':'true'); }); indicators.forEach((b,idx)=>b.classList.toggle('active', idx===current)); }
    function goTo(i){ current = (i+slides.length)%slides.length; update(); resetTimer(); }
    function next(){ goTo(current+1); }
    function resetTimer(){ if (timer) clearInterval(timer); timer = setInterval(next, intervalMs); }
    update(); resetTimer();
    carousel.addEventListener('mouseenter', ()=>{ if (timer) clearInterval(timer); });
    carousel.addEventListener('mouseleave', ()=>{ resetTimer(); });
  })();

  // --- Newsletter ---
  (function initNewsletter(){
    const form = document.getElementById('newsletter-form');
    const input = document.getElementById('newsletter-email');
    const feedback = document.getElementById('newsletter-feedback');
    if (!form || !input || !feedback) return;
    form.addEventListener('submit', ev=>{
      ev.preventDefault(); const email = (input.value||'').trim();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { feedback.textContent='Por favor ingresa un correo válido.'; feedback.style.color='crimson'; return; }
      try{
        const key='jplace_newsletter_subscribers_v1'; const listRaw=localStorage.getItem(key); const list=listRaw?JSON.parse(listRaw):[]; if(!list.includes(email)){ list.push(email); localStorage.setItem(key, JSON.stringify(list)); }
        input.value=''; feedback.style.color=''; feedback.textContent='¡Gracias! Te hemos enviado un correo de confirmación (simulado).';
      }catch(err){ feedback.style.color='crimson'; feedback.textContent='Ocurrió un error guardando tu correo. Intenta de nuevo.'; console.error(err); }
    });
  })();

  // --- Avatar usuario ---
  (function initAvatar(){
    try{
      const userArea = document.getElementById('user-area'); if(!userArea) return; const raw = localStorage.getItem('jplace_user'); if(!raw) return; const user = JSON.parse(raw);
      try { if (typeof window.__jplace_updateRegisterLinks === 'function') window.__jplace_updateRegisterLinks(); else { const regLink = userArea.querySelector('.user-register-link'); if (regLink) regLink.style.display='none'; document.querySelectorAll('.register-placeholder').forEach(el=>el.style.display='none'); } } catch(e){}
      const name = (user.nombre||user.name||'').trim(); let initials=''; if (name){ const parts=name.split(/\s+/).filter(Boolean); const first=parts[0]?parts[0].charAt(0).toUpperCase():''; const last=parts.length>1?parts[parts.length-1].charAt(0).toUpperCase():''; initials=(first+last)||(user.email?user.email.charAt(0).toUpperCase():'U'); } else { initials = user.email?user.email.charAt(0).toUpperCase():'U'; }
      const avatar = document.createElement('button'); avatar.className='user-avatar'; avatar.type='button'; avatar.title = name || user.email || 'Cuenta'; avatar.textContent=initials;
      avatar.addEventListener('click', ()=>{ let menu=document.getElementById('user-menu'); if(menu){ menu.remove(); return; } menu=document.createElement('div'); menu.id='user-menu'; menu.className='user-menu'; menu.innerHTML = `<div class="user-menu-name">${name||user.email}</div><button id="logout-btn" class="btn-secondary">Cerrar sesión</button>`; userArea.appendChild(menu); document.getElementById('logout-btn').addEventListener('click', ()=>{ localStorage.removeItem('jplace_user'); localStorage.removeItem('jplace_token'); location.reload(); }); });
      userArea.appendChild(avatar);
      // después de insertar el avatar (y al crear el menú), asegurarnos de ocultar CTA/footer y links si aplica
      try { if (typeof window.__jplace_updateRegisterLinks === 'function') window.__jplace_updateRegisterLinks(); } catch(e){}
      try { if (typeof window.__jplace_updateFooterCTA === 'function') window.__jplace_updateFooterCTA(); } catch(e){}
    }catch(err){ console.error('Error al leer usuario desde localStorage', err); }
  })();

  // --- Filtrado y paginación ---
  (function initProducts(){
    const grids = Array.from(document.querySelectorAll('.products-grid'));
    if (!grids.length) return;
    // Si estamos en una página de categoría, cargamos productos desde la API
    try {
      const categoryHero = document.querySelector('.category-hero');
      const category = categoryHero && categoryHero.dataset && categoryHero.dataset.category;
      if (category) {
        let apiOrigin;
        if (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
          apiOrigin = 'http://localhost:4000';
        } else {
          apiOrigin = location.origin;
        }
        const targetGrid = document.querySelector('.products-grid');
        if (targetGrid) {
          targetGrid.innerHTML = '<p style="opacity:.7">Cargando productos...</p>';
          fetch(`${apiOrigin}/api/productos?category=${encodeURIComponent(category)}`).then(r=>r.json()).then(list=>{
            if (!Array.isArray(list) || !list.length) { targetGrid.innerHTML = '<p>No hay productos publicados aún en esta categoría.</p>'; return; }
            targetGrid.innerHTML = '';
            const currentUserRaw = localStorage.getItem('jplace_user');
            const currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : null;
            list.forEach(p=>{
              const img = (p.images && p.images[0]) ? ((p.images[0].startsWith('http')||p.images[0].startsWith('//')) ? p.images[0] : (apiOrigin + p.images[0])) : 'images/placeholder.png';
              const a = document.createElement('div'); a.className='product-card'; a.href='#'; a.dataset.subcategory = '';
              a.dataset.productId = p._id || p.id;
              a.dataset.owner = (p.owner && (typeof p.owner === 'string' || typeof p.owner === 'number')) ? p.owner : (p.owner && p.owner._id ? p.owner._id : '');
              if (p.owner && p.owner.email) a.dataset.ownerEmail = p.owner.email;
              const displayPrice = `$${Number(p.precio).toFixed(2)}`;
              a.innerHTML = `<img src="${img}" alt="${p.nombre}" />
                <div class="card-body">
                  <h4>${p.nombre}</h4>
                  <p>${(p.descripcion||'').slice(0,120)}</p>
                  <div class="price" data-base-price="${p.precio}">${displayPrice}</div>
                </div>`;

              // Si el usuario actual es el propietario, mostrar botón Editar
              try {
                const ownerId = a.dataset.owner;
                const ownerEmail = a.dataset.ownerEmail;
                const loggedId = currentUser && (currentUser._id || currentUser.id || currentUser.userId || currentUser.id_user) ? (currentUser._id||currentUser.id||currentUser.userId||currentUser.id_user) : null;
                const loggedEmail = currentUser && (currentUser.email || currentUser.mail) ? (currentUser.email || currentUser.mail) : null;
                // modo debug: si se pasa ?debug_show_edit=1 o localStorage.jplace_debug_show_edit === '1', forzar mostrar el botón Editar
                const qs = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
                const forceShow = (qs && qs.get('debug_show_edit') === '1') || (localStorage && localStorage.getItem && localStorage.getItem('jplace_debug_show_edit') === '1');
                if (forceShow || ( (loggedId && ownerId && String(loggedId) === String(ownerId)) || (loggedEmail && ownerEmail && String(loggedEmail).toLowerCase() === String(ownerEmail).toLowerCase()) )) {
                  const editBtn = document.createElement('button');
                  editBtn.type = 'button';
                  editBtn.className = 'btn-ghost edit-product-btn';
                  editBtn.textContent = 'Editar';
                  if (forceShow) editBtn.title = 'Editar (modo depuración: forzado)';
                  editBtn.addEventListener('click', (ev)=>{ ev.preventDefault();
                    // navegar a la página de edición con el id del producto
                    const pid = p._id || p.id;
                    const url = `editar_producto.html?productId=${encodeURIComponent(pid)}`;
                    window.location.href = url;
                  });
                  // asegurar contenedor de acciones y añadir botón allí para mejor layout
                  let actions = a.querySelector('.card-actions');
                  if (!actions) {
                    actions = document.createElement('div');
                    actions.className = 'card-actions';
                    // colocar acciones después del precio
                    const body = a.querySelector('.card-body') || a;
                    body.appendChild(actions);
                  }
                  actions.appendChild(editBtn);
                  // añadir badge de depuración con owner (visibilidad baja) para ayudar a comprobar coincidencias
                  if (!a.querySelector('.owner-badge')) {
                    const badge = document.createElement('div'); badge.className='owner-badge'; badge.style.fontSize='0.75rem'; badge.style.opacity='0.7'; badge.style.marginTop='6px'; badge.textContent = ownerEmail ? `owner: ${ownerEmail}` : `ownerId: ${ownerId}`;
                    actions.appendChild(badge);
                  }
                }
              } catch (e) { /* silently ignore */ }

              targetGrid.appendChild(a);
            });
            // crear modal de edición una sola vez
            if (!document.getElementById('edit-product-modal')) createEditModal();
            // después de inyectar productos aplicar conversión de moneda si corresponde
            const storedCur = localStorage.getItem('jplace_currency') || 'USD';
            // usar la función existente updatePrices si está definida
            try { updatePrices(storedCur); } catch(e){}
            // aplicar mejoras visuales después de renderizar productos (stagger, ripple)
            try { if (typeof window.__jplace_afterRenderProducts === 'function') window.__jplace_afterRenderProducts(targetGrid); } catch(err) { console.warn('afterRenderProducts call failed', err); }
            // Inicializar botones de carrito en productos dinámicos
            try { if (typeof window.CartAPI !== 'undefined' && window.CartAPI.initializeCartButtons) window.CartAPI.initializeCartButtons(); } catch(err) { console.warn('Cart buttons initialization failed', err); }
          }).catch(err=>{ console.error('Error cargando productos por categoría', err); if(targetGrid) targetGrid.innerHTML='<p>Error cargando productos.</p>'; });
        }
      }
    } catch(e){ console.error('Error initProducts category load', e); }
    grids.forEach(grid=>{
      const products = Array.from(grid.querySelectorAll('.product-card'));
      const loadMoreBtn = grid.parentElement.querySelector('.load-more');
      const subcatControls = Array.from(document.querySelectorAll('.subcat-card'));
      const filterBtns = Array.from(document.querySelectorAll('.filter-btn'));
      const perPage = 6; let currentLimit = perPage; let activeFilter='all';
      function updateVisibility(){ const matching = products.filter(p=>{ const sub=(p.dataset.subcategory||'').toLowerCase(); return activeFilter==='all'?true:sub===activeFilter; }); products.forEach(p=>p.classList.add('hidden')); matching.forEach((p,idx)=>{ if(idx<currentLimit) p.classList.remove('hidden'); }); if(loadMoreBtn) loadMoreBtn.style.display = matching.length>currentLimit ? 'inline-block' : 'none'; }
      updateVisibility();
      subcatControls.forEach(btn=> btn.addEventListener('click', e=>{ e.preventDefault(); const sub=(btn.dataset.subcat||'').toLowerCase()||'all'; activeFilter = sub==='all'?'all':sub; currentLimit = perPage; document.querySelectorAll('.subcat-card').forEach(b=>b.classList.toggle('active', b===btn)); updateVisibility(); window.scrollTo({ top: grid.offsetTop-120, behavior: 'smooth' }); }));
      filterBtns.forEach(fb=> fb.addEventListener('click', ()=>{ activeFilter='all'; currentLimit=perPage; document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active')); fb.classList.add('active'); updateVisibility(); }));
      if (loadMoreBtn) loadMoreBtn.addEventListener('click', ()=>{ currentLimit+=perPage; updateVisibility(); });
    });
  })();

  // --- i18n & footer injection ---
  (function initI18nAndFooter(){
    const LANG_KEY = 'jplace_lang';
    const available = [ {code:'es',name:'Español',flag:'🇪🇸'}, {code:'en',name:'English',flag:'🇺🇸'}, {code:'pt',name:'Português',flag:'🇧🇷'}, {code:'fr',name:'Français',flag:'🇫🇷'}, {code:'de',name:'Deutsch',flag:'🇩🇪'} ];

    function findLangButton(){ const all = Array.from(document.querySelectorAll('.btn-ghost')); return all.find(b => (b.textContent||'').trim().toLowerCase().includes('español')) || document.getElementById('lang-btn') || null; }

    function createDropdown(button){ if(!button) return null; if(button.dataset.langAttached) return button; button.dataset.langAttached='1'; button.type='button'; button.setAttribute('aria-haspopup','true'); button.setAttribute('aria-expanded','false');
      const menu = document.createElement('div'); menu.className='lang-menu'; menu.setAttribute('role','menu'); menu.style.display='none';
      available.forEach(lang=>{ const it=document.createElement('button'); it.type='button'; it.className='lang-item'; it.setAttribute('role','menuitemradio'); it.dataset.langCode=lang.code; const flag=document.createElement('span'); flag.className='lang-flag'; flag.textContent=lang.flag||''; const name=document.createElement('span'); name.className='lang-name'; name.textContent=lang.name; const chk=document.createElement('span'); chk.className='lang-check'; chk.style.marginLeft='8px'; it.appendChild(flag); it.appendChild(name); it.appendChild(chk); it.addEventListener('click', ()=>{ setLanguage(lang.code); hideMenu(); }); it.addEventListener('keydown', ev=>{ if(ev.key==='Enter' || ev.key===' '){ ev.preventDefault(); it.click(); } }); menu.appendChild(it); });
      document.body.appendChild(menu);
      function placeMenu(){ const rect = button.getBoundingClientRect(); menu.style.top = (rect.bottom + window.scrollY + 6) + 'px'; menu.style.left = (rect.left + window.scrollX) + 'px'; menu.style.minWidth = Math.max(140, rect.width) + 'px'; }
      function showMenu(){ placeMenu(); menu.style.display='block'; button.setAttribute('aria-expanded','true'); }
      function hideMenu(){ menu.style.display='none'; button.setAttribute('aria-expanded','false'); }
      button.addEventListener('click', e=>{ e.stopPropagation(); if(menu.style.display==='block') hideMenu(); else showMenu(); });
      document.addEventListener('click', ev=>{ if(!menu.contains(ev.target) && ev.target !== button) hideMenu(); });
      menu.addEventListener('keydown', ev=>{ const items=Array.from(menu.querySelectorAll('.lang-item')); const idx = items.indexOf(document.activeElement); if(ev.key==='ArrowDown'){ ev.preventDefault(); const next = items[(idx+1+items.length)%items.length]; next.focus(); } if(ev.key==='ArrowUp'){ ev.preventDefault(); const prev = items[(idx-1+items.length)%items.length]; prev.focus(); } if(ev.key==='Escape'){ hideMenu(); button.focus(); } });
      button.addEventListener('keydown', ev=>{ if(ev.key==='ArrowDown' || ev.key==='Enter' || ev.key===' '){ ev.preventDefault(); showMenu(); const first = menu.querySelector('.lang-item'); if(first) first.focus(); } });
      window.addEventListener('resize', ()=>{ if(menu.style.display==='block') placeMenu(); }); window.addEventListener('scroll', ()=>{ if(menu.style.display==='block') placeMenu(); });
      return button;
    }

    async function applyTranslations(code){ const tRoot = await loadTranslations(code); try{ document.documentElement.lang = code; }catch(e){}
      // data-i18n
      Array.from(document.querySelectorAll('[data-i18n]')).forEach(el=>{ const key = el.dataset.i18n; if(!key) return; const parts = key.split('.'); let val = tRoot; for(const p of parts){ if(val && Object.prototype.hasOwnProperty.call(val,p)) val = val[p]; else { val = null; break; } } if(typeof val === 'string') el.innerHTML = val; });
      // placeholders
      Array.from(document.querySelectorAll('[data-i18n-placeholder]')).forEach(el=>{ const key = el.dataset.i18nPlaceholder; if(!key) return; const parts = key.split('.'); let val = tRoot; for(const p of parts){ if(val && Object.prototype.hasOwnProperty.call(val,p)) val = val[p]; else { val = null; break; } } if(typeof val === 'string') el.placeholder = val; });
      // footer fallbacks
      const cols = Array.from(document.querySelectorAll('.site-footer .footer-col h3'));
      if(tRoot.footer && tRoot.footer.cols) cols.forEach((el,idx)=>{ if(tRoot.footer.cols[idx]) el.textContent = tRoot.footer.cols[idx]; });
      const helpItems = Array.from(document.querySelectorAll('.site-footer .footer-col:last-child ul li'));
      if(tRoot.footer && tRoot.footer.helpLinks) helpItems.forEach((li,idx)=>{ if(tRoot.footer.helpLinks[idx]) li.innerHTML = `<a href="#">${tRoot.footer.helpLinks[idx]}</a>`; });
      // actualizar botón idioma
      const langBtn = findLangButton(); if(langBtn){ const found = available.find(l=>l.code===code) || available[0]; langBtn.innerHTML=''; const f=document.createElement('span'); f.textContent = found.flag||''; f.style.marginRight='8px'; const n=document.createElement('span'); n.textContent = found.name; langBtn.appendChild(f); langBtn.appendChild(n); }
      // marcar menu
      const menuItems = document.querySelectorAll('.lang-item'); menuItems.forEach(mi=>{ const codeAttr = mi.dataset.langCode; if(codeAttr===code) mi.classList.add('lang-selected'); else mi.classList.remove('lang-selected'); mi.setAttribute('aria-checked', codeAttr===code ? 'true' : 'false'); });
      try{ localStorage.setItem(LANG_KEY, code); }catch(e){}
    }

    function setLanguage(code){ applyTranslations(code); }

    async function loadFooter(){ const containers = Array.from(document.querySelectorAll('#footer-include')); if(!containers.length) return; try{ const resp = await fetch('partials/footer.html', { cache: 'no-cache' }); if(!resp.ok){ console.warn('No se pudo cargar partial footer:', resp.status); return; } const html = await resp.text(); containers.forEach(c=>{ c.innerHTML = html; }); }catch(err){ console.error('Error cargando footer partial:', err); } }


    (async ()=>{
      const initial = (localStorage.getItem(LANG_KEY) || 'es');
      await loadFooter();
      // después de inyectar el footer, ejecutar ajustes de UI dependientes del DOM
      try { if (typeof window.__jplace_updateRegisterLinks === 'function') window.__jplace_updateRegisterLinks(); } catch(e){}
      try { if (typeof window.__jplace_updateFooterCTA === 'function') window.__jplace_updateFooterCTA(); } catch(e){}
      const btn = findLangButton(); if(btn) createDropdown(btn);
      await applyTranslations(initial);
    })();
  })();

});

  /* Currency selector + price conversion */
  document.addEventListener('DOMContentLoaded', () => {
    const CURRENCY_KEY = 'jplace_currency';
    // rates are relative to USD (base currency)
    const currencyRates = {
      USD: 1,
      EUR: 0.92,
      GBP: 0.78,
      MXN: 18.5,
      PEN: 3.7
    };

    const currencyLocales = {
      USD: 'en-US',
      EUR: 'de-DE',
      GBP: 'en-GB',
      MXN: 'es-MX',
      PEN: 'es-PE'
    };

    const currencies = [
      { code: 'USD', name: 'US Dollar', symbol: '$' },
      { code: 'EUR', name: 'Euro', symbol: '€' },
      { code: 'GBP', name: 'British Pound', symbol: '£' },
      { code: 'MXN', name: 'Mexican Peso', symbol: '$' },
      { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/' }
    ];

    function findCurrencyButton() {
      return document.getElementById('currency-btn') || Array.from(document.querySelectorAll('.btn-ghost')).find(b => (b.textContent || '').includes('USD')) || null;
    }

    function createCurrencyDropdown(button) {
      if (!button) return null;
      if (button.dataset.currencyAttached) return button;
      button.dataset.currencyAttached = '1';
      button.type = 'button';
      button.setAttribute('aria-haspopup', 'true');
      button.setAttribute('aria-expanded', 'false');

      const menu = document.createElement('div');
      menu.className = 'lang-menu currency-menu';
      menu.setAttribute('role', 'menu');
      menu.style.display = 'none';

      currencies.forEach(cur => {
        const it = document.createElement('button');
        it.type = 'button';
        it.className = 'currency-item';
        it.dataset.currency = cur.code;
        it.innerHTML = `<span class="lang-flag">${cur.symbol}</span><span class="lang-name">${cur.code} - ${cur.name}</span>`;
        it.addEventListener('click', () => { setCurrency(cur.code); hideMenu(); });
        it.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); it.click(); } });
        menu.appendChild(it);
      });

      document.body.appendChild(menu);

      function placeMenu() {
        const rect = button.getBoundingClientRect();
        menu.style.top = (rect.bottom + window.scrollY + 6) + 'px';
        menu.style.left = (rect.left + window.scrollX) + 'px';
        menu.style.minWidth = Math.max(160, rect.width) + 'px';
      }

      function showMenu() { placeMenu(); menu.style.display = 'block'; button.setAttribute('aria-expanded', 'true'); }
      function hideMenu() { menu.style.display = 'none'; button.setAttribute('aria-expanded', 'false'); }

      button.addEventListener('click', (e) => { e.stopPropagation(); if (menu.style.display === 'block') hideMenu(); else showMenu(); });
      document.addEventListener('click', (ev) => { if (!menu.contains(ev.target) && ev.target !== button) hideMenu(); });
      menu.addEventListener('keydown', (ev) => {
        const items = Array.from(menu.querySelectorAll('.currency-item'));
        const idx = items.indexOf(document.activeElement);
        if (ev.key === 'ArrowDown') { ev.preventDefault(); const next = items[(idx+1+items.length)%items.length]; next.focus(); }
        if (ev.key === 'ArrowUp') { ev.preventDefault(); const prev = items[(idx-1+items.length)%items.length]; prev.focus(); }
        if (ev.key === 'Escape') { hideMenu(); button.focus(); }
      });

      window.addEventListener('resize', () => { if (menu.style.display === 'block') placeMenu(); });
      window.addEventListener('scroll', () => { if (menu.style.display === 'block') placeMenu(); });

      return button;
    }

    function formatCurrency(amount, code) {
      const locale = currencyLocales[code] || 'en-US';
      try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: 2 }).format(amount);
      } catch (e) {
        // fallback simple
        return (code === 'USD' ? '$' : '') + amount.toFixed(2);
      }
    }

    function updatePrices(targetCurrency) {
      const rates = currencyRates;
      const curRate = rates[targetCurrency] || 1;
      const baseCurrency = 'USD';
      const displayedCurrency = targetCurrency;
      const prices = Array.from(document.querySelectorAll('.price'));
      prices.forEach(el => {
        // determine base price in USD
        let base = null;
        if (el.dataset.basePrice) {
          base = parseFloat(el.dataset.basePrice);
        } else {
          // parse displayed number
          const txt = (el.textContent || '').trim();
          const num = parseFloat(txt.replace(/[^0-9.,-]/g, '').replace(/,/g, ''));
          if (Number.isFinite(num)) {
            // if current stored currency differs from USD, try to reverse using stored currency
            const storedCur = localStorage.getItem(CURRENCY_KEY) || 'USD';
            if (storedCur !== baseCurrency && currencyRates[storedCur]) {
              base = num / currencyRates[storedCur];
            } else {
              base = num; // assume it's already USD
            }
          } else {
            base = 0;
          }
          el.dataset.basePrice = String(base);
        }

        const converted = (base || 0) * curRate;
        el.textContent = formatCurrency(converted, displayedCurrency);
      });
    }

    function applyCurrencyToButton(code) {
      const btn = findCurrencyButton();
      if (!btn) return;
      const cur = currencies.find(c => c.code === code) || currencies[0];
      btn.innerHTML = `${cur.symbol} ${cur.code} - ${cur.name}`;
    }

    function setCurrency(code) {
      try { localStorage.setItem(CURRENCY_KEY, code); } catch (e) {}
      applyCurrencyToButton(code);
      updatePrices(code);
    }

    // initialize currency controls after footer injection
    (function initCurrency() {
      const curBtn = findCurrencyButton();
      if (curBtn) createCurrencyDropdown(curBtn);
      const initialCur = (localStorage.getItem(CURRENCY_KEY) || 'USD');
      applyCurrencyToButton(initialCur);
      // ensure base prices are established and then convert
      updatePrices(initialCur);
    })();

  });

/* Newsletter (frontend-only): guarda correos en localStorage y muestra feedback */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('newsletter-form');
  const input = document.getElementById('newsletter-email');
  const feedback = document.getElementById('newsletter-feedback');
  if (!form || !input || !feedback) return;

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const email = (input.value || '').trim();
    // validación simple
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      feedback.textContent = 'Por favor ingresa un correo válido.';
      feedback.style.color = 'crimson';
      return;
    }

    try {
      const key = 'jplace_newsletter_subscribers_v1';
      const listRaw = localStorage.getItem(key);
      const list = listRaw ? JSON.parse(listRaw) : [];
      if (!list.includes(email)) {
        list.push(email);
        localStorage.setItem(key, JSON.stringify(list));
      }
      input.value = '';
      feedback.style.color = '';
      feedback.textContent = '¡Gracias! Te hemos enviado un correo de confirmación (simulado).';
    } catch (err) {
      feedback.style.color = 'crimson';
      feedback.textContent = 'Ocurrió un error guardando tu correo. Intenta de nuevo.';
      console.error(err);
    }
  });
});

/* Filtrado client-side y paginación (Load more) para páginas de categoría */
document.addEventListener('DOMContentLoaded', () => {
  const categories = document.querySelectorAll('.products-grid');
  if (!categories) return;

  categories.forEach(grid => {
    const products = Array.from(grid.querySelectorAll('.product-card'));
    const loadMoreBtn = grid.parentElement.querySelector('.load-more');
    const subcatControls = document.querySelectorAll('.subcat-card');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // pagination
    const perPage = 6;
    let currentLimit = perPage;
    let activeFilter = 'all';

    function updateVisibility() {
      const matching = products.filter(p => {
        const sub = (p.dataset.subcategory || '').toLowerCase();
        return activeFilter === 'all' ? true : sub === activeFilter;
      });

      products.forEach(p => p.classList.add('hidden'));

      matching.forEach((p, idx) => {
        if (idx < currentLimit) p.classList.remove('hidden');
      });

      if (loadMoreBtn) {
        loadMoreBtn.style.display = matching.length > currentLimit ? 'inline-block' : 'none';
      }
    }

    // initial render
    updateVisibility();

    // subcategory click (shared across page)
    subcatControls.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!grid.contains(document.querySelector('.products-grid'))) return; // guard
        e.preventDefault();
        const sub = (btn.dataset.subcat || '').toLowerCase() || 'all';
        activeFilter = sub === 'all' ? 'all' : sub;
        currentLimit = perPage;
        // mark active UI
        document.querySelectorAll('.subcat-card').forEach(b => b.classList.toggle('active', b === btn));
        updateVisibility();
        window.scrollTo({ top: grid.offsetTop - 120, behavior: 'smooth' });
      });
    });

    // filter buttons
    filterBtns.forEach(fb => {
      fb.addEventListener('click', () => {
        const text = (fb.textContent || '').toLowerCase();
        // basic mapping: 'nuevos', 'más populares', 'precio' -> for now treat as all
        activeFilter = 'all';
        currentLimit = perPage;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        fb.classList.add('active');
        updateVisibility();
      });
    });

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        currentLimit += perPage;
        updateVisibility();
      });
    }
  });
});

/* Selector de idiomas en el footer: convierte el botón 'Español' en un desplegable
   y aplica traducciones simples en el footer. Persistencia en localStorage. */
document.addEventListener('DOMContentLoaded', () => {
  const LANG_KEY = 'jplace_lang';
  const available = [
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' }
  ];

  const translations = {
    es: {
      nav: { inicio: 'Inicio', productos: 'Productos', beneficios: 'Beneficios', contacto: 'Contacto', register: 'Regístrate' },
      hero: { title: 'Compra y vende con confianza', lead: 'Encuentra productos únicos y recomendaciones personalizadas. Publica tus artículos en minutos y llega a compradores reales.', explore: 'Explorar categorías', register: 'Regístrate' },
      trust: { t1: 'Envíos rápidos', t2: 'Pagos seguros', t3: 'Atención 24/7' },
      testimonials: { title: 'Lo que dicen nuestros usuarios', t1: 'Encontré un teléfono en perfecto estado por un precio increíble. El proceso fue rápido y el vendedor muy amable.', a1: '- María, Bogotá', t2: 'Vender mis muebles aquí fue sencillo. Las herramientas de publicación son claras y recibí ofertas en horas.', a2: '- Andrés, Medellín', t3: 'La atención al cliente me ayudó con una devolución. Excelente soporte y experiencia segura.', a3: '- Camila, Cali' },
      newsletter: { title: 'Recibe ofertas exclusivas', p: 'Suscríbete a nuestro boletín y recibe un 10% de descuento en tu primera compra.', placeholder: 'tu@correo.com', btn: 'Suscribirse', thankyou: '¡Gracias! Te hemos enviado un correo de confirmación (simulado).' },
      auth: { register: { title: 'Crear cuenta', lead: 'Regístrate para comprar y vender en J-PLACE', name: 'Nombre completo', email: 'Correo electrónico', password: 'Contraseña', submit: 'Regístrate' }, login: { title: 'Inicia sesión', lead: 'Usa tu correo y contraseña para iniciar sesión', email: 'Correo electrónico', password: 'Contraseña', submit: 'Iniciar sesión' } },
      productos: { title: 'Explora categorías populares' },
      category: {
        moda: { title: 'Moda', lead: 'Colecciones, prendas y accesorios seleccionados para ti.' },
        tecnologia: { title: 'Tecnología', lead: 'Explora lo último en gadgets, electrónica y accesorios.' },
        deportes: { title: 'Deportes', lead: 'Equipamiento deportivo y accesorios para todos los niveles.' },
        hogar: { title: 'Hogar', lead: 'Encuentra muebles, decoración y soluciones para tu casa.' }
      },
      productos_extra: { deportes: 'Deportes' },
      benefits: { title: '¿Por qué elegirnos?', b1h: 'Recomendaciones inteligentes', b1p: 'Nuestro sistema aprende de tus gustos y te muestra lo que realmente te interesa.', b2h: 'Vende fácil y rápido', b2p: 'Publica tus productos en minutos y llega a miles de compradores potenciales.', b3h: 'Pagos seguros', b3p: 'Compra con tranquilidad gracias a nuestro sistema de protección y soporte 24/7' },
      footer: { ctaTitle: 'Ver recomendaciones personalizadas', ctaButton: 'Identifícate', smallCta: '¿Eres un cliente nuevo? <a href="registro.html">Empieza aquí.</a>', cols: ['Conócenos','Gana Dinero con Nosotros','Productos de Pago','Podemos Ayudarte'], helpLinks: ['Tu Cuenta','Tus Pedidos','Devoluciones','Ayuda'] },
      misc: { loadMore: 'Cargar más' }
    },
    en: {
      nav: { inicio: 'Home', productos: 'Products', beneficios: 'Benefits', contacto: 'Contact', register: 'Sign up' },
      hero: { title: 'Buy and sell with confidence', lead: 'Find unique products and personalized recommendations. List items in minutes and reach real buyers.', explore: 'Explore categories', register: 'Sign up' },
      trust: { t1: 'Fast shipping', t2: 'Secure payments', t3: '24/7 support' },
      testimonials: { title: 'What our users say', t1: 'I found a phone in perfect condition at an amazing price. The process was quick and the seller was very kind.', a1: '- Maria, Bogotá', t2: 'Selling my furniture here was easy. The listing tools are clear and I received offers within hours.', a2: '- Andrés, Medellín', t3: 'Customer service helped with a return. Excellent support and safe experience.', a3: '- Camila, Cali' },
      newsletter: { title: 'Get exclusive offers', p: 'Subscribe to our newsletter and get 10% off your first purchase.', placeholder: 'you@email.com', btn: 'Subscribe', thankyou: 'Thanks! We sent a confirmation email (simulated).' },
      auth: { register: { title: 'Create account', lead: 'Sign up to buy and sell on J-PLACE', name: 'Full name', email: 'Email address', password: 'Password', submit: 'Sign up' }, login: { title: 'Sign in', lead: 'Use your email and password to sign in', email: 'Email address', password: 'Password', submit: 'Sign in' } },
      productos: { title: 'Explore popular categories' },
      category: {
        moda: { title: 'Fashion', lead: 'Collections, garments and accessories selected for you.' },
        tecnologia: { title: 'Technology', lead: 'Explore the latest in gadgets, electronics and accessories.' },
        deportes: { title: 'Sports', lead: 'Sports equipment and accessories for all levels.' },
        hogar: { title: 'Home', lead: 'Find furniture, decor and solutions for your home.' }
      },
      productos_extra: { deportes: 'Sports' },
      benefits: { title: 'Why choose us?', b1h: 'Smart recommendations', b1p: 'Our system learns from your tastes and shows you what really matters.', b2h: 'Sell easily and fast', b2p: 'List your products in minutes and reach thousands of potential buyers.', b3h: 'Secure payments', b3p: 'Shop with peace of mind thanks to our protection system and 24/7 support' },
      footer: { ctaTitle: 'See personalized recommendations', ctaButton: 'Sign in', smallCta: 'New customer? <a href="registro.html">Start here.</a>', cols: ['Get to Know Us','Make Money with Us','Payment Products','Let Us Help You'], helpLinks: ['Your Account','Your Orders','Returns & Replacements','Help'] },
      misc: { loadMore: 'Load more' }
    },
    pt: {
      nav: { inicio: 'Início', productos: 'Produtos', beneficios: 'Benefícios', contacto: 'Contato', register: 'Cadastre-se' },
      hero: { title: 'Compre e venda com confiança', lead: 'Encontre produtos únicos e recomendações personalizadas. Publique seus itens em minutos e alcance compradores reais.', explore: 'Explorar categorias', register: 'Cadastre-se' },
      trust: { t1: 'Envios rápidos', t2: 'Pagamentos seguros', t3: 'Suporte 24/7' },
      testimonials: { title: 'O que nossos usuários dizem', t1: 'Encontrei um celular em perfeito estado por um preço incrível. O processo foi rápido e o vendedor foi muito simpático.', a1: '- Maria, Bogotá', t2: 'Vender meus móveis aqui foi simples. As ferramentas de anúncio são claras e recebi ofertas em horas.', a2: '- Andrés, Medellín', t3: 'O atendimento ao cliente me ajudou com uma devolução. Excelente suporte e experiência segura.', a3: '- Camila, Cali' },
      newsletter: { title: 'Receba ofertas exclusivas', p: 'Assine nosso boletim e receba 10% de desconto na sua primeira compra.', placeholder: 'voce@exemplo.com', btn: 'Inscrever-se', thankyou: 'Obrigado! Enviamos um e-mail de confirmação (simulado).' },
      auth: { register: { title: 'Criar conta', lead: 'Cadastre-se para comprar e vender no J-PLACE', name: 'Nome completo', email: 'E-mail', password: 'Senha', submit: 'Cadastre-se' }, login: { title: 'Entrar', lead: 'Use seu e-mail e senha para entrar', email: 'E-mail', password: 'Senha', submit: 'Entrar' } },
      productos: { title: 'Explore categorias populares' },
      category: {
        moda: { title: 'Moda', lead: 'Coleções, peças e acessórios selecionados para você.' },
        tecnologia: { title: 'Tecnologia', lead: 'Explore o que há de mais recente em gadgets, eletrônicos e acessórios.' },
        deportes: { title: 'Esportes', lead: 'Equipamentos esportivos e acessórios para todos os níveis.' },
        hogar: { title: 'Lar', lead: 'Encontre móveis, decoração e soluções para sua casa.' }
      },
      productos_extra: { deportes: 'Esportes' },
      benefits: { title: 'Por que nos escolher?', b1h: 'Recomendações inteligentes', b1p: 'Nosso sistema aprende com seus gostos e mostra o que realmente importa.', b2h: 'Venda fácil e rápido', b2p: 'Publique seus produtos em minutos e alcance milhares de compradores potenciais.', b3h: 'Pagamentos seguros', b3p: 'Compre com tranquilidade graças ao nosso sistema de proteção e suporte 24/7' },
      footer: { ctaTitle: 'Ver recomendações personalizadas', ctaButton: 'Identifique-se', smallCta: 'Novo cliente? <a href="registro.html">Comece aqui.</a>', cols: ['Conheça-nos','Ganhe dinheiro conosco','Produtos de Pagamento','Podemos Ajudar'], helpLinks: ['Sua Conta','Seus Pedidos','Devoluções','Ajuda'] },
      misc: { loadMore: 'Carregar mais' }
    }
  };

  function findLangButton() {
    // Buscar botones .btn-ghost cuyo texto incluya 'Español' (sensitivo a mayúsculas)
    const all = Array.from(document.querySelectorAll('.btn-ghost'));
    return all.find(b => (b.textContent || '').trim().toLowerCase().includes('español')) || null;
  }

  function createDropdown(button) {
    if (!button) return null;
    // evitar crear dos veces
    if (button.dataset.langAttached) return button;
    button.dataset.langAttached = '1';
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'lang-menu';
    menu.setAttribute('role', 'menu');
    menu.style.display = 'none';

    available.forEach(lang => {
      const it = document.createElement('button');
      it.type = 'button';
      it.className = 'lang-item';
      it.setAttribute('role', 'menuitemradio');
      it.dataset.langCode = lang.code;

      const flag = document.createElement('span'); flag.className = 'lang-flag'; flag.textContent = lang.flag || '';
      const name = document.createElement('span'); name.className = 'lang-name'; name.textContent = lang.name;
      const chk = document.createElement('span'); chk.className = 'lang-check'; chk.style.marginLeft = '8px';

      it.appendChild(flag);
      it.appendChild(name);
      it.appendChild(chk);

      it.addEventListener('click', () => { setLanguage(lang.code); hideMenu(); });
      it.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); it.click(); }
      });

      menu.appendChild(it);
    });

    document.body.appendChild(menu);

    function placeMenu() {
      const rect = button.getBoundingClientRect();
      menu.style.top = (rect.bottom + window.scrollY + 6) + 'px';
      menu.style.left = (rect.left + window.scrollX) + 'px';
      menu.style.minWidth = Math.max(140, rect.width) + 'px';
    }

    function showMenu() { placeMenu(); menu.style.display = 'block'; button.setAttribute('aria-expanded', 'true'); }
    function hideMenu() { menu.style.display = 'none'; button.setAttribute('aria-expanded', 'false'); }

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.style.display === 'block') hideMenu(); else showMenu();
    });

    // cerrar al hacer click fuera
    document.addEventListener('click', (ev) => {
      if (!menu.contains(ev.target) && ev.target !== button) hideMenu();
    });

    // keyboard navigation inside menu
    menu.addEventListener('keydown', (ev) => {
      const items = Array.from(menu.querySelectorAll('.lang-item'));
      const idx = items.indexOf(document.activeElement);
      if (ev.key === 'ArrowDown') { ev.preventDefault(); const next = items[(idx+1+items.length)%items.length]; next.focus(); }
      if (ev.key === 'ArrowUp') { ev.preventDefault(); const prev = items[(idx-1+items.length)%items.length]; prev.focus(); }
      if (ev.key === 'Escape') { hideMenu(); button.focus(); }
    });

    // open menu with keyboard from button
    button.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown' || ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault(); showMenu(); const first = menu.querySelector('.lang-item'); if (first) first.focus();
      }
    });

    // volver a colocar al hacer resize/scroll
    window.addEventListener('resize', () => { if (menu.style.display === 'block') placeMenu(); });
    window.addEventListener('scroll', () => { if (menu.style.display === 'block') placeMenu(); });

    return button;
  }

  async function applyTranslations(code) {
    const tRoot = await loadTranslations(code);
    // actualizar atributo lang en html
    try { document.documentElement.lang = code; } catch (e) {}

    // traducir elementos marcados con data-i18n
    const nodes = Array.from(document.querySelectorAll('[data-i18n]'));
    nodes.forEach(el => {
      const key = el.dataset.i18n;
      if (!key) return;
      const parts = key.split('.');
      let val = tRoot;
      for (const p of parts) {
        if (val && Object.prototype.hasOwnProperty.call(val, p)) val = val[p]; else { val = null; break; }
      }
      if (typeof val === 'string') el.innerHTML = val;
    });

    // traducir placeholders si hay data-i18n-placeholder
    const placeholderNodes = Array.from(document.querySelectorAll('[data-i18n-placeholder]'));
    placeholderNodes.forEach(el => {
      const key = el.dataset.i18nPlaceholder;
      if (!key) return;
      const parts = key.split('.');
      let val = tRoot;
      for (const p of parts) {
        if (val && Object.prototype.hasOwnProperty.call(val, p)) val = val[p]; else { val = null; break; }
      }
      if (typeof val === 'string') el.placeholder = val;
    });

    // fallback: traducir footer columns and help links if not marked
    const cols = Array.from(document.querySelectorAll('.site-footer .footer-col h3'));
    if (tRoot.footer && tRoot.footer.cols) cols.forEach((el, idx) => { if (tRoot.footer.cols[idx]) el.textContent = tRoot.footer.cols[idx]; });
    const helpItems = Array.from(document.querySelectorAll('.site-footer .footer-col:last-child ul li'));
    if (tRoot.footer && tRoot.footer.helpLinks) helpItems.forEach((li, idx) => { if (tRoot.footer.helpLinks[idx]) li.innerHTML = `<a href="#">${tRoot.footer.helpLinks[idx]}</a>`; });

    // actualizar texto del botón de idioma visible
    const langBtn = findLangButton();
    if (langBtn) {
      const found = available.find(l => l.code === code) || available[0];
      // mostrar bandera + nombre
      langBtn.innerHTML = '';
      const f = document.createElement('span'); f.textContent = found.flag || ''; f.style.marginRight = '8px';
      const n = document.createElement('span'); n.textContent = found.name;
      langBtn.appendChild(f); langBtn.appendChild(n);
    }

    // marcar radio en el menú si ya existe
    const menuItems = document.querySelectorAll('.lang-item');
    menuItems.forEach(mi => {
      const codeAttr = mi.dataset.langCode;
      if (codeAttr === code) mi.classList.add('lang-selected'); else mi.classList.remove('lang-selected');
      mi.setAttribute('aria-checked', codeAttr === code ? 'true' : 'false');
    });

    // persistir
    try { localStorage.setItem(LANG_KEY, code); } catch (e) {}
  }

  function setLanguage(code) { applyTranslations(code); }
  // Cargar partial del footer (si existe) y luego inicializar selector/traducciones
  async function loadFooter() {
    const containers = Array.from(document.querySelectorAll('#footer-include'));
    if (!containers.length) return;
    try {
      const resp = await fetch('partials/footer.html', { cache: 'no-cache' });
      if (!resp.ok) {
        console.warn('No se pudo cargar partial footer:', resp.status);
        return;
      }
      const html = await resp.text();
      containers.forEach(c => { c.innerHTML = html; });
    } catch (err) {
      console.error('Error cargando footer partial:', err);
    }
  }

  (async () => {
    const initial = (localStorage.getItem(LANG_KEY) || 'es');
    await loadFooter();
    // ahora que el footer está en el DOM, buscar el botón y crear el dropdown
    const btn = findLangButton();
    if (btn) createDropdown(btn);
    // aplicar guardado al cargar (y al contenido inyectado)
    await applyTranslations(initial);
  })();
});

// --- UI utilities: stagger, ripple, toast, uploadWithProgress ---
(function(){
  function applyStaggerToCards(root=document, selector='.product-card', delay=60){
    try{
      const cards = Array.from(root.querySelectorAll(selector));
      cards.forEach((c, i)=>{
        c.style.opacity = '0';
        c.style.transform = 'translateY(8px)';
        c.style.transition = `opacity 360ms ease ${i*delay}ms, transform 360ms cubic-bezier(.2,.9,.2,1) ${i*delay}ms`;
        requestAnimationFrame(()=>{ c.style.opacity='1'; c.style.transform='translateY(0)'; });
      });
    }catch(e){/* noop */}
  }

  function attachRipple(root=document){
    function rippleHandler(ev){
      const btn = ev.currentTarget;
      const rect = btn.getBoundingClientRect();
      const r = document.createElement('span');
      r.className = 'ripple';
      const size = Math.max(rect.width, rect.height) * 1.4;
      r.style.width = r.style.height = size + 'px';
      r.style.left = (ev.clientX - rect.left - size/2) + 'px';
      r.style.top = (ev.clientY - rect.top - size/2) + 'px';
      btn.appendChild(r);
      setTimeout(()=>{ r.remove(); }, 650);
    }
    const buttons = Array.from(root.querySelectorAll('button, .btn-primary, .btn-ghost, .edit-product-btn'));
    buttons.forEach(b=>{
      if (!b.dataset.rippleAttached) {
        b.addEventListener('click', rippleHandler);
        b.dataset.rippleAttached = '1';
        b.style.position = b.style.position || 'relative';
        b.style.overflow = 'hidden';
      }
    });
  }

  function showToast(message, opts={duration:3000, type:'info'}){
    try{
      let container = document.getElementById('jplace-toast-container');
      if(!container){ container = document.createElement('div'); container.id='jplace-toast-container'; container.className='toast-container'; document.body.appendChild(container); }
      const t = document.createElement('div'); t.className = 'jplace-toast jplace-toast-'+(opts.type||'info'); t.textContent = message;
      container.appendChild(t);
      requestAnimationFrame(()=> t.classList.add('visible'));
      setTimeout(()=>{ t.classList.remove('visible'); setTimeout(()=> t.remove(), 300); }, opts.duration||3000);
    }catch(e){ console.warn('toast error', e); }
  }

  // Upload helper that reports progress via onProgress callback
  async function uploadWithProgress(url, formData, options={method:'POST', headers:{}, onProgress:null}){
    // If fetch with upload progress is needed, use XHR
    return new Promise((resolve, reject)=>{
      try{
        const xhr = new XMLHttpRequest();
        xhr.open(options.method||'POST', url, true);
        if (options.headers){ Object.keys(options.headers).forEach(k=> xhr.setRequestHeader(k, options.headers[k])); }
        xhr.upload.onprogress = function(ev){ if(ev.lengthComputable && typeof options.onProgress === 'function'){ options.onProgress({loaded:ev.loaded, total:ev.total, percent: Math.round((ev.loaded/ev.total)*100)}); } };
        xhr.onload = function(){ try{ const status=this.status; const text=this.responseText; const json = text ? JSON.parse(text) : null; if(status>=200 && status<300) resolve({status, body:json}); else reject({status, body:json}); }catch(err){ reject(err); } };
        xhr.onerror = function(e){ reject(e); };
        xhr.send(formData);
      }catch(err){ reject(err); }
    });
  }

  // Expose helpers globally
  window.__jplace_applyStagger = applyStaggerToCards;
  window.__jplace_attachRipple = attachRipple;
  window.__jplace_showToast = showToast;
  window.__jplace_uploadWithProgress = uploadWithProgress;

  // Hook to be called after product lists are rendered dynamically
  window.__jplace_afterRenderProducts = function(root){
    try{
      const container = root || document;
      window.__jplace_applyStagger(container, '.product-card', 50);
      window.__jplace_attachRipple(container);
    }catch(e){ console.warn('afterRenderProducts hook error', e); }
  };

})();

// ============================================
// MEJORAS INTERACTIVAS INDEX.HTML
// ============================================

// Counter animation for stats
function animateCounter(element) {
  const target = parseInt(element.getAttribute('data-count'));
  const duration = 2000;
  const increment = target / (duration / 16);
  let current = 0;
  
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) {
      element.textContent = target.toLocaleString();
      clearInterval(timer);
    } else {
      element.textContent = Math.floor(current).toLocaleString();
    }
  }, 16);
}

// Initialize counters when they come into view
const statsObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
      animateCounter(entry.target);
      entry.target.classList.add('counted');
    }
  });
}, { threshold: 0.5 });

document.addEventListener('DOMContentLoaded', () => {
  // Animate stat numbers
  const statNumbers = document.querySelectorAll('.stat-number');
  statNumbers.forEach(stat => statsObserver.observe(stat));

  // Carousel controls for hero
  const carousel = document.getElementById('heroCarousel');
  if (carousel) {
    const track = carousel.querySelector('.carousel-track');
    const slides = carousel.querySelectorAll('.carousel-slide');
    const prevBtn = carousel.querySelector('.carousel-control.prev');
    const nextBtn = carousel.querySelector('.carousel-control.next');
    const indicators = carousel.querySelector('.carousel-indicators');
    let currentIndex = 0;
    let autoplayInterval;

    // Create indicators
    if (indicators) {
      slides.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.className = 'carousel-indicator' + (index === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `Ir a slide ${index + 1}`);
        dot.addEventListener('click', () => goToSlide(index));
        indicators.appendChild(dot);
      });
    }

    function updateCarousel() {
      slides.forEach((slide, index) => {
        slide.classList.toggle('active', index === currentIndex);
      });
      
      const dots = indicators?.querySelectorAll('.carousel-indicator');
      dots?.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentIndex);
      });
    }

    function goToSlide(index) {
      currentIndex = index;
      updateCarousel();
      resetAutoplay();
    }

    function nextSlide() {
      currentIndex = (currentIndex + 1) % slides.length;
      updateCarousel();
    }

    function prevSlide() {
      currentIndex = (currentIndex - 1 + slides.length) % slides.length;
      updateCarousel();
    }

    function startAutoplay() {
      autoplayInterval = setInterval(nextSlide, 5000);
    }

    function resetAutoplay() {
      clearInterval(autoplayInterval);
      startAutoplay();
    }

    prevBtn?.addEventListener('click', () => {
      prevSlide();
      resetAutoplay();
    });

    nextBtn?.addEventListener('click', () => {
      nextSlide();
      resetAutoplay();
    });

    startAutoplay();

    // Pause autoplay on hover
    carousel.addEventListener('mouseenter', () => clearInterval(autoplayInterval));
    carousel.addEventListener('mouseleave', startAutoplay);
  }

  // Testimonials slider
  const testimonialSlider = document.querySelector('.testimonials-slider');
  if (testimonialSlider) {
    const track = testimonialSlider.querySelector('.testimonials-track');
    const cards = testimonialSlider.querySelectorAll('.testimonial-card-enhanced');
    const prevBtn = testimonialSlider.querySelector('.slider-btn.prev');
    const nextBtn = testimonialSlider.querySelector('.slider-btn.next');
    const dotsContainer = testimonialSlider.querySelector('.slider-dots');
    let currentSlide = 0;
    const cardsPerView = window.innerWidth >= 768 ? 3 : 1;

    // Create dots
    const totalSlides = Math.ceil(cards.length / cardsPerView);
    for (let i = 0; i < totalSlides; i++) {
      const dot = document.createElement('span');
      dot.className = i === 0 ? 'active' : '';
      dot.addEventListener('click', () => goToTestimonial(i));
      dotsContainer?.appendChild(dot);
    }

    function updateSlider() {
      const offset = currentSlide * -100;
      if (track) track.style.transform = `translateX(${offset}%)`;
      
      const dots = dotsContainer?.querySelectorAll('span');
      dots?.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentSlide);
      });
    }

    function goToTestimonial(index) {
      currentSlide = Math.max(0, Math.min(index, totalSlides - 1));
      updateSlider();
    }

    prevBtn?.addEventListener('click', () => {
      goToTestimonial(currentSlide - 1);
    });

    nextBtn?.addEventListener('click', () => {
      goToTestimonial(currentSlide + 1);
    });
  }

  // View switcher for categories
  const viewBtns = document.querySelectorAll('.view-btn');
  const productGrid = document.querySelector('.productos-grid-showcase');
  
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      viewBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const view = btn.getAttribute('data-view');
      if (productGrid) {
        if (view === 'list') {
          productGrid.style.gridTemplateColumns = '1fr';
        } else {
          productGrid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
        }
      }
    });
  });

  // Enhanced newsletter form
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('newsletter-email');
      const feedback = document.getElementById('newsletter-feedback');
      const email = emailInput.value.trim();

      if (!email) return;

      feedback.textContent = '⏳ Procesando...';
      feedback.className = 'newsletter-feedback';

      // Simulate API call
      setTimeout(() => {
        feedback.textContent = '✅ ¡Gracias por suscribirte! Revisa tu email.';
        feedback.className = 'newsletter-feedback success';
        emailInput.value = '';
        
        setTimeout(() => {
          feedback.textContent = '';
        }, 5000);
      }, 1500);
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '#!') return;
      
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Add parallax effect to hero
  const hero = document.querySelector('.hero-enhanced');
  if (hero) {
    window.addEventListener('scroll', () => {
      const scrolled = window.pageYOffset;
      const particles = hero.querySelector('.hero-particles');
      if (particles) {
        particles.style.transform = `translateY(${scrolled * 0.5}px)`;
      }
    });
  }

  // Intersection observer for fade-in animations
  const animatedElements = document.querySelectorAll('.animate-fade-in-up, .animate-bounce-in');
  const animationObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.1 });

  animatedElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    animationObserver.observe(el);
  });

  // Add ripple effect to buttons
  document.querySelectorAll('.btn-hero-primary, .btn-hero-secondary, .btn-newsletter-premium').forEach(button => {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.6);
        width: 100px;
        height: 100px;
        margin-top: -50px;
        margin-left: -50px;
        animation: ripple-effect 0.6s;
        pointer-events: none;
      `;
      
      const rect = this.getBoundingClientRect();
      ripple.style.left = (e.clientX - rect.left) + 'px';
      ripple.style.top = (e.clientY - rect.top) + 'px';
      
      this.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    });
  });
});
