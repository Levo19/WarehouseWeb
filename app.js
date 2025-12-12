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
        this.data = {
            products: {}, // Map: Code -> Desc
            requests: [], // Array if all requests
            lastFetch: 0
        };

        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.checkSession();
        // Load data if logged in
        if (this.currentUser) {
            this.loadInitialData();
        }
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

    /**
     * Dispatch Module Functions
     */
    switchDispatchTab(tabName) {
        // Legacy Support or Redirection
        // Now we render the Module Entry point (Zone Selection)
    }

    // New Entry point for navigation
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

        // Specific Module Init
        if (viewName === 'dispatch') {
            this.renderDispatchModule();
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

    /**
     * DATA LOADING
     */
    async loadInitialData() {
        console.log('Loading Initial Data...');
        // Load Products
        this.fetchProducts();
        // Load Requests
        this.fetchRequests();
    }

    async fetchProducts() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getProducts' })
            });
            const result = await response.json();
            if (result.status === 'success') {
                result.data.forEach(p => {
                    this.data.products[p.codigo] = p.descripcion;
                });
            }
        } catch (e) {
            console.error('Error fetching products', e);
        }
    }

    async fetchRequests() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getDispatchRequests' })
            });
            const result = await response.json();
            if (result.status === 'success') {
                this.data.requests = result.data;
                this.data.lastFetch = Date.now();
                console.log('Requests loaded:', this.data.requests.length);

                // If currently in a view that needs update, re-render? 
                // For now user interactions triggers render
            }
        } catch (e) {
            console.error('Error fetching requests', e);
        }
    }

    getProductDescription(code) {
        return this.data.products[code] || 'Producto Desconocido';
    }

    /**
     * DISPATCH MODULE - NEW HIERARCHY
     * Zone Selection -> Tabs (Requests | Pickup)
     */
    renderDispatchModule() {
        // Entry point for "Despachos" link
        const container = document.getElementById('dispatch-content');
        container.innerHTML = `
            <div class="zone-selection-header" style="text-align: center; margin-bottom: 2rem;">
                <h3 style="margin-bottom:1rem; color: var(--primary-color);">Selecciona Cliente / Zona</h3>
                <div style="display:flex; justify-content:center; gap:1rem;">
                    <button class="btn-secondary" onclick="app.selectZone('zona1')">ZONA 1</button>
                    <button class="btn-secondary" onclick="app.selectZone('zona2')">ZONA 2</button>
                </div>
            </div>
            <div id="zone-workspace">
                <p style="text-align:center; color:#666;">Selecciona una zona arriba para comenzar a trabajar.</p>
            </div>
        `;
    }

    selectZone(zone) {
        // Highlight active zone logic could go here
        const container = document.getElementById('zone-workspace');
        container.innerHTML = `
            <div style="border-top:1px solid #eee; margin-top:1rem; padding-top:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h4 style="margin:0;">Gestionando: <span style="color:var(--primary-color); text-transform:uppercase;">${zone}</span></h4>
                    <button class="btn-sm" onclick="app.fetchRequests()"><i class="fa-solid fa-rotate"></i> Actualizar</button>
                </div>
                
                <!-- TABS -->
                <div class="tabs" style="display:flex; gap:1rem; border-bottom:2px solid #eee; margin-bottom:1.5rem;">
                    <button class="tab-link active" onclick="app.switchZoneTab('${zone}', 'requests', this)">Solicitudes</button>
                    <button class="tab-link" onclick="app.switchZoneTab('${zone}', 'pickup', this)">Pickup / Separación</button>
                </div>

                <div id="zone-tab-content">
                    <!-- Content injected here -->
                </div>
            </div>
        `;
        // Load default tab
        this.switchZoneTab(zone, 'requests', container.querySelector('.tab-link'));
    }

    switchZoneTab(zone, tab, btn) {
        // Update tab UI
        if (btn) {
            const allTabs = btn.parentElement.querySelectorAll('.tab-link');
            allTabs.forEach(t => {
                t.style.borderBottom = 'none';
                t.style.color = '#666';
                t.style.fontWeight = 'normal';
            });
            btn.style.borderBottom = '2px solid var(--primary-color)';
            btn.style.color = 'var(--primary-color)';
            btn.style.fontWeight = 'bold';
        }

        const content = document.getElementById('zone-tab-content');
        if (tab === 'requests') {
            this.renderZoneRequests(zone, content);
        } else {
            this.renderZonePickup(zone, content);
        }
    }

    renderZoneRequests(zone, container) {
        // Filter from LOCAL Cache
        const requests = this.data.requests.filter(r => r.usuario === zone);

        const rows = requests.map(req => `
            <tr>
                <td style="padding: 1rem;"><strong>${req.codigo}</strong><br><span style="font-size:0.8rem; color:#666;">${this.getProductDescription(req.codigo)}</span></td>
                <td style="padding: 1rem;">${req.cantidad}</td>
                <td style="padding: 1rem;">${req.fecha}</td>
                <td style="padding: 1rem;">
                    <span style="
                        padding:0.25rem 0.5rem; border-radius:4px; font-size:0.8rem; font-weight:bold;
                        background:${req.categoria === 'solicitado' ? '#FEF3C7' : (req.categoria === 'separado' ? '#D1FAE5' : '#E5E7EB')};
                        color:${req.categoria === 'solicitado' ? '#D97706' : (req.categoria === 'separado' ? '#059669' : '#374151')};
                    ">
                        ${req.categoria.toUpperCase()}
                    </span>
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <div style="margin-bottom:1rem; text-align:right;">
                 <button class="btn-primary" onclick="app.openNewRequestModal()">+ Nueva Solicitud</button>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; text-align: left; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #eee; color: #666;">
                            <th style="padding: 1rem;">PRODUCTO</th>
                            <th style="padding: 1rem;">CANTIDAD</th>
                            <th style="padding: 1rem;">FECHA</th>
                            <th style="padding: 1rem;">ESTADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.length > 0 ? rows : '<tr><td colspan="4" style="padding:1rem; text-align:center;">No hay datos</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderZonePickup(zone, container) {
        // Filter from LOCAL Cache
        const zoneRequests = this.data.requests.filter(r => r.usuario === zone);
        const pending = zoneRequests.filter(r => r.categoria === 'solicitado');
        const separated = zoneRequests.filter(r => r.categoria === 'separado');

        // Logic to hide Separated Column if empty
        const hideSeparated = separated.length === 0;
        const gridTemplate = hideSeparated ? 'grid-template-columns: 1fr;' : 'grid-template-columns: 1fr 1fr;';

        // Render Pending Cards
        const pendingHtml = pending.map(req => `
            <div class="product-card">
                <div class="card-header">
                    <div>
                        <div class="card-code">${req.codigo}</div>
                        <div class="card-desc">${this.getProductDescription(req.codigo)}</div>
                    </div>
                </div>
                <div class="card-actions" style="justify-content: space-between; margin-top:0.5rem;">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                         <label style="font-size:0.8rem;">Cant:</label>
                         <input type="number" id="qty-${req.idSolicitud}" class="qty-input" value="${req.cantidad}" min="0.5" step="0.5">
                    </div>
                    <button class="btn-primary" style="padding: 0.4rem 0.8rem; font-size:0.85rem;" onclick="app.moveToSeparated('${req.idSolicitud}')">
                        Separar <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Render Separated Cards
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
            <div class="pickup-layout" style="${gridTemplate}">
                <div class="pickup-column">
                    <h4 style="color: var(--primary-color);">
                        <i class="fa-solid fa-list-check"></i> Pendientes (${pending.length})
                    </h4>
                    ${pending.length > 0 ? pendingHtml : '<div class="empty-state-small"><p>Todo al día 🎉</p></div>'}
                </div>
                
                ${!hideSeparated ? `
                <div class="pickup-column">
                    <h4 style="color: #10B981;">
                        <i class="fa-solid fa-box-open"></i> Listos para Despacho (${separated.length})
                    </h4>
                    ${separatedHtml}
                </div>` : ''}
            </div>

            <button id="fab-dispatch" class="fab-btn ${hideSeparated ? 'hidden' : ''}" onclick="app.dispatchAll('${zone}')">
                <i class="fa-solid fa-paper-plane"></i> Despachar Todo
            </button>
        `;
    }

    async moveToSeparated(id) {
        const qtyInput = document.getElementById(`qty-${id}`);
        const newQty = qtyInput.value;
        const btn = qtyInput.nextElementSibling; // The button

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow', // Important for GAS
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: 'updateRequests',
                    payload: [{ idSolicitud: id, cantidad: newQty, categoria: 'separado' }]
                })
            });

            // Re-fetch to sync
            await this.fetchRequests();

            // Refresh View (Find active zone)
            const activeZoneTitle = document.querySelector('#zone-workspace h4 span');
            if (activeZoneTitle) {
                const zone = activeZoneTitle.innerText.toLowerCase();
                this.switchZoneTab(zone, 'pickup', null); // Refresh tab
            }

        } catch (e) {
            console.error(e);
            alert('Error al conectar');
            btn.innerHTML = 'Error';
        }
    }

    async dispatchAll(zone) {
        if (!confirm('¿Despachar todos los ítems separados?')) return;

        const btn = document.getElementById('fab-dispatch');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        const toDispatch = this.data.requests
            .filter(r => r.usuario === zone && r.categoria === 'separado')
            .map(r => ({ idSolicitud: r.idSolicitud, categoria: 'despachado' }));

        if (toDispatch.length === 0) return;

        try {
            await fetch(API_URL, {
                method: 'POST',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'updateRequests', payload: toDispatch })
            });

            await this.fetchRequests();
            this.renderZonePickup(zone, document.getElementById('zone-tab-content'));
            alert('Despacho realizado con éxito');

        } catch (e) {
            alert('Error al despachar');
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
