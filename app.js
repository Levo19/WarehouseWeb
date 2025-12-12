/**
 * LEVO ERP - Main Application Script
 * Handles Navigation, State, and API communication.
 */

const API_URL = 'https://script.google.com/macros/s/AKfycbyYJvrOdT1zKukBfBPzl9K9C0R2UEQa-VXlzzrR7KwlxQAqFuo-WtSekJH7rhg2nMMg/exec';

class App {
    constructor() {
        this.currentUser = null;
        this.state = {
            currentView: 'login',
            currentModule: null
        };
        this.products = {};

        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.checkSession();
        this.loadProducts(); // Background fetch
    }

    cacheDOM() {
        // Views
        this.loginView = document.getElementById('login-view');
        this.mainApp = document.getElementById('main-app');
        this.subViews = document.querySelectorAll('.sub-view');

        // Forms
        this.loginForm = document.getElementById('login-form');

        // Navigation
        this.navLinks = document.querySelectorAll('.nav-link');
        this.logoutBtn = document.getElementById('logout-btn');

        // Content
        this.pageTitle = document.getElementById('page-title');
        this.userInitials = document.getElementById('user-initials');
        this.userName = document.getElementById('user-name');
        this.userRole = document.getElementById('user-role');
        this.navUsers = document.getElementById('nav-users'); // Admin only

        // Modules
        this.dispatchContent = document.getElementById('dispatch-content');

        // Modal
        this.modalContainer = document.getElementById('modal-container');
    }

    bindEvents() {
        // Login Submit
        this.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout
        this.logoutBtn.addEventListener('click', () => {
            this.handleLogout();
        });

        // Navigation
        this.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('data-target');
                this.navigateTo(target);
            });
        });
    }

    /**
     * Session Management
     */
    checkSession() {
        const storedUser = localStorage.getItem('levo_user');
        if (storedUser) {
            this.setUser(JSON.parse(storedUser));
        } else {
            this.showLogin();
        }
    }

    /**
     * LOGIN - Call Backend
     */
    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const submitBtn = this.loginForm.querySelector('button[type="submit"]');

        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Conectando...';
        submitBtn.disabled = true;

        try {
            // IMPORTANT: Request as text/plain to avoid CORS Preflight (OPTIONS) which GAS doesn't handle.
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow', // GAS redirects 302
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify({
                    action: 'login',
                    username: username,
                    password: password
                })
            });

            if (!response.ok) throw new Error('Error de red al conectar con el servidor');

            const result = await response.json();

            if (result.status === 'success') {
                this.setUser(result.user);
            } else {
                alert(result.message || 'Error al iniciar sesión');
            }

        } catch (error) {
            console.error(error);
            alert('Error : ' + error.message);
        } finally {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
        }
    }

    setUser(user) {
        this.currentUser = user;
        localStorage.setItem('levo_user', JSON.stringify(user));

        // Update UI
        this.userName.textContent = user.name;
        this.userRole.textContent = user.role;
        this.userInitials.textContent = user.name.substring(0, 2).toUpperCase();

        // Setup Permissions
        this.setupPermissions();

        // Show App
        this.showApp();
        this.navigateTo('dashboard');
    }

    setupPermissions() {
        // Check permissions based on the 'modulos' list from Sheet
        const perms = this.currentUser.permissions || [];

        // Show/Hide Users Link
        if (perms.includes('users') || this.currentUser.username === 'levo' || this.currentUser.role === 'Master') {
            this.navUsers.style.display = 'flex';
        } else {
            this.navUsers.style.display = 'none';
        }
    }

    handleLogout() {
        this.currentUser = null;
        localStorage.removeItem('levo_user');
        this.showLogin();
    }

    /**
     * View Management
     */
    showLogin() {
        this.loginView.classList.add('active');
        this.mainApp.classList.remove('active');
    }

    showApp() {
        this.loginView.classList.remove('active');
        this.mainApp.classList.add('active');
    }

    navigateTo(viewName) {
        // Update Sidebar UI
        this.navLinks.forEach(link => {
            if (link.getAttribute('data-target') === viewName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Update Title
        const titles = {
            'dashboard': 'Dashboard',
            'movements': 'Movimientos',
            'dispatch': 'Despachos',
            'users': 'Gestión de Usuarios'
        };
        this.pageTitle.textContent = titles[viewName] || 'LEVO ERP';

        // Switch View
        this.subViews.forEach(view => view.classList.remove('active'));
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) targetView.classList.add('active');
    }

    /**
     * Dispatch Module Functions
     */
    switchDispatchTab(tabName) {
        const container = document.getElementById('dispatch-content');

        // Update Buttons state
        const buttons = document.querySelectorAll('#view-dispatch .btn-secondary');
        buttons.forEach(btn => btn.classList.remove('active'));
        // In a real implementation we would identify the clicked button specifically

        if (tabName === 'requests') {
            this.renderDispatchRequests(container);
        } else if (tabName === 'pickup') {
            this.renderDispatchPickup(container);
        }
    }

    async renderDispatchRequests(container) {
        container.innerHTML = '<div style="text-align:center; padding: 2rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando solicitudes...</div>';

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    "Content-Type": "text/plain;charset=utf-8"
                },
                body: JSON.stringify({ action: 'getDispatchRequests' })
            });
            const result = await response.json();

            if (result.status === 'success') {
                const rows = result.data.map(req => `
                    <tr>
                        <td style="padding: 1rem;">${req.codigo}</td>
                        <td style="padding: 1rem;">${req.cantidad}</td>
                        <td style="padding: 1rem;">${req.fecha}</td>
                        <td style="padding: 1rem;">${req.usuario}</td>
                        <td style="padding: 1rem;"><span style="color: orange; font-weight:bold;">${req.categoria.toUpperCase()}</span></td>
                    </tr>
                `).join('');

                container.innerHTML = `
                    <h4>Solicitudes de Despacho</h4>
                    <div style="margin-top: 1rem; padding: 2rem; background: #f9fafb; border-radius: 8px; text-align: center;">
                        <button class="btn-primary" onclick="app.openNewRequestModal()">
                            <i class="fa-solid fa-plus"></i> Nueva Solicitud
                        </button>
                    </div>
                    <div style="margin-top: 2rem; overflow-x: auto;">
                        <table style="width: 100%; text-align: left; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid #eee; color: #666;">
                                    <th style="padding: 1rem;">CÓDIGO</th>
                                    <th style="padding: 1rem;">CANTIDAD</th>
                                    <th style="padding: 1rem;">FECHA</th>
                                    <th style="padding: 1rem;">USUARIO</th>
                                    <th style="padding: 1rem;">ESTADO</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${rows.length > 0 ? rows : '<tr><td colspan="5" style="padding:1rem; text-align:center;">No hay solicitudes pendientes</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                `;
            } else {
                container.innerHTML = `< p style = "color:red;" > Error al cargar: ${result.message}</p > `;
            }
        } catch (error) {
            container.innerHTML = `< p style = "color:red;" > Error de conexión: ${error.message}</p > `;
        }
    }

    async loadProducts() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getProducts' })
            });
            const result = await response.json();
            if (result.status === 'success') {
                result.data.forEach(p => {
                    this.products[p.codigo] = p.descripcion;
                });
                console.log('Productos cargados:', Object.keys(this.products).length);
            }
        } catch (e) {
            console.error('Error cargando productos', e);
        }
    }

    getProductDescription(code) {
        return this.products[code] || 'Producto Desconocido';
    }

    renderDispatchPickup(container) {
        // Initial Layout
        container.innerHTML = `
            <h4>Pickup / Recolección</h4>
            <div class="pickup-header" style="display:flex; justify-content:space-between; align-items:center; margin-top:1rem; margin-bottom:1rem;">
                <div class="zone-selector" style="display:flex; gap:1rem;">
                    <button class="btn-secondary active" onclick="app.loadPickupForZone('zona1', this)">Zona 1</button>
                    <button class="btn-secondary" onclick="app.loadPickupForZone('zona2', this)">Zona 2</button>
                </div>
                <div style="font-size:0.9rem; color:#666;">
                    <i class="fa-solid fa-circle-info"></i> Separa los pedidos para habilitar el despacho
                </div>
            </div>
            
            <div id="pickup-kanban" class="pickup-layout">
                <!-- Columns injected here -->
                <div style="grid-column: 1 / 3; text-align:center; padding:2rem;">Cargando...</div>
            </div>

            <button id="fab-dispatch" class="fab-btn hidden" onclick="app.dispatchAll()">
                <i class="fa-solid fa-paper-plane"></i> Despachar Todo
            </button>
        `;

        this.loadPickupForZone('zona1', container.querySelector('.zone-selector button'));
    }

    async loadPickupForZone(zone, btnElement) {
        if (btnElement) {
            const btns = document.querySelectorAll('.zone-selector .btn-secondary');
            btns.forEach(b => b.classList.remove('active'));
            btnElement.classList.add('active');
        }

        const kanbanContainer = document.getElementById('pickup-kanban');
        kanbanContainer.innerHTML = '<div style="grid-column: 1 / 3; text-align:center; padding:2rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Cargando...</div>';

        // Hide FAB initially
        document.getElementById('fab-dispatch').classList.add('hidden');

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getDispatchRequests' })
            });
            const result = await response.json();

            if (result.status === 'success') {
                // Filter by Zone
                const zoneRequests = result.data.filter(r => r.usuario === zone);

                // Split by Status
                const pending = zoneRequests.filter(r => r.categoria === 'solicitado');
                const separated = zoneRequests.filter(r => r.categoria === 'separado');

                this.renderPickupColumns(kanbanContainer, pending, separated);

                // Show FAB if items are separated
                if (separated.length > 0) {
                    document.getElementById('fab-dispatch').classList.remove('hidden');
                }
            }
        } catch (e) {
            kanbanContainer.innerHTML = `<p style="color:red">Error: ${e.message}</p>`;
        }
    }

    renderPickupColumns(container, pending, separated) {
        // Left Column: Pending
        const pendingHtml = pending.map(req => `
            <div class="product-card">
                <div class="card-header">
                    <div>
                        <div class="card-code">${req.codigo}</div>
                        <div class="card-desc">${this.getProductDescription(req.codigo)}</div>
                    </div>
                    <div style="font-size:0.8rem; color:#999;">${req.fecha.split(' ')[1] || ''}</div>
                </div>
                <div class="card-actions" style="justify-content: space-between; margin-top:0.5rem;">
                    <input type="number" id="qty-${req.idSolicitud}" class="qty-input" value="${req.cantidad}" min="0.5" step="0.5">
                    <button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size:0.85rem;" onclick="app.moveToSeparated('${req.idSolicitud}')">
                        Separar <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Right Column: Separated
        const separatedHtml = separated.map(req => `
             <div class="product-card" style="border-left: 4px solid #10B981;">
                <div class="card-header">
                    <div>
                        <div class="card-code">${req.codigo}</div>
                        <div class="card-desc">${this.getProductDescription(req.codigo)}</div>
                    </div>
                    <div style="font-weight:bold; color:#10B981; font-size:1.1rem;">
                        ${req.cantidad} <span style="font-size:0.8rem; font-weight:normal;">un</span>
                    </div>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="pickup-column">
                <h4 style="color: var(--primary-color);">
                    <i class="fa-solid fa-list-check"></i> Pedidos Pendientes (${pending.length})
                </h4>
                ${pending.length > 0 ? pendingHtml : '<div class="empty-state-small"><p>No hay pedidos pendientes</p></div>'}
            </div>
            
            <div class="pickup-column" style="${separated.length === 0 ? 'opacity:0.5;' : ''}">
                <h4 style="color: #10B981;">
                    <i class="fa-solid fa-box-open"></i> Listos para Despacho (${separated.length})
                </h4>
                ${separated.length > 0 ? separatedHtml : '<div class="empty-state-small"><p>Nada separado aún</p></div>'}
            </div>
        `;
    }

    async moveToSeparated(id) {
        const qtyInput = document.getElementById(`qty-${id}`);
        const newQty = qtyInput.value;
        const btn = qtyInput.nextElementSibling;

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: 'updateRequests',
                    payload: [{ idSolicitud: id, cantidad: newQty, categoria: 'separado' }]
                })
            });
            // Refresh
            const activeZone = document.querySelector('.zone-selector .btn-secondary.active').innerText.toLowerCase().replace(' ', '');
            this.loadPickupForZone(activeZone, null);

        } catch (e) {
            alert('Error al separar');
        }
    }

    async dispatchAll() {
        if (!confirm('¿Estás seguro de despachar todos los ítems separados?')) return;

        const fab = document.getElementById('fab-dispatch');
        fab.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';

        // Find all separated items currently visible
        // Actually, safer to fetch fresh list or trust UI? Trust UI for now to get IDs is hard without storing them.
        // Better: Fetch again and filter 'separado'. 
        // Or simplified: We can just use 'updateRequests' if we knew the IDs.
        // Let's use getDispatchRequests to find what to update.

        try {
            // 1. Get current separated items for this zone
            const activeZone = document.querySelector('.zone-selector .btn-secondary.active').innerText.toLowerCase().replace(' ', '');

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getDispatchRequests' })
            });
            const result = await response.json();
            const separated = result.data.filter(r => r.usuario === activeZone && r.categoria === 'separado');

            if (separated.length === 0) {
                alert('No hay ítems para despachar');
                return;
            }

            // 2. Update them to 'despachado'
            const updates = separated.map(r => ({
                idSolicitud: r.idSolicitud,
                categoria: 'despachado'
            }));

            await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'updateRequests', payload: updates })
            });

            alert('¡Despacho Exitoso!');
            this.loadPickupForZone(activeZone, null);

        } catch (e) {
            console.error(e);
            alert('Error despachando');
        }
    }

    /**
     * MODAL & FORMS
     */
    openNewRequestModal() {
        const modalHtml = `
                    < div class="modal-card" >
                <div class="modal-header">
                    <h3>Nueva Solicitud</h3>
                    <button class="modal-close" onclick="app.closeModal()">&times;</button>
                </div>
                <form id="new-request-form">
                    <div class="modal-body">
                        <div class="input-group">
                            <p style="margin-bottom:0.5rem; font-size:0.9rem; color:#666;">Código de Producto</p>
                            <input type="text" id="req-code" placeholder="Ej: WHD-001" required>
                        </div>
                        <div class="input-group">
                            <p style="margin-bottom:0.5rem; font-size:0.9rem; color:#666;">Cantidad</p>
                            <input type="number" id="req-qty" placeholder="0" min="1" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-secondary" onclick="app.closeModal()">Cancelar</button>
                        <button type="submit" class="btn-primary">Guardar Solicitud</button>
                    </div>
                </form>
            </div >
                    `;

        this.openModal(modalHtml);

        // Bind Form Submit
        document.getElementById('new-request-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSaveRequest();
        });
    }

    async handleSaveRequest() {
        const code = document.getElementById('req-code').value;
        const qty = document.getElementById('req-qty').value;
        const btn = document.querySelector('#new-request-form button[type="submit"]');

        btn.innerHTML = 'Guardando...';
        btn.disabled = true;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: 'saveRequest',
                    payload: {
                        codigo: code,
                        cantidad: qty,
                        usuario: this.currentUser.username
                    }
                })
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.closeModal();
                alert('Solicitud guardada con éxito');
                this.renderDispatchRequests(document.getElementById('dispatch-content')); // Refresh
            } else {
                alert('Error: ' + result.message);
                btn.disabled = false;
                btn.innerHTML = 'Guardar Solicitud';
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
            btn.disabled = false;
            btn.innerHTML = 'Guardar Solicitud';
        }
    }

    openModal(htmlContent) {
        this.modalContainer.innerHTML = htmlContent;
        this.modalContainer.classList.add('active');
    }

    closeModal() {
        this.modalContainer.classList.remove('active');
        this.modalContainer.innerHTML = '';
    }
}

// Initialize App
const app = new App();
