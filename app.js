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
        console.log("🚀 APP VERSION 31 - RETROACTIVE FIX");
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
                const targetId = link.dataset.target;

                // Cleanup Dispatch Header (Restore Default)
                this.restoreDefaultHeader();

                this.navigateTo(targetId);
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
            'prepedidos': 'Prepedidos - Proveedores',
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
        } else if (viewName === 'prepedidos') {
            this.state.currentModule = 'prepedidos';
            this.loadPrepedidos();
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

        // Start Background Sync Loop
        this.startBackgroundSync();
    }

    startBackgroundSync() {
        // Run every 60 seconds
        setInterval(async () => {
            // Only sync if tab is visible (Browser optimization)
            if (document.hidden) return;

            console.log('Background Sync...');
            await this.fetchProducts({ isBackground: true });
            await this.fetchRequests({ isBackground: true });

            // Trigger Smart View Update
            this.updateCurrentView();
        }, 60000);
    }

    updateCurrentView() {
        // Only valid for Dispatch for now
        if (this.state.currentModule !== 'dispatch') return;

        // Check if user is interacting with an input
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag === 'INPUT' || activeTag === 'TEXTAREA') {
            console.log('Skipping view update due to user interaction.');
            return;
        }

        const workspace = document.getElementById('zone-workspace');
        if (!workspace) return;

        // DETECT CURRENT VIEW STATE
        const activeBtn = document.querySelector('.client-buttons-group .btn-zone.active');

        // CASE A: MASTER LIST (No Zone Selected)
        if (!activeBtn) {
            // Restore Scroll for Window (Main Scrollbar)
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            workspace.innerHTML = this.renderProductMasterList();

            // Restore Scroll
            window.scrollTo(0, scrollTop);
        }
        // CASE B: ZONE VIEW
        else {
            const zone = activeBtn.dataset.client;
            // We can re-render zone content safely if no input is focused
            const zoneContent = document.getElementById('zone-content');
            if (zoneContent) {
                this.renderZonePickup(zone, zoneContent);
            }
        }
    }

    async fetchProducts(options = { isBackground: false }) {
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
                    // Optimize the image URL immediately upon storage
                    const stableImg = this.getOptimizedImageUrl(p.imagen);
                    this.data.products[p.codigo] = { desc: p.descripcion, stock: p.stock, img: stableImg };
                });

                // DATA DEBUG
                if (!options.isBackground) {
                    console.log('Products Loaded:', Object.keys(this.data.products).length);
                    if (Object.keys(this.data.products).length === 0) {
                        alert('Alerta: Se descargaron 0 productos. Revise la hoja de Google.');
                    }
                }

                // Initial Load ONLY: Auto-refresh view if empty
                if (!options.isBackground && (this.state.currentModule === 'dispatch')) {
                    const workspace = document.getElementById('zone-workspace');
                    if (workspace && (!workspace.querySelector('.pickup-layout') || workspace.innerText.includes('Cargando'))) {
                        const activeBtn = document.querySelector('.client-buttons-group .btn-zone.active');
                        if (!activeBtn) {
                            workspace.innerHTML = this.renderProductMasterList();
                        }
                    }
                }
            } else {
                console.error('API Error:', result);
                if (!options.isBackground) alert('Error del servidor: ' + (result.message || 'Desconocido'));
            }
        } catch (e) {
            console.error('Error fetching products', e);
            if (!options.isBackground) {
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
    }

    async fetchRequests(options = { isBackground: false }) {
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
                if (!options.isBackground) console.log('Requests loaded:', this.data.requests.length);
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

    handleImageError(imgElement) {
        imgElement.onerror = null; // Prevent infinite loop
        // Fallback to default image
        imgElement.src = 'recursos/defaultImageProduct.png';
    }

    // New Helper to stabilize Drive URLs
    getOptimizedImageUrl(url) {
        if (!url) return '';
        try {
            // Check if it's a Drive URL
            if (url.includes('drive.google.com')) {
                // Try to extract ID using flexible Regex or URL params
                let id = null;

                // Case 1: Standard id parameter
                if (url.includes('id=')) {
                    const idMatch = url.match(/id=([^&]+)/);
                    if (idMatch) id = idMatch[1];
                }
                // Case 2: /d/ID/view format
                else if (url.includes('/d/')) {
                    const idMatch = url.match(/\/d\/([^\/]+)/);
                    if (idMatch) id = idMatch[1];
                }

                if (id) {
                    // Return Thumbnail version (more reliable)
                    // sz=w500 requests a width of 500px, w1000 for high quality
                    return `https://drive.google.com/thumbnail?id=${id}&sz=w500`;
                }
            }
            return url;
        } catch (e) {
            console.error('Error parsing image URL', e);
            return url;
        }
    }

    /**
     * DISPATCH MODULE - NEW HIERARCHY
     * Zone Selection -> Tabs (Requests | Pickup)
     */
    /**
     * DISPATCH MODULE - NEW HIERARCHY
     * Header: [Title] [Search] [Dynamic Client Buttons] [Bell]
     */
    renderDispatchModule() {
        const container = document.getElementById('dispatch-content');
        container.innerHTML = `<div id="zone-workspace" style="margin-top:1rem;"></div>`;

        // 1. Calculate Unique Clients
        const clients = this.getUniqueClients();

        // 2. Render Custom Header
        this.updateHeaderForDispatch(clients);

        // 3. Initial render: show Master List
        document.getElementById('zone-workspace').innerHTML = this.renderProductMasterList();
    }

    getUniqueClients() {
        if (!this.data.requests) return ['zona1', 'zona2']; // Default fallback
        const clients = new Set(this.data.requests.map(r => r.usuario.toLowerCase()));

        // Ensure default zones always exist if they have no requests? 
        // User said "clients are born from requests". So strictly from requests.
        // But let's keep 'zona1' and 'zona2' as seeded if empty for demo.
        if (clients.size === 0) return ['zona1', 'zona2'];

        return Array.from(clients).sort();
    }

    updateHeaderForDispatch(clients) {
        const headerTitle = document.getElementById('page-title');
        const headerActions = document.querySelector('.top-actions');

        if (headerTitle) headerTitle.innerText = 'Despachos';

        if (headerActions) {
            // Generate Buttons HTML
            const buttonsHtml = clients.map(client =>
                `<button class="btn-zone" data-client="${client}" onclick="app.selectZone('${client}')">${client.toUpperCase()}</button>`
            ).join('');

            // Inject Search + Buttons + Bell (Remove Gear)
            headerActions.innerHTML = `
                <div class="header-dispatch-toolbar">
                    <div class="search-bar-header">
                        <i class="fa-solid fa-magnifying-glass search-icon"></i>
                        <input type="text" id="dispatch-search-input" placeholder="Buscar producto o código..." onkeyup="app.filterDispatchView(this.value)">
                        <i class="fa-solid fa-barcode barcode-icon" title="Escanear Código"></i>
                    </div>
                    <div class="client-buttons-group">
                        ${buttonsHtml}
                    </div>
                </div>
                <!-- Bell Only, No Gear -->
                <button class="icon-btn"><i class="fa-regular fa-bell"></i></button>
            `;

            // Auto-Focus Search Bar
            setTimeout(() => {
                const searchInput = document.getElementById('dispatch-search-input');
                if (searchInput) searchInput.focus();
            }, 100);
        }
    }

    restoreDefaultHeader() {
        const headerTitle = document.getElementById('page-title');
        const headerActions = document.querySelector('.top-actions');

        if (headerTitle) headerTitle.innerText = 'Dashboard'; // Or dynamic based on page

        // Restore Default Actions
        if (headerActions) {
            headerActions.innerHTML = `
                <div id="header-dynamic-actions"></div>
                <button class="icon-btn"><i class="fa-regular fa-bell"></i></button>
                <button class="icon-btn"><i class="fa-solid fa-gear"></i></button>
            `;
        }
    }

    filterDispatchView(query) {
        // Clear previous timeout (Debounce)
        if (this.searchTimeout) clearTimeout(this.searchTimeout);

        this.searchTimeout = setTimeout(() => {
            const term = query.toLowerCase().trim();
            const cards = document.querySelectorAll('.product-card');

            // Use requestAnimationFrame for batch DOM update
            requestAnimationFrame(() => {
                cards.forEach(card => {
                    // Fast lookup using data attribute (no reflow)
                    const searchable = card.dataset.search || "";

                    if (!term || searchable.includes(term)) {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }, 300); // Wait 300ms after typing stops
    }

    selectZone(zone) {
        // Toggle Logic
        const container = document.getElementById('zone-workspace');

        // Find buttons using robust data attribute
        const buttons = document.querySelectorAll('.client-buttons-group .btn-zone');
        // Use attribute selector that works regardless of container
        const clickedBtn = document.querySelector(`.client-buttons-group .btn-zone[data-client="${zone}"]`);
        const searchBar = document.querySelector('.search-bar-header');

        // Check if already active (DESELECT)
        if (clickedBtn && clickedBtn.classList.contains('active')) {
            // DESELECT: Remove active class from ALL buttons
            buttons.forEach(b => b.classList.remove('active'));

            // Show Search Bar
            if (searchBar) searchBar.classList.remove('hidden');

            // Animate Exit Right -> Enter Left (Back to Inventory)
            if (container.firstElementChild) {
                container.firstElementChild.classList.add('slide-out-right');

                setTimeout(() => {
                    container.innerHTML = this.renderProductMasterList();
                    // Add Entrance Animation
                    if (container.firstElementChild) {
                        container.firstElementChild.classList.add('slide-in-left');
                    }
                }, 250); // Wait for exit animation
            } else {
                container.innerHTML = this.renderProductMasterList();
            }
            return; // Exit
        }

        // SELECT NEW ZONE
        // Highlight active zone logic
        buttons.forEach(b => {
            if (b === clickedBtn) {
                b.classList.add('active');
                console.log('Activating button:', b.innerText);
            } else {
                b.classList.remove('active');
            }
        });

        // Hide Search Bar
        if (searchBar) searchBar.classList.add('hidden');

        // Animate Exit Left -> Enter Right (Go to Detail)
        if (container.firstElementChild) {
            container.firstElementChild.classList.add('slide-out-left');

            setTimeout(() => {
                this.renderZoneContent(zone, container);
            }, 250);
        } else {
            this.renderZoneContent(zone, container);
        }
    }

    renderZoneContent(zone, container) {
        // Directly Render Pickup/Pending View (No Tabs)
        container.innerHTML = `
            <div class="slide-in-right" style="border-top:1px solid #eee; margin-top:1rem; padding-top:1rem;">
                 <!-- Content Area -->
                 <div id="zone-content"></div>
            </div>
        `;

        this.renderZonePickup(zone, document.getElementById('zone-content'));
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

        // Generate Cards HTML (Alphabetical Sort)
        const productEntries = Object.entries(this.data.products).sort(([, a], [, b]) => {
            return a.desc.localeCompare(b.desc);
        });

        const productCards = productEntries.map(([code, product]) => {
            // Image Logic
            const imgSrc = product.img ? product.img : 'recursos/defaultImageProduct.png';
            const imgHtml = `<img src="${imgSrc}" class="card-img" alt="${product.desc}" referrerpolicy="no-referrer" loading="lazy" onerror="app.handleImageError(this)">`;

            // Searchable Text for Performance
            const searchText = `${code} ${product.desc}`.toLowerCase();

            return `
            <div class="product-card" data-search="${searchText}" onclick="this.classList.toggle('flipped')">
                <div class="product-card-inner">
                    <!-- FRONT -->
                    <div class="card-front">
                        <div class="card-img-container">
                            ${imgHtml}
                        </div>
                        <div class="card-content">
                             <div>
                                <div class="card-desc" style="font-weight:800; font-size:1.05rem; color:#1a1a1a; margin-bottom:0.3rem; line-height:1.2;">${product.desc}</div>
                                <div class="card-code" style="font-size:0.9rem; color:#6b7280; font-family:monospace;">${code}</div>
                            </div>
                             <div style="margin-top:0.5rem; font-weight:bold; color:var(--primary-color); display:flex; align-items:center; gap:0.5rem;">
                                <i class="fa-solid fa-cubes"></i> Stock: ${product.stock}
                            </div>
                        </div>
                    </div>

                    <!-- BACK -->
                    <div class="card-back">
                        <h5 style="margin-bottom:1rem; border-bottom:1px solid #ddd; padding-bottom:0.5rem;">Detalles del Producto</h5>
                        
                        <div class="back-label">Descripción Completa</div>
                        <div class="back-value">${product.desc}</div>

                        <div class="back-label">Código de Sistema</div>
                        <div class="back-value">${code}</div>

                        <div class="back-label">Stock Disponible</div>
                        <div class="back-value" style="font-size:1.2rem; color:var(--primary-color);">${product.stock}</div>

                        <div style="margin-top:auto; text-align:center; color:#999; font-size:0.8rem;">
                            <i class="fa-solid fa-rotate"></i> Click para voltear
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        // Check for duplicates during mapping (debug)
        console.log(`Rendering ${productEntries.length} products.`);

        // Removed Header and Nested Scroll as requested
        return `
            <div style="margin-top:1rem; padding-bottom: 3rem;">
                <!-- Full Page Grid -->
                <div style="
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                    gap: 1rem;
                    /* No fixed height or overflow-y here, letting the page scroll */
                ">
                    ${productCards}
                </div>
            </div>
        `;
    }


    /**
     * MOVIMIENTOS MODULE
     */

    // Switch Tabs (Guias vs Preingresos)
    switchMovTab(tab) {
        document.querySelectorAll('.mov-tab').forEach(b => b.classList.remove('active'));
        document.querySelector(`.mov-tab[onclick="app.switchMovTab('${tab}')"]`).classList.add('active');

        document.querySelectorAll('.mov-tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');

        // Refresh Data on Switch
        if (tab === 'guias') this.renderGuiasList();
        if (tab === 'preingresos') this.renderPreingresos();
    }

    // Load Data
    async loadMovimientosData() {
        // Show Loading
        document.getElementById('guias-list-container').innerHTML = '<div style="text-align:center; padding:2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando...</div>';

        try {
            // Mock call for now if API not ready, but we implemented it.
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow', // FIXED
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getMovimientosData' })
            });
            const result = await response.json();

            if (result.status === 'success') {
                this.data.movimientos = result.data; // { guias, preingresos }
                this.renderGuiasList();
                this.renderPreingresos();
            }
        } catch (e) {
            console.error(e);
        }
    }

    renderGuiasList() {
        const container = document.getElementById('guias-list-container');
        const guias = this.data.movimientos?.guias || [];

        if (guias.length === 0) {
            container.innerHTML = '<div class="empty-state" style="height:200px;"><p>No hay guías registradas</p></div>';
            return;
        }

        const rows = guias.map(g => `
            <tr>
                <td><span class="badge ${g.tipo.toLowerCase()}">${g.tipo}</span></td>
                <td>${g.fecha}</td>
                <td>${g.proveedor || '-'}</td>
                <td>${g.usuario}</td>
                <td>${g.comentario || ''}</td>
                <td>
                    ${g.foto ? `<a href="${g.foto}" target="_blank"><i class="fa-solid fa-image"></i></a>` : ''}
                </td>
            </tr>
        `).join('');

        container.innerHTML = `
            <table class="guias-table">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Fecha</th>
                        <th>Proveedor</th>
                        <th>Usuario</th>
                        <th>Comentario</th>
                        <th>Evidencia</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    renderPreingresos() {
        const container = document.getElementById('preingresos-list-container');
        const pre = this.data.movimientos?.preingresos || [];

        if (pre.length === 0) {
            container.innerHTML = '<div class="empty-state" style="height:200px;"><p>No hay preingresos</p></div>';
            return;
        }

        container.innerHTML = pre.map(p => `
            <div class="product-card" style="height:auto; min-height:150px; background:white; padding:1rem; border:1px solid #eee;">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                    <span class="badge ${p.estado === 'PENDIENTE' ? 'pendiente' : 'procesado'}">${p.estado}</span>
                    <small style="color:#999;">${p.fecha}</small>
                </div>
                <h4 style="margin-bottom:0.5rem;">${p.proveedor}</h4>
                <p style="font-size:0.9rem; color:#666; margin-bottom:1rem;">${p.comentario}</p>
                
                <div style="display:flex; gap:0.5rem; overflow-x:auto; padding-bottom:0.5rem;">
                    ${p.fotos.map(url => `
                        <a href="${url}" target="_blank">
                             <img src="${url}" style="width:50px; height:50px; object-fit:cover; border-radius:4px; border:1px solid #eee;">
                        </a>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    // MODALS & FORMS
    openNewGuiaModal(type) {
        const title = type === 'INGRESO' ? 'Nueva Guía de Ingreso' : 'Nueva Guía de Salida';
        // Generate Providers Options
        // We need providers loaded? We have getProviders API. 
        // For now text input or quick select if we have list.

        // Link Preingreso Options (Only for Ingreso)
        let preingresoSelect = '';
        if (type === 'INGRESO') {
            const pending = (this.data.movimientos?.preingresos || []).filter(p => p.estado === 'PENDIENTE');
            const options = pending.map(p => `<option value="${p.id}">${p.proveedor} - ${p.fecha}</option>`).join('');
            preingresoSelect = `
                <div class="input-group">
                    <label style="font-size:0.8rem; font-weight:bold; display:block; margin-bottom:0.3rem;">Vincular Preingreso (Opcional)</label>
                    <select id="guia-preingreso" style="width:100%; padding:0.5rem; border:1px solid #ddd; border-radius:4px;">
                        <option value="">-- Seleccionar --</option>
                        ${options}
                    </select>
                </div>
            `;
        }

        const modalHtml = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                <form id="new-guia-form">
                    ${preingresoSelect}
                    
                    <div class="input-group">
                         <input type="text" id="guia-proveedor" placeholder="Proveedor / Destino" required style="width:100%; padding:0.5rem;">
                    </div>
                    
                    <div class="input-group">
                        <textarea id="guia-comentario" placeholder="Comentarios..." rows="2" style="width:100%; padding:0.5rem;"></textarea>
                    </div>

                    <!-- Photo Widget (One only for Guia main) -->
                    <div class="photo-widget" id="guia-photo-widget">
                        <input type="file" id="guia-file-input" accept="image/*" class="file-input-hidden" onchange="app.handlePhotoSelect(this, 'guia-preview')">
                        <div id="guia-preview" class="photo-preview-grid"></div>
                        <div class="photo-controls">
                             <button type="button" class="btn-secondary" onclick="document.getElementById('guia-file-input').click()">
                                <i class="fa-solid fa-camera"></i> Adjuntar Foto
                             </button>
                        </div>
                    </div>
                    
                    <hr style="margin:1rem 0; border:0; border-top:1px solid #eee;">
                    
                    <!-- Product Adder -->
                    <h4 style="margin-bottom:0.5rem;">Detalle de Productos</h4>
                    <div class="product-add-row">
                        <input type="text" id="prod-search" placeholder="Buscar producto (Scan/Texto)..." onkeyup="app.searchProductForGuia(this, event)">
                        <input type="number" id="prod-qty" placeholder="Cant." min="1" value="1">
                        <button type="button" class="btn-primary" onclick="app.addProductToGuia()"><i class="fa-solid fa-plus"></i></button>
                    </div>
                    <div id="prod-search-results" style="background:white; border:1px solid #eee; position:absolute; z-index:10; width:60%; display:none;"></div>
                    
                    <div id="temp-prods-list" class="temp-product-list">
                        <!-- Added Items -->
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="app.closeModal()">Cancelar</button>
                <button class="btn-primary" onclick="app.saveGuia('${type}')">Guardar Guía</button>
            </div>
        `;

        this.openModal(modalHtml);
        this.tempGuiaProducts = []; // Reset temp list
    }

    openNewPreingresoModal() {
        const modalHtml = `
             <div class="modal-header">
                <h3>Nuevo Preingreso</h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                 <div class="input-group">
                     <input type="text" id="pre-proveedor" placeholder="Proveedor" required style="width:100%; padding:0.5rem;">
                </div>
                 <div class="input-group">
                    <textarea id="pre-comentario" placeholder="Observaciones..." rows="3" style="width:100%; padding:0.5rem;"></textarea>
                </div>
                
                 <!-- Multi Photo Widget -->
                <div class="photo-widget">
                    <input type="file" id="pre-file-input" accept="image/*" multiple class="file-input-hidden" onchange="app.handlePhotoSelect(this, 'pre-preview', true)">
                    <div id="pre-preview" class="photo-preview-grid"></div>
                    <div class="photo-controls">
                         <button type="button" class="btn-secondary" onclick="document.getElementById('pre-file-input').click()">
                            <i class="fa-solid fa-camera"></i> Agregar Fotos
                         </button>
                    </div>
                </div>
            </div>
             <div class="modal-footer">
                <button class="btn-secondary" onclick="app.closeModal()">Cancelar</button>
                <button class="btn-primary" onclick="app.savePreingreso()">Guardar</button>
            </div>
        `;
        this.openModal(modalHtml);
    }

    // PHOTO LOGIC
    handlePhotoSelect(input, previewId, multiple = false) {
        const files = input.files;
        const container = document.getElementById(previewId);
        if (!multiple) container.innerHTML = '';

        Array.from(files).forEach(file => {
            // Resize before showing/storing (Max 1000px)
            this.resizeImage(file, 1000).then(base64 => {
                const img = document.createElement('img');
                img.src = base64;
                img.className = 'photo-thumb';
                img.dataset.base64 = base64; // API Expects this
                container.appendChild(img);
            });
        });
    }

    // Helper: Resize Image
    resizeImage(file, maxWidth) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8)); // 80% Quality
                };
            };
        });
    }

    // PRODUCT ADDER LOGIC
    searchProductForGuia(input, event) {
        const term = input.value.toLowerCase().trim();
        const resultsDiv = document.getElementById('prod-search-results');

        // Handle "Enter" Key (Scanner behavior)
        if (event && event.key === 'Enter') {
            event.preventDefault(); // Stop form submit or other actions

            // 1. Try EXACT MATCH
            const exactProduct = this.data.products[term.toUpperCase()]; // Try upper (keys are usually upper) or exact key
            // Note: keys in this.data.products are the codes. 
            // If "666" matches a key exactly:

            // Actually, keys might be varying case. Let's find distinct key.
            const exactKey = Object.keys(this.data.products).find(k => k.toLowerCase() === term);

            if (exactKey) {
                // Exact code found.
                // Logic: "si tengo un unico producto cuyo codigo es igual '666' entonces se debe agregar automaticamente"
                // The key IS unique in the map. So if we found it, it's the one.

                // However, user said: "si tuviera dos productos 666a y 6667... mostrar lista"
                // This implies if I type "666", I shouldn't auto-pick "666a".
                // My logic matches: if I typed "666" and "666" exists, take it. 
                // If I typed "666" and only "666a" exists, finding exactKey for "666" will fail.

                this.selectProductForGuia(exactKey, this.data.products[exactKey].desc);
                this.addProductToGuia(); // Auto Add immediately
                return;
            }

            // If not exact match, fall through to search results to show user "Hey, 666 doesn't exist, here is 666a, 666b..."
        }

        if (term.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }

        const matches = Object.entries(this.data.products)
            .filter(([code, p]) => code.toLowerCase().includes(term) || p.desc.toLowerCase().includes(term))
            .slice(0, 15); // Extended limit for visibility

        if (matches.length > 0) {
            resultsDiv.innerHTML = matches.map(([code, p]) => `
                <div style="padding:0.5rem; border-bottom:1px solid #eee; cursor:pointer; font-size:0.9rem;" 
                     onmouseover="this.style.background='#f3f4f6'" 
                     onmouseout="this.style.background='white'"
                     onclick="app.selectProductForGuia('${code}', '${p.desc.replace(/'/g, "")}')">
                    <strong>${code}</strong> - ${p.desc}
                </div>
             `).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.style.display = 'none';
        }
    }

    selectProductForGuia(code, desc) {
        document.getElementById('prod-search').value = `${code} - ${desc}`;
        document.getElementById('prod-search').dataset.code = code;
        document.getElementById('prod-search-results').style.display = 'none';
        document.getElementById('prod-qty').focus();
    }

    addProductToGuia() {
        const input = document.getElementById('prod-search');
        const code = input.dataset.code; // Prefer dataset code
        const val = input.value; // Fallback

        // Extract code if manually typed "CODE - DESC"
        const finalCode = code || (val.includes('-') ? val.split('-')[0].trim() : val.trim());
        const qty = parseInt(document.getElementById('prod-qty').value) || 1;

        if (!finalCode) return alert('Seleccione un producto');
        // Validate existence?
        if (!this.data.products[finalCode]) {
            if (!confirm('El código no parece existir en la lista cargada. ¿Agregar igual?')) return;
        }

        const desc = this.data.products[finalCode] ? this.data.products[finalCode].desc : 'Producto Manual';

        this.tempGuiaProducts.push({ codigo: finalCode, descripcion: desc, cantidad: qty });

        this.renderTempProducts();

        // Reset inputs
        input.value = '';
        delete input.dataset.code;
        document.getElementById('prod-qty').value = 1;
        input.focus();
    }

    renderTempProducts() {
        const container = document.getElementById('temp-prods-list');
        if (this.tempGuiaProducts.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:1rem; color:#999; font-size:0.85rem;">Ningún producto agregado</div>';
            return;
        }

        container.innerHTML = this.tempGuiaProducts.map((p, index) => `
            <div class="temp-item">
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:0.9rem;">${p.codigo}</div>
                    <div style="font-size:0.8rem; color:#666;">${p.descripcion}</div>
                </div>
                <div style="font-weight:bold; margin:0 1rem;">x${p.cantidad}</div>
                <button onclick="app.removeTempProduct(${index})" style="background:none; border:none; color:red; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');
    }

    removeTempProduct(index) {
        this.tempGuiaProducts.splice(index, 1);
        this.renderTempProducts();
    }

    // SAVE LOGIC
    async savePreingreso() {
        const provider = document.getElementById('pre-proveedor').value;
        const comment = document.getElementById('pre-comentario').value;
        const images = Array.from(document.querySelectorAll('#pre-preview img')).map(img => img.dataset.base64);

        if (!provider) return alert('Proveedor requerido');

        const btn = document.querySelector('.modal-footer .btn-primary');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow', // FIXED
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: 'savePreingreso',
                    payload: { proveedor: provider, comentario: comment, fotos: images }
                })
            });
            const result = await response.json();

            if (result.status === 'success') {
                alert('Preingreso guardado');
                this.closeModal();
                this.loadMovimientosData(); // Refresh
            } else {
                alert('Error: ' + result.message);
                btn.disabled = false;
                btn.innerHTML = 'Guardar';
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
            btn.disabled = false;
            btn.innerHTML = 'Guardar';
        }
    }

    async saveGuia(type) {
        if (this.tempGuiaProducts.length === 0) return alert('Agregue al menos un producto');

        const provider = document.getElementById('guia-proveedor').value;
        const comment = document.getElementById('guia-comentario').value;
        const preingresoId = document.getElementById('guia-preingreso') ? document.getElementById('guia-preingreso').value : null;

        // Photo (Single for Guia)
        const imgEl = document.querySelector('#guia-preview img');
        const photo = imgEl ? imgEl.dataset.base64 : null;

        if (!provider) return alert('Proveedor/Destino requerido');

        const btn = document.querySelector('.modal-footer .btn-primary');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;

        const payload = {
            tipo: type,
            usuario: this.currentUser.username,
            proveedor: provider,
            comentario: comment,
            productos: this.tempGuiaProducts,
            idPreingreso: preingresoId,
            foto: photo
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: 'saveGuia',
                    payload: payload
                })
            });
            const result = await response.json();

            if (result.status === 'success') {
                alert('Guía registrada con éxito');
                this.closeModal();
                this.loadMovimientosData();
            } else {
                alert('Error: ' + result.message);
                btn.disabled = false;
                btn.innerHTML = 'Guardar Guía';
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión');
            btn.disabled = false;
            btn.innerHTML = 'Guardar Guía';
        }
    }

    renderZonePickup(zone, container) {
        // 1. Get Today's Date for Filtering (Local String Comparison)
        const today = new Date();
        const localTodayStr = today.toLocaleDateString('es-PE'); // e.g., "13/12/2025" or similar

        const isSameDay = (dateStr) => {
            if (!dateStr) return false;
            let d;
            // Handle "DD/MM/YYYY" manually (common in GAS/Sheets)
            if (typeof dateStr === 'string' && dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    // Note: Month is 0-indexed in JS Constructor
                    // Parsing as Local Time: new Date(2025, 11, 13)
                    d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
            } else {
                // Formatting ISO or standard strings
                d = new Date(dateStr);
            }

            if (!d || isNaN(d.getTime())) return false;

            // Robust Comparison: Allow TODAY and TOMORROW (to handle manual entry errors or timezone shifts)
            // d is already set to 00:00:00
            const diffTime = d.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Allow: Same Day (0) OR Next Day (1) (User's sheet showed 14/12 vs 13/12)
            return diffDays === 0 || diffDays === 1;
        };

        // 2. Aggregate Data Logic
        // Map<ProductCode, { requested: 0, separated: 0, desc, uniqueIds: [] }>
        const aggregator = {};

        // Normalize Zone Name
        const targetZone = zone.toLowerCase(); // 'zona1', 'zona2'

        this.data.requests.forEach(req => {
            // Filter by Zone
            if (req.usuario.toLowerCase() !== targetZone) return;

            // Check Date

            // Check Date
            if (!isSameDay(req.fecha)) {
                return;
            }

            // Normalize Code to String to prevent mismatch
            const codeKey = String(req.codigo).trim();

            // Initialize Aggregator Item
            if (!aggregator[codeKey]) {
                const product = this.data.products[codeKey] || { desc: 'Producto Desconocido - ' + codeKey, img: '' };
                aggregator[codeKey] = {
                    code: codeKey,
                    desc: product.desc,
                    img: product.img, // Pass image
                    requested: 0, // Sum of 'solicitado'
                    separated: 0, // Sum of 'separado'
                    reqIds: []    // To track at least one ID for API call
                };
            }

            const qty = parseFloat(req.cantidad);
            const cat = String(req.categoria).trim().toLowerCase(); // Normalize Category

            if (cat === 'solicitado') {
                aggregator[codeKey].requested += qty;
                aggregator[codeKey].reqIds.push(req.idSolicitud);
            } else if (cat === 'separado') {
                aggregator[codeKey].separated += qty;
            }
        });

        // Split into Lists
        const pendingList = [];
        const separatedList = [];

        Object.values(aggregator).forEach(item => {
            const pendingQty = item.requested - item.separated;

            // Logic: What is requested but NOT separated yet?
            // Actually, usually 'solicitado' records convert to 'separado'. 
            // If the logic is "Movement based": 
            // - 'solicitado' = Pending
            // - 'separado' = Done
            // But they might duplicate lines. 
            // Simplified view: Show 'solicitado' items in left, 'separado' items in right.

            // LEFT COLUMN (Pendientes)
            // Show any item that has 'requested' amount > 0 (assuming 'solicitado' status means pending)
            // Wait, if I approve it, does it change status to 'separado'?
            // Assuming YES. So 'requested' sum represents the *current* pending load if the DB updates rows.
            // If the DB *adds* new rows for separated, then we need to net them?
            // Let's stick to the status:
            // Left Col: Items with status 'solicitado'
            // Right Col: Items with status 'separado'

            if (pendingQty > 0) {
                // SHOW PENDING as whatever is requested. 
                // If the logic is "Movement", pending is Requested - Separated.
                // If the user wants to see "What was requested", we show item.requested.
                // If the user wants "What is LEFT to separate", we show pendingQty.
                // Based on "Cant: [input]", it implies separating balance.
                // But wait, if pendingQty <= 0, it means fully separated.
                // Should we hide it from "Pendientes"? 
                // YES, "Pendientes" usually means "Pending Action".
                // BUT the user screenshot shows "Pendientes (1)".
                // If I hide it, it disappears.
                // Let's stick to showing it if pendingQty > 0.
                if (pendingQty > 0) {
                    pendingList.push({ ...item, qtyToShow: pendingQty, type: 'pending', useId: item.reqIds[0] });
                }
            }
            if (item.separated > 0) {
                separatedList.push({ ...item, qtyToShow: item.separated, type: 'separated' });
            }
        });

        const renderCard = (item, isPending) => {
            // Image Logic for Requests
            const imgSrc = item.img ? item.img : 'recursos/defaultImageProduct.png';
            const imgHtml = `<img src="${imgSrc}" class="card-img" alt="${item.desc}" referrerpolicy="no-referrer" loading="lazy" onerror="app.handleImageError(this)">`;

            // Combine code and desc for search, normalized
            const searchTerms = `${item.code} ${item.desc}`.toLowerCase();

            return `
            <div class="product-card request-card" data-search="${searchTerms}" onclick="this.classList.toggle('flipped')">
                <div class="product-card-inner" style="border-left: 4px solid ${isPending ? 'var(--primary-color)' : '#2e7d32'};">
                     <!-- FRONT -->
                    <div class="card-front">
                         <div class="card-img-container" style="height:140px;">
                            ${imgHtml}
                        </div>
                        <div class="card-content">
                             <div class="card-header">
                                <div>
                                    <div class="card-desc" style="font-weight:700; color:#000;">${item.desc}</div>
                                    <div class="card-code" style="color:#666; font-size:0.85rem;">${item.code}</div>
                                </div>
                                <div style="text-align:right;">
                                    <div style="font-weight:bold; font-size:1.2rem;">${item.qtyToShow} <span style="font-size:0.8rem;">un</span></div>
                                </div>
                            </div>
                            ${isPending ? `
                             <div class="card-inputs" style="margin-top:auto; padding-top:1rem; border-top:1px solid #eee; display:flex; gap:0.5rem; justify-content:flex-end;" onclick="event.stopPropagation()">
                                 <div style="display:flex; align-items:center; gap:0.5rem;">
                                    <label style="font-size:0.8rem;">Cant:</label>
                                    <input type="number" id="qty-${item.useId}" value="${item.qtyToShow}" min="1" max="${item.qtyToShow}" style="width:60px; padding:5px; text-align:center; border:1px solid #ddd; border-radius:4px;">
                                 </div>
                                 <button class="btn-primary" onclick="app.moveToSeparated(this, '${item.useId}')">Separar</button>
                               </div>
                            ` : `
                               <div style="margin-top:auto; padding-top:0.5rem; text-align:right;">
                                    <span style="color:#2e7d32; font-weight:600; font-size:0.85rem;"><i class="fa-solid fa-check-circle"></i> Separado</span>
                               </div>
                            `}
                        </div>
                    </div>

                    <!-- BACK -->
                    <div class="card-back">
                         <h5 style="margin-bottom:1rem; border-bottom:1px solid #eee; padding-bottom:0.5rem;">
                            ${isPending ? 'Detalles de Solicitud' : 'Ítem Separado'}
                         </h5>
                        <div class="back-label">Descripción</div>
                        <div class="back-value">${item.desc}</div>
                        </div>
                    </div>
                </div>`;
        };

        const hasSeparated = separatedList.length > 0;

        const isCollapsed = separatedList.length === 0;

        container.innerHTML = `
            <!-- Flux Container -->
            <div style="display: flex; flex-direction: row; flex-wrap: nowrap; gap: 2rem; align-items: start; height: 85vh; overflow: hidden;">
                
                <!-- COLUMN 1: PENDING -->
                <div class="column-pending" style="flex: 1; min-width: 0; background: #f8f9fa; padding: 1rem; border-radius: 8px; display: flex; flex-direction: column; height: 100%; transition: all 0.3s ease;">
                    <h5 style="color: var(--primary-color); border-bottom:1px solid #ddd; padding-bottom:0.5rem; flex-shrink: 0; margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-list-ul"></i> Pendientes (${pendingList.length})
                    </h5>
                    <!-- Search Input Pending -->
                    <div style="margin-bottom: 1rem; position: relative; flex-shrink: 0;">
                        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                        <input type="text" placeholder="Filtrar pendientes..." onkeyup="app.filterColumnList(this, 'column-pending')" 
                            style="width: 100%; padding: 8px 10px 8px 32px; border: 1px solid #ddd; border-radius: 20px; outline: none;">
                    </div>
                    <div style="flex: 1; overflow-y: auto; padding-right: 5px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); grid-auto-rows: max-content; gap: 1rem; align-content: start;">
                        ${pendingList.length > 0
                ? pendingList.map(i => renderCard(i, true)).join('')
                : '<div style="grid-column: 1 / -1; text-align:center; padding:2rem; color:#999;">Todo al día 🎉</div>'}
                    </div>
                </div>

                <!-- COLUMN 2: SEPARATED -->
                <div class="column-separated" style="${isCollapsed ? 'width: 320px; flex: 0 0 320px;' : 'flex: 1; min-width: 0;'} background: #e8f5e9; padding: 1rem; border-radius: 8px; display: flex; flex-direction: column; height: 100%; transition: all 0.3s ease;">
                    <h5 style="color: #2e7d32; border-bottom:1px solid #a5d6a7; padding-bottom:0.5rem; flex-shrink: 0; margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-boxes-packing"></i> Separados (${separatedList.length})
                    </h5>
                    <!-- Search Input Separated -->
                    <div style="margin-bottom: 1rem; position: relative; flex-shrink: 0;">
                        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #66bb6a;"></i>
                        <input type="text" placeholder="Filtrar separados..." onkeyup="app.filterColumnList(this, 'column-separated')" 
                            style="width: 100%; padding: 8px 10px 8px 32px; border: 1px solid #a5d6a7; border-radius: 20px; outline: none; background: #fff;">
                    </div>
                     <div style="flex: 1; overflow-y: auto; padding-right: 5px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); grid-auto-rows: max-content; gap: 1rem; align-content: start;">
                        ${separatedList.length > 0
                ? separatedList.map(i => renderCard(i, false)).join('')
                : '<div style="grid-column: 1 / -1; text-align:center; padding:2rem; color:#81c784; font-style:italic;">Nada separado aún</div>'}
                    </div>
                </div>
            </div>
        `;
    }

    // Scoped Column Filtering
    filterColumnList(input, columnClass) {
        const term = input.value.toLowerCase().trim();
        // Traverse up to find the closest container if needed, but here filtering by class is safer
        // because we passed 'column-pending' or 'column-separated' specifically.
        // However, we must ensure we only target the visible ones in the current view.

        // Find the specific column container where this input lives would be even better to support multiple zones if ever needed
        // But scoping by class is fine for now as there's only one active zone view at a time.
        const container = input.closest(`.${columnClass}`);

        if (!container) return;

        const cards = container.querySelectorAll('.product-card');

        requestAnimationFrame(() => {
            cards.forEach(card => {
                const searchable = card.dataset.search || "";

                if (!term || searchable.includes(term)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
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
                    preview.textContent = `✅ ${desc} `;
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
                    preview.textContent = `✅ ${desc} `;
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

    // --- PREPEDIDOS LOGIC ---
    async loadPrepedidos() {
        const container = document.getElementById('prepedidos-container');
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color:#666;"><i class="fa-solid fa-circle-notch fa-spin fa-2x"></i><p style="margin-top:1rem;">Cargando lista de proveedores...</p></div>';

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getProviders' })
            });
            const result = await response.json();

            if (result.status === 'success') {
                this.renderProviders(result.data);
            } else {
                container.innerHTML = `<div class="error-card" style="grid-column:1/-1; color:red; text-align:center;">Error: ${result.message}</div>`;
            }
        } catch (e) {
            console.error(e);
            container.innerHTML = `<div class="error-card" style="grid-column:1/-1; color:red; text-align:center;">Error de conexión. Intente nuevamente.</div>`;
        }
    }

    renderProviders(providers) {
        const container = document.getElementById('prepedidos-container');

        const daysMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
        const todayName = daysMap[new Date().getDay()]; // e.g., "SABADO"

        container.innerHTML = providers.map(p => {
            const imgUrl = (p.imagen && p.imagen.trim() !== '') ? p.imagen : 'recursos/supplierDefault.png';

            const diaPedido = p.diaPedido ? p.diaPedido.toUpperCase() : '-';
            const diaEntrega = p.diaEntrega ? p.diaEntrega.toUpperCase() : '-';

            // Class logic
            const orderClass = (diaPedido === todayName) ? 'pill-today-order' : 'pill-default';
            const deliveryClass = (diaEntrega === todayName) ? 'pill-today-delivery' : 'pill-default';

            return `
            <div class="provider-card">
                <div class="provider-card-header">
                    <img src="${imgUrl}" alt="${p.nombre}" class="provider-img" onerror="this.onerror=null; this.src='recursos/supplierDefault.png'">
                </div>
                <div class="provider-body">
                    <div class="provider-name-container">
                         <h3 class="provider-name">${p.nombre}</h3>
                    </div>

                    <div class="provider-info-row">
                        <span class="provider-label"><i class="fa-regular fa-calendar-check" style="margin-right:5px;"></i> Día Pedido:</span>
                        <span class="provider-pill ${orderClass}">${diaPedido}</span>
                    </div>
                    <div class="provider-info-row">
                        <span class="provider-label"><i class="fa-solid fa-truck-ramp-box" style="margin-right:5px;"></i> Día Entrega:</span>
                        <span class="provider-pill ${deliveryClass}">${diaEntrega}</span>
                    </div>
                </div>
                <div class="provider-footer">
                    <button class="btn-primary" style="width: 100%; padding: 10px; font-size: 0.9rem; border-radius: 8px; box-shadow: none;">
                        <i class="fa-solid fa-cart-plus"></i> Generar Prepedido
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    filterPrepedidos(input) {
        const term = input.value.toLowerCase().trim();
        const container = document.getElementById('prepedidos-container');
        const cards = container.querySelectorAll('.provider-card');

        requestAnimationFrame(() => {
            cards.forEach(card => {
                // We search in the whole card text content (Name is in h3)
                const text = card.textContent.toLowerCase();
                if (!term || text.includes(term)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
}

// Initialize App

try {
    app = new App();
} catch (err) {
    console.error('Critical Init Error:', err);
    alert('Error crítico al iniciar la aplicación: ' + err.message);
}
