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
                redirect: 'follow', // FIXED: Required for GAS
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

        // Setup Permissions
        this.setupPermissions();

        // Show App
        this.showApp();
        this.navigateTo('dashboard');

        // Start Pre-load with visual feedback
        this.loadInitialData();
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
            this.state.currentModule = 'dispatch';
            this.renderDispatchModule();
        } else {
            this.state.currentModule = null;
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
        const loadingToast = document.createElement('div');
        loadingToast.id = 'loading-toast';
        loadingToast.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> Sincronizando datos...';
        loadingToast.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; 
            background: var(--primary-color); color: white; 
            padding: 10px 20px; border-radius: 50px; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.2); z-index: 2000;
            font-size: 0.9rem; transition: opacity 0.5s;
        `;
        document.body.appendChild(loadingToast);

        await Promise.all([
            this.fetchProducts(),
            this.fetchRequests()
        ]);

        loadingToast.innerHTML = '<i class="fa-solid fa-check"></i> Datos sincronizados';
        setTimeout(() => {
            loadingToast.style.opacity = '0';
            setTimeout(() => loadingToast.remove(), 500);
        }, 2000);
    }

    async fetchProducts() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow', // FIXED: Required for GAS
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getProducts' })
            });
            const result = await response.json();

            if (result.status === 'success') {
                // Update to store full product object
                result.data.forEach(p => {
                    this.data.products[p.codigo] = { desc: p.descripcion, stock: p.stock };
                });

                // DATA DEBUG
                console.log('Products Loaded:', Object.keys(this.data.products).length);
                if (Object.keys(this.data.products).length === 0) {
                    alert('Alerta: Se descargaron 0 productos. Revise la hoja de Google.');
                }

                // Auto-refresh view if on Dispatch
                if (this.state.currentModule === 'dispatch' || document.querySelector('#view-dispatch.active')) {
                    // ... same logic
                    const workspace = document.getElementById('zone-workspace');
                    if (workspace && (!workspace.querySelector('.pickup-layout') || workspace.innerText.includes('Cargando'))) {
                        const activeBtn = document.querySelector('.zone-carousel .btn-secondary.active');
                        if (!activeBtn) {
                            workspace.innerHTML = this.renderProductMasterList();
                        }
                    }
                }
            } else {
                console.error('API Error:', result);
                alert('Error del servidor: ' + (result.message || 'Desconocido'));
            }
        } catch (e) {
            console.error('Error fetching products', e);
            const container = document.getElementById('zone-workspace');
            if (container) {
                container.innerHTML = `
                    <div style="text-align:center; padding:2rem; color:red;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Error al cargar inventario.
                        <br><br>
                        <button class="btn-sm" onclick="app.fetchProducts()">
                            <i class="fa-solid fa-rotate-right"></i> Reintentar
                        </button>
                    </div>
                `;
            }
        }
    }

    async fetchRequests() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow', // FIXED
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
        return this.data.products[code]?.desc || 'Producto Desconocido';
    }

    getProductStock(code) {
        return this.data.products[code]?.stock || 0;
    }

    /**
     * DISPATCH MODULE - NEW HIERARCHY
     * Zone Selection -> Tabs (Requests | Pickup)
     */
    renderDispatchModule() {
        // Entry point for "Despachos" link
        const container = document.getElementById('dispatch-content');
        container.innerHTML = `
            <div class="zone-selection-bar" style="
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                background: white; 
                padding: 1rem; 
                border-radius: var(--radius-lg); 
                box-shadow: var(--shadow-sm); 
                margin-bottom: 1rem;
                gap: 1rem;
            ">
                <h4 style="margin:0; white-space:nowrap; color: var(--primary-color);">Selecciona Cliente:</h4>
                
                <div class="zone-carousel" style="
                    display: flex; 
                    gap: 0.5rem; 
                    overflow-x: auto; 
                    padding-bottom: 2px;
                    scrollbar-width: thin; /* Firefox */
                    flex: 1;
                    justify-content: flex-end; /* Align to right */
                ">
                    <button class="btn-secondary" onclick="app.selectZone('zona1')" style="flex-shrink:0;">ZONA 1</button>
                    <button class="btn-secondary" onclick="app.selectZone('zona2')" style="flex-shrink:0;">ZONA 2</button>
                    <!-- Simulation of more clients -->
                    <button class="btn-secondary" onclick="app.selectZone('zona3')" style="flex-shrink:0; display:none;">CLIENTE EXTRA 1</button>
                    <button class="btn-secondary" onclick="app.selectZone('zona4')" style="flex-shrink:0; display:none;">CLIENTE EXTRA 2</button>
                </div>
            </div>

            <div id="zone-workspace">
                <!-- If no zone selected, show Product Master List -->
                ${this.renderProductMasterList()}
            </div>
        `;
    }

    renderProductMasterList() {
        if (!this.data.products || Object.keys(this.data.products).length === 0) {
            return `
                <div style="text-align:center; padding:2rem; color:#666;">
                    <i class="fa-solid fa-spinner fa-spin"></i> Cargando inventario...
                    <div style="margin-top:1rem;">
                        <small>¿Tarda demasiado?</small><br>
                        <button class="btn-sm" style="margin-top:0.5rem;" onclick="app.fetchProducts()">
                            <i class="fa-solid fa-rotate"></i> Forzar Recarga
                        </button>
                    </div>
                </div>
            `;
        }

        const productCards = Object.entries(this.data.products).map(([code, product]) => {
            // We need to find stock if available in this.data (It might be in products map if we changed data structure)
            // Currently products is Map<Code, Desc>. Let's see if we updated fetchProducts logic.
            // Actually, let's fix fetchProducts first to store full object, not just description map.
            return `
            <div class="product-card">
                <div class="card-header">
                     <div>
                        <div class="card-code">${code}</div>
                        <div class="card-desc">${product.desc}</div>
                    </div>
                     <div style="font-weight:bold; color:var(--primary-color);">
                        <i class="fa-solid fa-cubes"></i> ${product.stock}
                    </div>
                </div>
            </div>`;
        }).join('');

        // Check for duplicates during mapping (debug)
        const uniqueCodes = new Set(Object.keys(this.data.products));
        console.log(`Rendering ${uniqueCodes.size} unique products.`);

        return `
            <div style="margin-top:2rem; height: calc(100vh - 160px); display: flex; flex-direction: column;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-shrink: 0;">
                    <h4 style="color:#666; margin:0;">Inventario General (${Object.keys(this.data.products).length})</h4>
                </div>
                <!-- Independent Scrolling Grid for Master List -->
                <div style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 1rem;
                    overflow-y: auto;
                    padding: 0.5rem;
                    padding-bottom: 3rem; /* Space for FAB or bottom */
                    flex: 1; 
                ">
                    ${productCards}
                </div>
            </div>
        `;
    }

    selectZone(zone) {
        // Toggle Logic
        const container = document.getElementById('zone-workspace');
        const clickedBtn = Array.from(document.querySelectorAll('.zone-carousel .btn-secondary'))
            .find(b => b.innerText.toLowerCase().includes(zone.replace('zona', '')));

        // Check if already active
        if (clickedBtn && clickedBtn.classList.contains('active')) {
            // DESELECT: Remove active class and show Master List
            clickedBtn.classList.remove('active');
            clickedBtn.style.backgroundColor = 'white';
            clickedBtn.style.color = 'var(--text-main)';
            clickedBtn.style.borderColor = 'var(--border-color)';

            container.innerHTML = this.renderProductMasterList();
            return; // Exit
        }

        // Highlight active zone logic
        const buttons = document.querySelectorAll('.zone-carousel .btn-secondary');
        buttons.forEach(b => {
            if (b === clickedBtn) {
                b.classList.add('active');
                b.style.backgroundColor = 'var(--primary-light)';
                b.style.color = 'var(--primary-color)';
                b.style.borderColor = 'var(--primary-color)';
            } else {
                b.classList.remove('active');
                b.style.backgroundColor = 'white';
                b.style.color = 'var(--text-main)';
                b.style.borderColor = 'var(--border-color)';
            }
        });

        // Directly Render Pickup/Pending View (No Tabs)
        container.innerHTML = `
            <div style="border-top:1px solid #eee; margin-top:1rem; padding-top:1rem;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h4 style="margin:0;">Gestionando: <span style="color:var(--primary-color); text-transform:uppercase;">${zone}</span></h4>
                    <button class="btn-sm" onclick="app.fetchRequests()"><i class="fa-solid fa-rotate"></i> Actualizar</button>
                </div>
                <!-- Content Area -->
                <div id="zone-content"></div>
            </div>
        `;

        this.renderZonePickup(zone, document.getElementById('zone-content'));
    }

    renderZonePickup(zone, container) {
        // Aggregate Data Logic
        // Map<ProductCode, { requested: 0, separated: 0, desc, uniqueIds: [] }>
        const aggregator = {};

        // Normalize Zone Name
        const targetZone = zone.toLowerCase(); // 'zona1', 'zona2'

        this.data.requests.forEach(req => {
            // Check Zone
            if (req.usuario.toLowerCase() !== targetZone) return;

            // Initialize Aggregator Item
            if (!aggregator[req.codigo]) {
                const product = this.data.products[req.codigo] || { desc: 'Producto Desconocido' };
                aggregator[req.codigo] = {
                    code: req.codigo,
                    desc: product.desc,
                    requested: 0, // Sum of 'solicitado'
                    separated: 0, // Sum of 'separado'
                    reqIds: []    // To track at least one ID for API call
                };
            }

            const qty = parseFloat(req.cantidad);
            if (req.categoria === 'solicitado') {
                aggregator[req.codigo].requested += qty;
                aggregator[req.codigo].reqIds.push(req.idSolicitud);
            } else if (req.categoria === 'separado') {
                aggregator[req.codigo].separated += qty;
            }
        });

        // Split into Lists
        const pendingList = [];
        const separatedList = [];

        Object.values(aggregator).forEach(item => {
            const pendingQty = item.requested - item.separated;

            // If there is still something pending to separate
            if (pendingQty > 0) {
                // Determine ID to use (first valid one)
                const useId = item.reqIds.length > 0 ? item.reqIds[0] : 'unknown';
                pendingList.push({ ...item, qtyToShow: pendingQty, type: 'pending', useId: useId });
            }

            // If there is something already separated (User wants to see this list too)
            if (item.separated > 0) {
                separatedList.push({ ...item, qtyToShow: item.separated, type: 'separated', debt: pendingQty });
            }
        });

        // Helper to render card
        const renderCard = (item, isPending) => {
            const btnAction = isPending
                ? `<div class="card-inputs" style="margin-top:0.5rem; display:flex; gap:0.5rem; justify-content:flex-end;">
                     <div style="display:flex; align-items:center; gap:0.5rem;">
                        <label style="font-size:0.8rem;">Cant:</label>
                        <input type="number" id="qty-${item.useId}" value="${item.qtyToShow}" min="1" max="${item.qtyToShow}" style="width:60px; padding:5px; text-align:center; border:1px solid #ddd; border-radius:4px;">
                     </div>
                     <button class="btn-primary" onclick="app.moveToSeparated(this, '${item.useId}')">Separar</button>
                   </div>`
                : `<span class="badge" style="background:#e8f5e9; color:#2e7d32;"><i class="fa-solid fa-check"></i> Listo</span>`;

            const debtBadge = (!isPending && item.debt > 0)
                ? `<div style="font-size:0.75rem; color:#e53935; text-align:right; margin-top:0.2rem;">Falta: ${item.debt}</div>`
                : '';

            return `
            <div class="product-card request-card" style="border-left: 4px solid ${isPending ? 'var(--primary-color)' : '#43a047'}; margin-bottom:1rem;">
                <div class="card-header">
                     <div>
                        <div class="card-code" style="color:${isPending ? '#333' : '#43a047'}">${item.code}</div>
                        <div class="card-desc">${item.desc}</div>
                    </div>
                     <div style="text-align:right;">
                        <div style="font-weight:bold; font-size:1.2rem;">Total: ${item.qtyToShow} <span style="font-size:0.8rem;">un</span></div>
                        ${debtBadge}
                    </div>
                </div>
                ${isPending ? btnAction : ''}
            </div>`;
        };

        const hasSeparated = separatedList.length > 0;
        const gridCols = hasSeparated ? '1fr 1fr' : '1fr';

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                 <h4 style="margin:0;">Gestionando: <span style="color:var(--primary-color);">${zone.toUpperCase()}</span></h4>
                 <button class="btn-sm" onclick="app.fetchRequests()"><i class="fa-solid fa-rotate"></i> Actualizar</button>
            </div>

            <div style="display: grid; grid-template-columns: ${gridCols}; gap: 2rem; align-items: start;">
                
                <!-- COLUMN 1: PENDING -->
                <div class="column-pending" style="background: #f8f9fa; padding: 1rem; border-radius: 8px;">
                    <h5 style="color: var(--primary-color); border-bottom:1px solid #ddd; padding-bottom:0.5rem;">
                        <i class="fa-solid fa-list-ul"></i> Pendientes (${pendingList.length})
                    </h5>
                    ${pendingList.length > 0
                ? pendingList.map(i => renderCard(i, true)).join('')
                : '<div style="text-align:center; padding:2rem; color:#999;">Todo al día 🎉</div>'}
                </div>

                <!-- COLUMN 2: SEPARATED -->
                ${hasSeparated ? `
                <div class="column-separated" style="background: #e8f5e9; padding: 1rem; border-radius: 8px;">
                    <h5 style="color: #2e7d32; border-bottom:1px solid #a5d6a7; padding-bottom:0.5rem;">
                        <i class="fa-solid fa-boxes-packing"></i> Separados (${separatedList.length})
                    </h5>
                     ${separatedList.map(i => renderCard(i, false)).join('')}
                </div>` : ''}
            </div>
        `;
    }

    async moveToSeparated(btnElement, id) {
        // Correct signature: btnElement first, then ID
        const qtyInput = document.getElementById(`qty-${id}`);
        // Safety check
        if (!qtyInput) {
            console.error('Input not found for ID:', id);
            return;
        }

        const newQty = qtyInput.value;

        if (newQty <= 0) { alert('Cantidad inválida'); return; }

        // UI Feedback
        btnElement.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
        btnElement.disabled = true;

        try {
            await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: 'separateRequest',
                    payload: {
                        idSolicitud: id,
                        cantidad: newQty
                    }
                })
            });

            // Re-fetch to sync
            await this.fetchRequests();

            // Refresh View logic 
            const activeBtn = document.querySelector('.zone-carousel .btn-secondary.active');
            if (activeBtn) {
                const zone = activeBtn.innerText.toLowerCase().replace('zona ', 'zona');
                const zoneContainer = document.getElementById('zone-content');
                if (zoneContainer) this.renderZonePickup(zone, zoneContainer);
            }

        } catch (error) {
            console.error(error);
            alert('Error de conexión.');
            btnElement.innerHTML = 'Error';
            setTimeout(() => { btnElement.innerHTML = 'Separar'; btnElement.disabled = false; }, 2000);
        }
    }
    async dispatchAll(zone) {
        if (!confirm('¿Despachar todos los ítems separados?')) return;

        const btn = document.getElementById('fab-dispatch');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        const toDispatch = this.data.requests
            .filter(r => r.usuario === zone && r.categoria === 'separado')
            .map(r => ({ idSolicitud: r.idSolicitud, categoria: 'despachado' }));

        if (toDispatch.length === 0) {
            alert('No hay ítems para despachar');
            if (btn) btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Despachar Todo';
            return;
        }

        try {
            await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'updateRequests', payload: toDispatch })
            });

            await this.fetchRequests();

            // Refresh View
            const zoneContainer = document.getElementById('zone-content');
            if (zoneContainer) this.renderZonePickup(zone, zoneContainer);

            alert('Despacho realizado con éxito');

        } catch (e) {
            console.error(e);
            alert('Error al despachar: ' + e.message);
            if (btn) btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Despachar Todo';
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
                            <p style="margin-bottom:0.5rem; font-size:0.9rem; color:#666;">Producto (Escanee o Escriba Código)</p>
                            <input type="text" id="req-code" placeholder="Escanee aquí..." required autocomplete="off">
                            <div id="product-preview" style="margin-top:0.5rem; font-size:0.9rem; color:var(--primary-color); font-weight:600; min-height:1.2em;"></div>
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

        // Scanner Logic (Enter triggers lookup)
        const codeInput = document.getElementById('req-code');
        const qtyInput = document.getElementById('req-qty');
        const preview = document.getElementById('product-preview');

        codeInput.focus(); // Auto-focus on open

        codeInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submit
                const code = codeInput.value.trim();
                const desc = this.getProductDescription(code);

                if (desc !== 'Producto Desconocido') {
                    preview.textContent = `✅ ${desc}`;
                    preview.style.color = 'var(--primary-color)';
                    qtyInput.focus();
                } else {
                    preview.textContent = '❌ Producto no encontrado';
                    preview.style.color = 'red';
                }
            }
        });

        // Also lookup on blur
        codeInput.addEventListener('blur', () => {
            const code = codeInput.value.trim();
            if (code) {
                const desc = this.getProductDescription(code);
                if (desc !== 'Producto Desconocido') {
                    preview.textContent = `✅ ${desc}`;
                    preview.style.color = 'var(--primary-color)';
                }
            }
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
// Initialize App
let app;
try {
    app = new App();
} catch (err) {
    console.error('Critical Init Error:', err);
    alert('Error crítico al iniciar la aplicación: ' + err.message);
}
