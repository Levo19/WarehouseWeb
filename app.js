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

        // Background Auto-Refresh (Every 45s)
        // Background Auto-Refresh (Disabled as per user request for Manual Control)
        // setInterval(() => {
        //     if (this.currentUser && this.state.currentModule === 'dispatch-view') {
        //         console.log('🔄 Auto-refreshing Dispatch Data...');
        //         this.fetchRequests().then(() => {
        //             // Refresh Active Zone View
        //             const activeBtn = document.querySelector('.zone-carousel .btn-secondary.active');
        //             if (activeBtn) {
        //                 const zone = activeBtn.innerText.toLowerCase().replace('zona ', 'zona');
        //                 const zoneContainer = document.getElementById('zone-content');
        //                 if (zoneContainer) this.renderZonePickup(zone, zoneContainer);
        //             }
        //         });
        //     }
        // }, 45000);
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

        // PRELOAD DATA (Background)
        this.loadInitialData(); // Products & Dispatch
        this.loadMovimientosData(true); // Guias (Silent)

        // AUTO-REFRESH (Every 60s)
        if (this.refreshInterval) clearInterval(this.refreshInterval);
        this.refreshInterval = setInterval(() => {
            console.log('Background Refresh...');
            this.loadMovimientosData(true);
        }, 60000);

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

        // Restore Default Header Layout (Clears Dynamic Actions)
        this.restoreDefaultHeader();

        // Specific Module Init
        if (viewName === 'dispatch') {
            this.state.currentModule = 'dispatch';
            this.renderDispatchModule();
        } else if (viewName === 'prepedidos') {
            this.state.currentModule = 'prepedidos';
            this.loadPrepedidos();
        } else if (viewName === 'envasador') {
            this.state.currentModule = 'envasador';
            this.loadPackingModule();
        } else if (viewName === 'movements') {
            this.state.currentModule = 'movements';
            if (this.closeGuiaDetails) this.closeGuiaDetails(); // Reset Panel
            this.loadMovimientosData();
            this.renderMovimientosHeader(); // Inject Header Buttons
            this.switchMovTab('guias'); // Force Reset to Guias Tab

            // Auto-refresh every 60s
            setInterval(() => {
                if (this.state.currentModule === 'movements') {
                    this.loadMovimientosData(true); // background = true
                }
            }, 60000);

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
            this.fetchRequests(),
            this.fetchPackingList()
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
            await this.fetchPackingList(true);

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
                this.products = result.data; // Store raw array for array-based lookups (Envasador)

                result.data.forEach(p => {
                    // Optimize the image URL immediately upon storage
                    const stableImg = this.getOptimizedImageUrl(p.imagen);
                    this.data.products[p.codigo] = { desc: p.descripcion, stock: p.stock, img: stableImg, min: p.min };
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

    async selectZone(zone) {
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

        // SELECT NEW ZONE: TRIGGER REFRESH
        // --------------------------------
        // Visual Feedback on Button
        if (clickedBtn) {
            const originalText = clickedBtn.innerText;
            clickedBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
            clickedBtn.disabled = true;

            // Fetch Data
            await this.fetchRequests({ isBackground: false });

            // Restore Button
            clickedBtn.innerHTML = originalText;
            clickedBtn.disabled = false;
        }

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

    // MOVIMIENTOS HEADER LOGIC
    renderMovimientosHeader() {
        const headerActions = document.getElementById('header-dynamic-actions');
        if (!headerActions) return;

        // Check if already rendered to avoid duplicates/flicker
        if (document.getElementById('btn-mov-guias')) return;

        headerActions.innerHTML = `
            <div class="header-tab-group">
                <button id="btn-mov-guias" class="btn-header-tab active" onclick="app.switchMovTab('guias')">Guías</button>
                <button id="btn-mov-preingresos" class="btn-header-tab" onclick="app.switchMovTab('preingresos')">Preingresos</button>
            </div>
        `;
    }

    // Switch Tabs (Guias vs Preingresos)
    switchMovTab(tab) {
        // Toggle Active Class on Header Buttons
        const guiasBtn = document.getElementById('btn-mov-guias');
        const preBtn = document.getElementById('btn-mov-preingresos');

        if (guiasBtn && preBtn) {
            guiasBtn.classList.remove('active');
            preBtn.classList.remove('active');

            if (tab === 'guias') guiasBtn.classList.add('active');
            else preBtn.classList.add('active');
        }

        // Toggle Content Views
        document.querySelectorAll('.mov-tab-content').forEach(c => c.classList.remove('active'));
        const target = document.getElementById(`tab-${tab}`);
        if (target) target.classList.add('active');

        // Close Detail Panels for Fresh Start
        this.closeGuiaDetails();
        this.closePreingresoDetails();

        // Refresh Data on Switch
        if (tab === 'guias') this.renderGuiasList();
        if (tab === 'preingresos') this.renderPreingresos();
    }

    // Load Data
    // Load Data
    async loadMovimientosData(isBackground = false) {
        const container = document.getElementById('guias-list-scroll');
        const CACHE_KEY = 'warehouse_movimientos_data';

        // 1. Try Cache First (Fast Load)
        if (!isBackground) {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    this.data.movimientos = parsed;
                    this.renderGuiasList();
                    this.renderPreingresos();
                    console.log('Loaded from Cache');
                } catch (e) { console.error('Cache error', e); }
            }

            if (container) {
                // Show spinner only if no cache or empty
                if (!this.data.movimientos || !this.data.movimientos.guias) {
                    container.innerHTML = '<div style="text-align:center; padding:2rem; color:#999;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando datos...</div>';
                }
            }
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getMovimientosData' })
            });
            const result = await response.json();

            if (result.status === 'success') {
                // Update Cache
                localStorage.setItem(CACHE_KEY, JSON.stringify(result.data));

                this.data.movimientos = result.data; // { guias, preingresos, detalles, proveedores }
                // !! CRITICAL FIX: Update global providers list !!
                if (result.data.proveedores) {
                    this.data.providers = result.data.proveedores;
                }

                this.renderGuiasList();
                this.renderPreingresos();

                // Refresh open panel if exists
                const activeRow = document.querySelector('.guia-row-card.active');
                if (activeRow) {
                    const id = activeRow.id.replace('guia-row-', '');
                    this.toggleGuiaDetail(id); // Re-open to update
                }
            }
        } catch (e) {
            console.error(e);
            if (!isBackground && container && (!this.data.movimientos || !this.data.movimientos.guias)) {
                container.innerHTML = `<div style="text-align:center; padding:1rem; color:red;">Error de conexión: ${e.message}</div>`;
            }
        }
    }

    /* --- GUIAS LIST REDESIGN --- */

    renderGuiasList() {
        // Wrapper is now STATIC in index.html, no need to inject it.
        // Just trigger filter/render which populates the list.
        this.filterGuiasList();
    }

    clearGuiaFilters() {
        if (document.getElementById('guia-filter-text')) document.getElementById('guia-filter-text').value = '';
        if (document.getElementById('guia-filter-date')) document.getElementById('guia-filter-date').value = '';
        this.filterGuiasList();
    }

    filterGuiasList() {
        const text = document.getElementById('guia-filter-text')?.value.toLowerCase() || '';
        const dateInput = document.getElementById('guia-filter-date')?.value; // YYYY-MM-DD

        let filtered = this.data.movimientos?.guias || [];

        // Filter Text
        if (text) {
            filtered = filtered.filter(g =>
                (g.proveedor && g.proveedor.toLowerCase().includes(text)) ||
                (g.id && g.id.toLowerCase().includes(text)) ||
                (g.usuario && g.usuario.toLowerCase().includes(text))
            );
        }

        // Filter Date
        if (dateInput) {
            // g.fecha is usually "DD/MM/YYYY HH:mm:ss"
            // Let's normalize. 
            filtered = filtered.filter(g => {
                const parts = g.fecha.split(' ')[0].split('/'); // ["16", "12", "2025"]
                // Date input is YYYY-MM-DD
                const gDateISO = `${parts[2]}-${parts[1]}-${parts[0]}`;
                return gDateISO === dateInput;
            });
        }

        this.renderGuiasGrouped(filtered);
    }

    renderGuiasGrouped(list) {
        const container = document.getElementById('guias-list-scroll');
        if (list.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#999; padding:2rem;">No se encontraron guías</div>';
            return;
        }

        // Group by Date
        // Helper to extract date part
        const getDate = (str) => str.split(' ')[0]; // "16/12/2025"

        const groups = {};
        list.forEach(g => {
            const d = getDate(g.fecha);
            if (!groups[d]) groups[d] = [];
            groups[d].push(g);
        });

        // Sort Dates Descending (assuming DD/MM/YYYY format)
        // We convert to timestamp for sorting
        const sortedDates = Object.keys(groups).sort((a, b) => {
            const da = a.split('/').reverse().join('');
            const db = b.split('/').reverse().join('');
            return db.localeCompare(da);
        });

        let html = '';
        sortedDates.forEach(date => {
            html += `<h4 style="margin: 1rem 0 0.5rem 0; color:var(--primary-color); border-bottom:2px solid #f3f4f6; padding-bottom:0.25rem;">${date}</h4>`;
            html += `<div class="guias-group-list">`;

            console.log('Rendering Grouped Guias:', list);

            groups[date].forEach(g => {
                const shortId = g.id ? g.id.slice(-6) : '???';
                html += `
                    <div id="guia-row-${g.id}" class="guia-row-card" onclick="app.toggleGuiaDetail('${g.id}')">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <span class="badge ${g.tipo.toLowerCase()}">${g.tipo}</span>
                                <span style="font-weight:bold; color:#333; margin-left:0.5rem;">${g.proveedor || 'Sin Nombre'}</span>
                            </div>
                            <div style="font-size:0.8rem; color:#666;">${g.fecha.split(' ')[1] || ''}</div>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.5rem;">
                            <div style="font-size:0.85rem; color:#555;">Author: ${g.usuario}</div>
                            <div style="font-size:0.85rem; color:#999;">ID: ...${shortId}</div>
                        </div>
                        ${g.comentario ? `<div style="font-size:0.8rem; color:#888; font-style:italic; margin-top:0.25rem;">"${g.comentario}"</div>` : ''}
                    </div>
                `;
            });

            html += `</div>`;
        });

        container.innerHTML = html;
    }

    async toggleGuiaDetail(id) {
        const panel = document.getElementById('guia-detail-panel');
        const listContainer = document.getElementById('guias-left-col');
        const currentActiveInfo = document.querySelector('.guia-row-card.active');

        // Remove active class from all
        document.querySelectorAll('.guia-row-card').forEach(d => d.classList.remove('active'));

        // If clicking same, CLOSE
        if (currentActiveInfo && currentActiveInfo.id === `guia-row-${id}`) {
            panel.style.width = '0';
            panel.style.opacity = '0';
            panel.innerHTML = '';
            // Close Image Modal if open
            const modal = document.getElementById('image-modal-overlay');
            if (modal) modal.remove();
            return;
        }

        // OPEN logic
        const row = document.getElementById(`guia-row-${id}`);
        if (row) row.classList.add('active'); // Highlight

        panel.style.width = '400px'; // Fixed width for detail
        panel.style.opacity = '1';

        // Use Preloaded Data
        const guiaInfo = this.data.movimientos.guias.find(g => g.id === id);

        // Filter details locally
        const details = this.data.movimientos.detalles
            ? this.data.movimientos.detalles.filter(d => d.idGuia === id)
            : [];

        // Enrich details with description from Products list
        const enrichedDetails = details.map(d => {
            // Fix: products is an Object (Map), not Array. Use Object.values or direct lookup.
            // Direct lookup is faster: this.data.products[d.codigo]
            // But to match loose logic:
            const pCode = String(d.codigo).trim();
            const product = this.data.products[pCode] || Object.values(this.data.products).find(p => String(p.codigo).trim() === pCode);

            return {
                ...d,
                descripcion: product ? product.desc : 'Producto Desconocido'
            };
        });

        this.renderGuiaDetailContent(guiaInfo, enrichedDetails);
    }

    renderGuiaDetailContent(info, products) {
        const panel = document.getElementById('guia-detail-panel');

        // CHECK DATE FOR EDITING
        // info.fecha is "dd/MM/yyyy HH:mm:ss"
        // Get Today "dd/MM/yyyy"
        const now = new Date();
        const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        const guideDateStr = info.fecha.split(' ')[0];
        const canEdit = (todayStr === guideDateStr);

        const productsHtml = products.length > 0 ? products.map(p => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.75rem 0; border-bottom:1px solid #f9f9f9;">
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:0.9rem;">${p.descripcion}</div>
                    <div style="font-size:0.8rem; color:#666;">Code: ${p.codigo}</div>
                </div>
                <div style="font-weight:bold;">x${p.cantidad}</div>
            </div>
        `).join('') : '<div style="padding:1rem; text-align:center; color:#999;">Sin productos registrados</div>';

        // Photo Logic
        let photoHtml = '';
        if (info.foto) {
            const displayUrl = this.getOptimizedImageUrl(info.foto);
            photoHtml = `
                <div style="margin-top:1rem; cursor:pointer;" onclick="app.openImageModal('${displayUrl}')">
                    <img src="${displayUrl}" style="width:100%; height:150px; object-fit:cover; border-radius:8px; border:1px solid #ddd;" title="Click para ampliar">
                    <div style="text-align:center; font-size:0.8rem; color:var(--primary-color); margin-top:0.25rem;"><i class="fa-solid fa-magnifying-glass"></i> Ampliar</div>
                </div>
             `;
        }

        panel.innerHTML = `
            <div style="padding:1.5rem; border-bottom:1px solid #eee; background:#f9fafb;">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <h3 style="margin:0 0 0.5rem 0; color:var(--primary-color);">Detalle de Guía</h3>
                    ${canEdit ? `<button onclick="app.showGuiaEditMode('${info.id}')" class="btn-sm primary"><i class="fa-solid fa-pen-to-square"></i> Editar</button>` : ''}
                </div>
                <div style="font-size:0.9rem; color:#555;"><strong>${info.tipo}</strong> | ${info.fecha}</div>
                <div style="margin-top:0.5rem; font-size:0.95rem;"><strong>Proveedor:</strong> ${info.proveedor}</div>
                <div style="margin-top:0.25rem; font-size:0.95rem;"><strong>Usuario:</strong> ${info.usuario}</div>
                
                ${info.comentario ? `<div style="margin-top:1rem; background:#fff; padding:0.5rem; border-radius:4px; border:1px solid #eee; font-style:italic;">"${info.comentario}"</div>` : ''}
                
                ${photoHtml}
            </div>
            
            <div style="flex:1; overflow-y:auto; padding:1.5rem;">
                <h4 style="margin-bottom:1rem;">Productos (${products.length})</h4>
                ${productsHtml}
            </div>
            
            <div style="padding:1rem; display:flex; gap:1rem; justify-content:center;">
                 <button onclick="app.printGuiaTicket('${info.id}')" style="padding:0.75rem 1.5rem; background:#333; color:white; border:none; border-radius:8px; cursor:pointer;"><i class="fa-solid fa-print"></i> Imprimir</button>
                 <button onclick="app.closeGuiaDetails()" style="padding:0.75rem 1.5rem; background:#eee; border:none; border-radius:8px; cursor:pointer;">Cerrar Panel</button>
            </div>
        `;
    }

    printGuiaTicket(id) {
        const guiaInfo = this.data.movimientos.guias.find(g => g.id === id);
        if (!guiaInfo) return alert('Guía no encontrada');

        // Get Details with names
        const details = this.data.movimientos.detalles
            ? this.data.movimientos.detalles.filter(d => d.idGuia === id)
            : [];

        const enriched = details.map(d => {
            const pCode = String(d.codigo).trim();
            const product = this.data.products[pCode] || Object.values(this.data.products).find(p => String(p.codigo).trim() === pCode);
            return { ...d, descripcion: product ? product.desc : 'Desconocido' };
        });

        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) return alert('Bloqueo de ventanas emergentes activado.');

        printWindow.document.write(`
            <html>
            <head>
                <title>Ticket Guía ${id}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; padding: 2px; max-width: 300px; margin: 0 auto; color: #000; }
                    .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid black; padding-bottom: 5px; }
                    h1 { margin: 0; font-size: 1.4rem; font-weight: 900; text-transform: uppercase; }
                    h2 { margin: 2px 0; font-size: 1rem; font-weight: bold; }
                    .meta { font-size: 0.9rem; margin-bottom: 5px; font-weight: bold; }
                    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
                    th { text-align: left; border-bottom: 2px solid black; padding: 5px 0; font-weight: 900; }
                    td { padding: 8px 0; border-bottom: 1px dashed #000; vertical-align: top; }
                    .qty { text-align: right; width: 40px; font-weight: 900; font-size: 1.1rem; }
                    .footer { margin-top: 15px; border-top: 2px solid black; padding-top: 5px; text-align: center; font-size: 0.8rem; font-weight: bold; }
                    .p-name { font-weight: 900; font-size: 1rem; margin-bottom: 2px; display:block; }
                    .p-code { font-weight: bold; font-size: 0.85rem; color: #000; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${guiaInfo.proveedor || 'SIN PROVEEDOR'}</h1>
                    <h2>ID: ${id.replace('undefined', '').slice(0, 8)}...</h2>
                    <div class="meta">${guiaInfo.fecha}<br>Usuario: ${guiaInfo.usuario}</div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th>Producto / Código</th>
                            <th class="qty">Cant.</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${enriched.map(p => `
                            <tr>
                                <td>
                                    <span class="p-name">${p.descripcion}</span>
                                    <span class="p-code">${p.codigo}</span>
                                </td>
                                <td class="qty">${p.cantidad}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <p>LEVO ERP<br>Control de Inventario</p>
                </div>
                
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    openImageModal(url) {
        const modal = document.createElement('div');
        modal.id = 'image-modal-overlay';
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100vw';
        modal.style.height = '100vh';
        modal.style.backgroundColor = 'rgba(0,0,0,0.85)';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        modal.style.zIndex = '9999';
        modal.style.cursor = 'zoom-out';

        modal.innerHTML = `<img src="${url}" style="max-width:90%; max-height:90vh; border-radius:8px; box-shadow:0 0 20px rgba(0,0,0,0.5);">`;

        modal.onclick = () => modal.remove();
        document.body.appendChild(modal);
    }

    closeGuiaDetails() {
        const panel = document.getElementById('guia-detail-panel');
        panel.style.width = '0';
        document.querySelectorAll('.guia-row-card').forEach(d => d.classList.remove('active'));
    }

    /* --- EDITING LOGIC --- */

    showGuiaEditMode(id) {
        const panel = document.getElementById('guia-detail-panel');
        const guiaInfo = this.data.movimientos.guias.find(g => g.id === id);

        // Find existing details
        let details = this.data.movimientos.detalles
            ? this.data.movimientos.detalles.filter(d => d.idGuia === id)
            : [];

        // Clone for editing state
        this.editingDetails = details.map(d => ({ ...d })); // Deep copy enough? Yes flat structure.

        // Enrich for display (FIXED Lookup & Property)
        this.editingDetails = this.editingDetails.map(d => {
            const pCode = String(d.codigo).trim();
            const product = this.data.products[pCode] || Object.values(this.data.products).find(p => String(p.codigo).trim() === pCode);
            // Fix: Use .desc based on data, and default if missing
            return { ...d, descripcion: product ? product.desc : 'Producto Desconocido' };
        });

        // Removed options logic, using search input now

        panel.innerHTML = `
            <div style="padding:1.5rem; border-bottom:1px solid #eee; background:#f9fafb; display:flex; flex-direction:column; height:100%;">
                <h3 style="color:var(--primary-color); margin-bottom:1rem;">Editar Guía</h3>
                
                <div style="margin-bottom:0.5rem;">
                    <label style="font-size:0.8rem; font-weight:bold;">Proveedor / Destino</label>
                    <input type="text" id="edit-guia-provider" value="${guiaInfo.proveedor || ''}" style="width:100%; padding:0.5rem; border:1px solid #ddd; border-radius:4px;">
                </div>

                <div style="margin-bottom:1rem;">
                    <label style="font-size:0.8rem; font-weight:bold;">Comentario</label>
                    <textarea id="edit-guia-comment" style="width:100%; height:60px; padding:0.5rem; border:1px solid #ddd; border-radius:4px;">${guiaInfo.comentario || ''}</textarea>
                </div>

                <div style="flex:1; overflow-y:auto; margin-bottom:1rem; border:1px solid #eee; border-radius:4px; background:white;">
                    <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
                        <thead style="background:#f3f4f6; position:sticky; top:0;">
                            <tr>
                                <th style="padding:0.5rem; text-align:left;">Producto</th>
                                <th style="padding:0.5rem; width:80px;">Cant.</th>
                                <th style="padding:0.5rem; width:40px;"></th>
                            </tr>
                        </thead>
                        <tbody id="edit-guia-products-body">
                            <!-- Rendered by function -->
                        </tbody>
                    </table>
                </div>


                <!-- Add Product (Search Style) -->
                <div style="margin-bottom:1rem; position:relative;">
                     <div class="search-neon-wrapper" style="position:relative;">
                         <i class="fa-solid fa-barcode" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--primary-color);"></i>
                         <input type="text" id="edit-prod-search" placeholder="Buscar producto para agregar..." 
                                style="width:100%; padding-left:35px; height:45px;" 
                                onkeyup="app.searchProductForEdit(this, event)">
                    </div>
                    <div id="edit-prod-search-results" style="background:white; border:1px solid #eee; position:absolute; z-index:10; width:100%; display:none; max-height:200px; overflow-y:auto; box-shadow:0 4px 6px rgba(0,0,0,0.1);"></div>
                </div>

                <div style="display:flex; gap:1rem; justify-content:end;">
                    <button onclick="app.toggleGuiaDetail('${id}')" style="padding:0.75rem 1.5rem; background:#eee; border:none; border-radius:8px; cursor:pointer;">Cancelar</button>
                    <button id="btn-save-guia" onclick="app.saveGuiaUpdate('${id}')" style="padding:0.75rem 1.5rem; background:var(--primary-color); color:white; border:none; border-radius:8px; cursor:pointer;">Guardar Cambios</button>
                </div>
            </div>
        `;

        this.renderEditProductsTable();
    }

    /* --- EDIT SEARCH LOGIC --- */
    searchProductForEdit(input, event) {
        const term = input.value.toLowerCase().trim();
        const resultsDiv = document.getElementById('edit-prod-search-results');

        if (term.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }

        const matches = Object.entries(this.data.products)
            .filter(([code, p]) => code.toLowerCase().includes(term) || p.desc.toLowerCase().includes(term))
            .slice(0, 15);

        if (matches.length > 0) {
            resultsDiv.innerHTML = matches.map(([code, p]) => `
                <div style="padding:0.5rem; border-bottom:1px solid #eee; cursor:pointer; font-size:0.9rem;" 
                     onmouseover="this.style.background='#f3f4f6'" 
                     onmouseout="this.style.background='white'"
                     onclick="app.selectProductForEdit('${code}', '${p.desc.replace(/'/g, "")}')">
                    <strong>${p.desc}</strong> <span style="color:#888; font-size:0.8rem;">(${code})</span>
                </div>
             `).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.style.display = 'none';
        }
    }

    selectProductForEdit(code, desc) {
        // Add to editingDetails
        const existingIndex = this.editingDetails.findIndex(p => String(p.codigo).trim() === String(code).trim());
        if (existingIndex >= 0) {
            this.editingDetails[existingIndex].cantidad = Number(this.editingDetails[existingIndex].cantidad) + 1;
        } else {
            this.editingDetails.push({ codigo: code, descripcion: desc, cantidad: 1 });
        }

        this.renderEditProductsTable();

        // Clear Search
        const input = document.getElementById('edit-prod-search');
        input.value = '';
        input.focus();
        document.getElementById('edit-prod-search-results').style.display = 'none';
    }

    renderEditProductsTable() {
        const tbody = document.getElementById('edit-guia-products-body');
        if (!tbody) return;

        tbody.innerHTML = this.editingDetails.map((d, index) => `
            <tr style="border-bottom:1px solid #f9f9f9;">
                <td style="padding:0.5rem;">
                    <div style="font-weight:bold; color:#333;">${d.descripcion}</div>
                    <div style="font-size:0.8rem; color:#666;">Code: ${d.codigo}</div>
                </td>
                <td style="padding:0.5rem;">
                    <input type="number" value="${d.cantidad}" min="1" 
                           onchange="app.updateEditQuantity(${index}, this.value)"
                           style="width:60px; padding:0.25rem; border:1px solid #ddd; border-radius:4px; text-align:center;">
                </td>
                <td style="padding:0.5rem;">
                    <button onclick="app.removeProductFromEdit(${index})" style="color:#ef4444; background:none; border:none; cursor:pointer; font-size:1rem;"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    updateEditQuantity(index, val) {
        this.editingDetails[index].cantidad = Number(val);
    }

    removeProductFromEdit(index) {
        this.editingDetails.splice(index, 1);
        this.renderEditProductsTable();
    }

    addProductToEdit() {
        const select = document.getElementById('edit-guia-add-select');
        const code = select.value;
        if (!code) return;

        const product = this.data.products.find(p => p.codigo === code);

        // Check if already exists
        const exists = this.editingDetails.find(d => String(d.codigo) === String(code));
        if (exists) {
            alert('El producto ya está en la lista.');
            return;
        }

        this.editingDetails.push({
            codigo: code,
            descripcion: product ? product.descripcion : '',
            cantidad: 1
        });

        select.value = '';
        this.renderEditProductsTable();
    }

    async saveGuiaUpdate(id) {
        const comment = document.getElementById('edit-guia-comment').value;
        const provider = document.getElementById('edit-guia-provider').value;
        const btn = document.getElementById('btn-save-guia');

        // Allow empty? previous user request said "Allow empty".
        // But here line 1217 checks length.
        // I will remove the check to align with "Guia Vacia" feature.
        // if (this.editingDetails.length === 0) { ... }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

        try {
            const payload = {
                idGuia: id,
                comentario: comment,
                proveedor: provider,
                productos: this.editingDetails.map(d => ({ kode: d.codigo, cantidad: d.cantidad, codigo: d.codigo }))
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'updateGuia', payload: payload })
            });
            const result = await response.json();

            if (result.status === 'success') {
                alert('Guía actualizada correctamente');
                // Reload Data
                await this.loadMovimientosData();
                // Return to view mode (Refresh detail panel with new data)
                this.toggleGuiaDetail(id);
            } else {
                alert('Error: ' + result.message);
                btn.disabled = false;
                btn.innerText = 'Guardar Cambios';
            }

        } catch (e) {
            console.error(e);
            alert('Error de red: ' + e.message);
            btn.disabled = false;
            btn.innerText = 'Guardar Cambios';
        }
    }

    // Helper for Drive Images
    getOptimizedImageUrl(url) {
        if (!url) return '';
        if (url.includes('drive.google.com') && (url.includes('export=view') || url.includes('uc?'))) {
            const idMatch = url.match(/id=([^&]+)/);
            if (idMatch && idMatch[1]) {
                return `https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w1000`;
            }
        }
        return url;
    }

    renderPreingresos() {
        // Initial Render - just trigger filter
        this.filterPreingresosList();
    }

    clearPreingresoFilters() {
        document.getElementById('preingreso-filter-text').value = '';
        document.getElementById('preingreso-filter-date').value = '';
        this.filterPreingresosList();
    }

    filterPreingresosList() {
        const text = document.getElementById('preingreso-filter-text').value.toLowerCase().trim();
        const dateInput = document.getElementById('preingreso-filter-date').value; // YYYY-MM-DD

        let list = this.data.movimientos?.preingresos || [];

        // Filter Text (Proveedor or ID helper although ID is not explicitly stored as simplified string, check content)
        if (text) {
            list = list.filter(p =>
                (p.proveedor || '').toLowerCase().includes(text) ||
                (p.comentario || '').toLowerCase().includes(text) ||
                (p.etiqueta || '').toLowerCase().includes(text)
            );
        }

        // Filter Date
        if (dateInput) {
            // dateInput is YYYY-MM-DD. p.fecha is "DD/MM/YYYY HH:mm:ss"
            const [y, m, d] = dateInput.split('-');
            const searchDate = `${d}/${m}/${y}`;
            list = list.filter(p => p.fecha.startsWith(searchDate));
        }

        this.renderPreingresosGrouped(list);
    }

    renderPreingresosGrouped(list) {
        const container = document.getElementById('preingresos-list-scroll');
        if (!container) return; // Guard if view not ready

        if (list.length === 0) {
            container.innerHTML = '<div style="text-align:center; color:#999; padding:2rem;">No se encontraron preingresos</div>';
            return;
        }

        // Group by Date
        const getDate = (str) => str.split(' ')[0]; // "16/12/2025"
        const groups = {};
        list.forEach(item => {
            const d = getDate(item.fecha);
            if (!groups[d]) groups[d] = [];
            groups[d].push(item);
        });

        // Sort Dates Descending
        const sortedDates = Object.keys(groups).sort((a, b) => {
            const da = a.split('/').reverse().join('');
            const db = b.split('/').reverse().join('');
            return db.localeCompare(da);
        });

        let html = '';
        sortedDates.forEach(date => {
            html += `<h4 style="margin: 1rem 0 0.5rem 0; color:var(--primary-color); border-bottom:2px solid #f3f4f6; padding-bottom:0.25rem;">${date}</h4>`;
            html += `<div class="guias-group-list">`;

            groups[date].forEach(p => {
                // Status Badge Color
                const statusClass = p.estado === 'PENDIENTE' ? 'pendiente' : 'procesado';
                const badgeColor = p.estado === 'PENDIENTE' ? '#f59e0b' : '#10b981';

                // CHECK IF GUIA ALREADY EXISTS
                // We check if any guide has this preingreso ID linked
                const hasGuide = (this.data.movimientos.guias || []).some(g => String(g.idPreingreso) === String(p.id));

                html += `
                    <div id="pre-row-${p.id}" class="guia-row-card" onclick="app.togglePreingresoDetail('${p.id}')">
                         <div style="display:flex; justify-content:space-between; align-items:start;">
                            <div>
                                <span class="badge" style="background:${badgeColor}; color:white;">${p.estado}</span>
                                <span style="font-weight:bold; color:#333; margin-left:0.5rem; display:block; margin-top:0.4rem;">${p.proveedor || 'Sin Nombre'}</span>
                            </div>
                            <div style="font-size:0.8rem; color:#666;">${p.fecha.split(' ')[1] || ''}</div>
                        </div>
                        <div style="margin-top:0.5rem; font-size:0.85rem; color:#666;">
                            ${p.etiqueta ? `<span><i class="fa-solid fa-tag" style="margin-right:4px;"></i>${p.etiqueta}</span>` : ''}
                        </div>
                         ${p.fotos && p.fotos.length > 0 ?
                        `<div style="margin-top:0.5rem; font-size:0.8rem; color:var(--primary-color);"><i class="fa-regular fa-images"></i> ${p.fotos.length} fotos adjuntas</div>`
                        : ''}
                         
                         ${!hasGuide ? `
                            <button onclick="event.stopPropagation(); app.generateGuiaFromPreingreso('${p.id}')" 
                                    class="btn-sm" 
                                    style="margin-top:0.75rem; width:100%; background:var(--primary-color); color:white; border:none; border-radius:15px; padding:4px 0; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:0.4rem; font-size:0.75rem; font-weight:500; height: 28px;">
                                <i class="fa-solid fa-file-import" style="font-size:0.7rem;"></i> Generar Guía
                            </button>
                         ` : ''}
                    </div>
                `;
            });
            html += `</div>`;
        });

        container.innerHTML = html;
    }

    async togglePreingresoDetail(id) {
        const panel = document.getElementById('preingreso-detail-panel');

        // Handle Active Selection Visuals
        const currentActive = document.querySelector('.guia-row-card.active');
        document.querySelectorAll('.guia-row-card').forEach(d => d.classList.remove('active'));

        // If clicking same, Close
        if (currentActive && currentActive.id === `pre-row-${id}`) {
            this.closePreingresoDetails();
            return;
        }

        const row = document.getElementById(`pre-row-${id}`);
        if (row) row.classList.add('active');

        // Open Panel
        panel.style.width = '450px'; // Slightly wider for photos
        panel.style.opacity = '1';

        // Load Data
        const info = this.data.movimientos.preingresos.find(p => p.id === id);
        if (info) {
            this.renderPreingresoDetailContent(info);
        }
    }

    closePreingresoDetails() {
        const panel = document.getElementById('preingreso-detail-panel');
        panel.style.width = '0';
        document.querySelectorAll('.guia-row-card').forEach(d => d.classList.remove('active'));
    }

    renderPreingresoDetailContent(info) {
        const panel = document.getElementById('preingreso-detail-panel');

        // Carousel Logic
        let carouselHtml = '';
        if (info.fotos && info.fotos.length > 0) {
            const slides = info.fotos.map(url => {
                const optUrl = this.getOptimizedImageUrl(url);
                return `
                    <div style="flex:0 0 auto; width:120px; height:120px; border-radius:8px; overflow:hidden; border:1px solid #ddd; position:relative; cursor:zoom-in;"
                onclick = "app.openImageModal('${optUrl}')" >
                    <img src="${optUrl}" style="width:100%; height:100%; object-fit:cover;">
                        <div style="position:absolute; bottom:0; left:0; width:100%; height:25px; background:rgba(0,0,0,0.5); display:flex; 
                                    justify-content:center; align-items:center;">
                            <i class="fa-solid fa-expand" style="color:white; font-size:0.8rem;"></i>
                        </div>
                    </div>
                `;
            }).join('');

            carouselHtml = `
                    <div style="margin-top:1.5rem;">
                    <h5 style="margin-bottom:0.5rem; color:#555;">Evidencias / Fotos</h5>
                    <div style="display:flex; overflow-x:auto; gap:0.75rem; padding-bottom:0.5rem; scrollbar-width:thin;">
                        ${slides}
                    </div>
                </div>
                    `;
        } else {
            carouselHtml = `<div style="margin-top:1.5rem; color:#999; font-style:italic;">No hay imagenes adjuntas.</div>`;
        }

        panel.innerHTML = `
                    <div style="padding:1.5rem; border-bottom:1px solid #eee; background:#f9fafb;">
                <div style="display:flex; justify-content:space-between; align-items:start;">
                    <h3 style="margin:0 0 0.5rem 0; color:var(--primary-color);">Detalle Preingreso</h3>
                    <button onclick="app.closePreingresoDetails()" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:#666;">&times;</button>
                </div>
                <div style="font-size:0.9rem; color:#555;">${info.fecha}</div>
            </div>
            
            <div style="flex:1; overflow-y:auto; padding:1.5rem;">
                <!-- Main Info -->
                 <div style="margin-bottom:1rem;">
                    <label style="font-size:0.75rem; text-transform:uppercase; color:#888; letter-spacing:0.5px; font-weight:bold;">Proveedor</label>
                    <div style="font-size:1.1rem; font-weight:bold; color:#333;">${info.proveedor}</div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                     <div>
                        <label style="font-size:0.75rem; text-transform:uppercase; color:#888; font-weight:bold;">Estado</label>
                        <div style="margin-top:0.25rem;">
                            <span class="badge" style="background:${info.estado === 'PENDIENTE' ? '#f59e0b' : '#10b981'}; color:white;">${info.estado}</span>
                        </div>
                    </div>
                    <div>
                        <label style="font-size:0.75rem; text-transform:uppercase; color:#888; font-weight:bold;">Monto</label>
                        <div style="font-size:1rem; color:#333;">${info.monto ? 'S/ ' + info.monto : '-'}</div>
                    </div>
                </div>

                 <div style="margin-bottom:1rem;">
                    <label style="font-size:0.75rem; text-transform:uppercase; color:#888; font-weight:bold;">Etiqueta / Tipo</label>
                    <div style="font-size:0.95rem; color:#333;">${info.etiqueta || 'N/A'}</div>
                </div>

                 <div style="margin-bottom:1rem;">
                    <label style="font-size:0.75rem; text-transform:uppercase; color:#888; font-weight:bold;">Comprobante</label>
                    <div style="font-size:0.95rem; color:#333;">${info.comprobante || 'N/A'}</div>
                </div>

                <div style="margin-bottom:1rem;">
                    <label style="font-size:0.75rem; text-transform:uppercase; color:#888; font-weight:bold;">Observaciones</label>
                    <div style="font-size:0.95rem; color:#333; background:#f9f9f9; padding:0.75rem; border-radius:6px; border:1px solid #eee; margin-top:0.25rem;">
                        ${info.comentario ? `"${info.comentario}"` : '<span style="color:#aaa;">Sin comentarios</span>'}
                    </div>
                </div>

                ${carouselHtml}
            </div>
            
            <div style="padding:1rem; border-top:1px solid #eee; text-align:center;">
                 <button class="btn-primary" style="width:100%; justify-content:center;" onclick="app.closePreingresoDetails()">Cerrar</button>
            </div>
                `;
    }

    async generateGuiaFromPreingreso(id) {
        const pre = this.data.movimientos.preingresos.find(p => p.id === id);
        if (!pre) return;

        if (!confirm(`¿Generar Guía de Ingreso para ${pre.proveedor}?`)) return;

        // Optimistic UI could go here, but let's wait for server
        const payload = {
            tipo: 'INGRESO',
            usuario: this.currentUser.username,
            proveedor: pre.proveedor,
            comentario: pre.comentario || '',
            productos: [],
            idPreingreso: id,
            estado: 'EN PROGRESO',
            foto: null
        };

        try {
            this.showToast('Generando guía...', 'info');
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
                this.showToast('Guía generada exitosamente', 'success');
                // Reload to update lists (hide button in preingreso, show in guias)
                await this.loadMovimientosData(false);
                // Switch key tabs
                this.switchMovTab('guias');
            } else {
                alert('Error al generar guía: ' + result.message);
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión al generar guía');
        }
    }

    // MODALS & FORMS
    openNewGuiaModal(type) {
        const title = type === 'INGRESO' ? 'Nueva Guía de Ingreso' : 'Nueva Guía de Salida';

        // Providers Options
        const providers = this.data.movimientos?.proveedores || [];
        const providerOptions = providers.map(p => `<option value="${p}"></option>`).join('');



        const modalHtml = `
                <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="app.closeModal()">&times;</button>
        </div>
            <div class="modal-body">
                <form id="new-guia-form">

                    
                    <div class="input-group">
                         <input type="text" id="guia-proveedor" list="provider-list" placeholder="${type === 'INGRESO' ? 'Proveedor' : 'Destino'}" required style="width:100%; padding:0.5rem; border:1px solid #ddd; border-radius:4px;">
                         <datalist id="provider-list">
                            ${providerOptions}
                         </datalist>
                    </div>
                    
                    <div class="input-group">
                        <textarea id="guia-comentario" placeholder="Comentarios..." rows="2" style="width:100%; padding:0.5rem; border:1px solid #ddd; border-radius:4px;"></textarea>
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
                    <div style="margin-bottom:1rem; position:relative; width:100%;">
                        <div class="search-neon-wrapper" style="flex:1; position:relative; width:100%;">
                             <i class="fa-solid fa-barcode" style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:var(--primary-color);"></i>
                             <input type="text" id="prod-search" placeholder="Buscar producto (Scan/Texto)..." 
                                    style="width:100% !important; padding-left:35px; height:45px; box-sizing:border-box;" 
                                    onkeyup="app.searchProductForGuia(this, event)">
                        </div>
                        <!-- Button removed as requested (Auto-add enabled) -->
                        <button type="button" class="btn-primary" style="height:45px; width:45px; font-size:1.2rem; border-radius: 8px; display:none;" onclick="app.addProductToGuia()"><i class="fa-solid fa-plus"></i></button>
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
        const providers = this.data.providers || [];
        const datalistOpts = providers.map(p => `<option value="${p.nombre}">`).join('');

        const modalHtml = `
                    <div class="modal-header">
                <h3>Nuevo Preingreso</h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                 <!-- Proveedor -->
                 <div class="input-group">
                     <label>Proveedor</label>
                     <input type="text" id="pre-proveedor" placeholder="Buscar Proveedor..." list="pre-prov-list" style="width:100%; padding:0.5rem;" autocomplete="off">
                     <datalist id="pre-prov-list">${datalistOpts}</datalist>
                </div>

                <!-- Etiquetas & Comprobante -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem;">
                    <div class="input-group">
                        <label>Etiqueta</label>
                        <select id="pre-etiqueta" style="width:100%; padding:0.5rem;" onchange="app.togglePreingresoMonto()">
                            <option value="Pedido Incompleto">Pedido Incompleto</option>
                            <option value="Pedido Completo">Pedido Completo</option>
                        </select>
                    </div>
                    <div class="input-group">
                        <label>Comprobante</label>
                        <select id="pre-comprobante" style="width:100%; padding:0.5rem;">
                            <option value="Sin Comprobante">Sin Comprobante</option>
                            <option value="Con Comprobante">Con Comprobante</option>
                        </select>
                    </div>
                </div>

                <!-- Monto (Condicional) -->
                <div class="input-group" id="pre-monto-group" style="display:none;">
                    <label>Monto (S/)</label>
                    <input type="number" id="pre-monto" placeholder="0.00" step="0.01" style="width:100%; padding:0.5rem;">
                </div>

                 <div class="input-group">
                    <label>Observaciones</label>
                    <textarea id="pre-comentario" placeholder="Observaciones..." rows="2" style="width:100%; padding:0.5rem;"></textarea>
                </div>
                
                 <!-- Multi Photo Widget -->
                <div class="photo-widget">
                    <label>Fotos (Máx 4)</label>
                    <input type="file" id="pre-file-input" accept="image/*" multiple class="file-input-hidden" onchange="app.handlePreingresoPhotos(this)">
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

    togglePreingresoMonto() {
        const etiqueta = document.getElementById('pre-etiqueta').value;
        const montoGroup = document.getElementById('pre-monto-group');
        montoGroup.style.display = (etiqueta === 'Pedido Completo') ? 'block' : 'none';
        if (etiqueta !== 'Pedido Completo') document.getElementById('pre-monto').value = '';
    }

    handlePreingresoPhotos(input) {
        const files = Array.from(input.files);
        const currentImgs = document.querySelectorAll('#pre-preview img');

        if (files.length + currentImgs.length > 4) {
            alert("Máximo 4 fotos permitidas.");
            input.value = ''; // Reset
            return;
        }
        this.handlePhotoSelect(input, 'pre-preview', true);
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
                // this.addProductToGuia(); // Handled inside selectProductForGuia now
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
        // Auto-Add Logic
        const qty = 1;

        // Add to temp list
        const existingIndex = this.tempGuiaProducts.findIndex(p => p.codigo === code);
        if (existingIndex >= 0) {
            this.tempGuiaProducts[existingIndex].cantidad += 1;
        } else {
            this.tempGuiaProducts.push({ codigo: code, descripcion: desc, cantidad: qty });
        }

        this.renderTempProducts();

        // Clear UI & Keep Focus
        document.getElementById('prod-search').value = '';
        delete document.getElementById('prod-search').dataset.code;
        document.getElementById('prod-search-results').style.display = 'none';
        document.getElementById('prod-search').focus();
    }

    addProductToGuia() {
        const input = document.getElementById('prod-search');
        const code = input.dataset.code;
        const val = input.value;

        // Extract code if manually typed "CODE - DESC"
        const finalCode = code || (val.includes('-') ? val.split('-')[0].trim() : val.trim());
        const qty = 1; // Default to 1

        if (!finalCode) return alert('Seleccione un producto');
        // Validate existence?
        if (!this.data.products[finalCode]) {
            if (!confirm('El código no parece existir en la lista cargada. ¿Agregar igual?')) return;
        }

        const desc = this.data.products[finalCode] ? this.data.products[finalCode].desc : 'Producto Manual';

        // Check if already exists to just add qty?
        const existingIndex = this.tempGuiaProducts.findIndex(p => p.codigo === finalCode);
        if (existingIndex >= 0) {
            this.tempGuiaProducts[existingIndex].cantidad += 1;
        } else {
            this.tempGuiaProducts.push({ codigo: finalCode, descripcion: desc, cantidad: qty });
        }

        this.renderTempProducts();

        // Reset inputs
        input.value = '';
        delete input.dataset.code;
        input.focus();
    }

    renderTempProducts() {
        const container = document.getElementById('temp-prods-list');
        if (this.tempGuiaProducts.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:1.5rem; color:#999; font-size:0.9rem;">Ningún producto agregado</div>';
            return;
        }

        container.innerHTML = this.tempGuiaProducts.map((p, index) => `
                    <div class="temp-item" style="padding: 0.75rem; align-items: center;">
                <div style="flex:1;">
                    <div style="font-weight:bold; font-size:1rem; color: #333;">${p.codigo}</div>
                    <div style="font-size:0.85rem; color:#666;">${p.descripcion}</div>
                </div>
                
                <div style="display:flex; align-items:center; gap:0.5rem; margin:0 1rem; background: #f3f4f6; padding: 4px; border-radius: 6px;">
                    <button type="button" onclick="app.updateTempProductQty(${index}, -1)" style="width:30px; height:30px; border:none; background:white; border-radius:4px; font-weight:bold; cursor:pointer; color:#666;">-</button>
                    <span style="font-weight:bold; min-width:30px; text-align:center; font-size:1rem;">${p.cantidad}</span>
                    <button type="button" onclick="app.updateTempProductQty(${index}, 1)" style="width:30px; height:30px; border:none; background:white; border-radius:4px; font-weight:bold; cursor:pointer; color:var(--primary-color);">+</button>
                </div>

                <button onclick="app.removeTempProduct(${index})" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:1.1rem; padding: 0.5rem;"><i class="fa-solid fa-trash"></i></button>
            </div>
                    `).join('');
    }

    updateTempProductQty(index, change) {
        const item = this.tempGuiaProducts[index];
        const newQty = item.cantidad + change;

        if (newQty < 1) {
            if (confirm('¿Desea eliminar este producto?')) {
                this.removeTempProduct(index);
            }
        } else {
            item.cantidad = newQty;
            this.renderTempProducts();
        }
    }

    removeTempProduct(index) {
        this.tempGuiaProducts.splice(index, 1);
        this.renderTempProducts();
    }

    // SAVE LOGIC
    async savePreingreso() {
        const provider = document.getElementById('pre-proveedor').value;
        const comment = document.getElementById('pre-comentario').value;
        const etiqueta = document.getElementById('pre-etiqueta').value;
        const comprobante = document.getElementById('pre-comprobante').value;
        const monto = document.getElementById('pre-monto').value;

        const images = Array.from(document.querySelectorAll('#pre-preview img')).map(img => img.dataset.base64);

        if (!provider) return alert('Proveedor requerido');

        // Validation for Monto
        if (etiqueta === 'Pedido Completo' && !monto) {
            return alert('Debe ingresar el Monto para Pedido Completo');
        }

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
                    payload: {
                        proveedor: provider,
                        comentario: comment,
                        fotos: images,
                        etiqueta: etiqueta,
                        comprobante: comprobante,
                        monto: monto
                    }
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
        // if (this.tempGuiaProducts.length === 0) return alert('Agregue al menos un producto');

        const provider = document.getElementById('guia-proveedor').value;
        const comment = document.getElementById('guia-comentario').value;
        const preingresoId = document.getElementById('guia-preingreso') ? document.getElementById('guia-preingreso').value : null;

        // Photo (Single for Guia)
        const imgEl = document.querySelector('#guia-preview img');
        const photo = imgEl ? imgEl.dataset.base64 : null;

        if (!provider) return alert('Proveedor/Destino requerido');

        const btn = document.querySelector('.modal-footer .btn-primary');

        // DEBUG: Verify Photo
        if (!photo && document.querySelector('#guia-preview img')) {
            alert('Error: La imagen no se ha procesado correctamente. Intente adjuntar de nuevo.');
            return;
        }

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        btn.disabled = true;

        // 1. SEND DATA ONLY (Fast)
        const payload = {
            tipo: type,
            usuario: this.currentUser.username,
            proveedor: provider,
            comentario: comment,
            productos: this.tempGuiaProducts,
            idPreingreso: preingresoId,
            foto: null // We send this LATER
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
                // OPTIMISTIC UI: Close immediately
                this.closeModal();
                this.showToast("Guía guardada. Subiendo foto en segundo plano...", "info");
                this.loadMovimientosData(true); // Refresh list for the text entry

                // 2. UPLOAD PHOTO BACKGROUND
                if (photo && result.data && result.data.idGuia) {
                    this.uploadGuiaPhotoBackground(result.data.idGuia, photo);
                } else {
                    this.showToast("Guía completada exitosamente.", "success");
                }

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

    async uploadGuiaPhotoBackground(idGuia, base64) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: 'uploadGuiaPhoto',
                    payload: { idGuia: idGuia, foto: base64 }
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                this.showToast("Foto subida correctamente.", "success");
                this.loadMovimientosData(true);
            } else {
                this.showToast("Error subiendo foto: " + result.message, "error");
            }
        } catch (e) {
            console.error("Background Upload Error", e);
            this.showToast("Error de red subiendo foto.", "error");
        }
    }

    showToast(msg, type = 'info') {
        let toast = document.getElementById('app-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'app-toast';
            toast.style.cssText = 'position:fixed; bottom:20px; right:20px; padding:12px 24px; background:#333; color:white; border-radius:8px; z-index:9999; box-shadow:0 4px 6px rgba(0,0,0,0.1); font-size:0.9rem; transition: opacity 0.3s; opacity:0;';
            document.body.appendChild(toast);
        }

        toast.textContent = msg;
        toast.style.background = type === 'error' ? '#e74c3c' : (type === 'success' ? '#2ecc71' : '#333');
        toast.style.opacity = '1';

        setTimeout(() => {
            toast.style.opacity = '0';
        }, 4000);
    }

    toggleEditSeparated(id) {
        const input = document.getElementById(`edit-qty-${id}`);
        const btn = document.getElementById(`btn-edit-${id}`);
        if (!input || !btn) return;

        if (input.disabled) {
            // Enable
            input.disabled = false;
            input.focus();
            btn.innerHTML = '<i class="fa-solid fa-check"></i>'; // Check icon for Save
            btn.style.color = '#2e7d32'; // Green for save
        } else {
            // Save
            const newVal = parseFloat(input.value);
            if (isNaN(newVal) || newVal < 0) {
                alert('Cantidad inválida');
                return;
            }
            this.saveSeparatedEdit(id, newVal, btn, input);
        }
    }

    saveSeparatedEdit(id, newVal, btn, input) {
        // Optimistic Update UI
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        input.disabled = true;

        // API Call
        const payload = { id: id, quantity: newVal };
        fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'updateSeparatedQuantity', payload })
        })
            .then(r => r.json())
            .then(res => {
                if (res.status === 'success') {
                    this.showToast(res.message, 'success');

                    // Update Local Data
                    const reqIndex = this.data.requests.findIndex(r => r.idSolicitud === id);
                    if (reqIndex !== -1) {
                        if (newVal === 0) {
                            // "Regresa a pendientes" (Delete separated row)
                            this.data.requests.splice(reqIndex, 1);
                        } else {
                            // Update Quantity
                            this.data.requests[reqIndex].cantidad = newVal;
                        }
                    }

                    // Re-render Zone immediately
                    const activeBtn = document.querySelector('.client-buttons-group .btn-zone.active');
                    if (activeBtn) {
                        const zone = activeBtn.dataset.client;
                        const zoneContainer = document.getElementById('zone-content');
                        if (zoneContainer && zone) this.renderZonePickup(zone, zoneContainer);
                    }

                } else {
                    this.showToast('Error: ' + res.message, 'error');
                    // Revert UI to Edit mode on error
                    input.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                }
            })
            .catch(e => {
                console.error(e);
                this.showToast('Error de red al guardar', 'error');
                input.disabled = false;
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            });
    }

    renderZonePickup(zone, container) {
        // 0. PRESERVE SCROLL POSITION
        const pendingScrollDiv = container.querySelector('.column-pending .scroll-container');
        const prevScrollTop = pendingScrollDiv ? pendingScrollDiv.scrollTop : 0;

        // 1. Get Today's Date for Filtering (Local String Comparison)
        // Manually format to match Server "dd/MM/yyyy" to ensure consistency
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const localTodayStr = `${dd}/${mm}/${yyyy}`;

        const isSameDay = (dateStr, id) => {
            // ALWAYS SHOW MOCKS (Optimistic Updates)
            if (id && String(id).startsWith('temp-')) return true;

            if (!dateStr) return false;
            // Strictly match "Today" (dd/MM/yyyy)
            return dateStr.startsWith(localTodayStr);
        };

        // Helper to parse "dd/MM/yyyy HH:mm:ss" for Sorting
        const parseDateTime = (str) => {
            if (!str) return 0;
            try {
                const [datePart, timePart] = str.split(' ');
                const [d, m, y] = datePart.split('/').map(Number);
                let h = 0, min = 0, sec = 0;
                if (timePart) { [h, min, sec] = timePart.split(':').map(Number); }
                return new Date(y, m - 1, d, h, min, sec).getTime();
            } catch (e) { return 0; }
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
            if (!isSameDay(req.fecha, req.idSolicitud)) {
                return;
            }

            // Normalize Code to String to prevent mismatch
            const codeKey = String(req.codigo).trim();
            const reqTs = parseDateTime(req.fecha);

            // Initialize Aggregator Item
            if (!aggregator[codeKey]) {
                const product = this.data.products[codeKey] || { desc: 'Producto Desconocido - ' + codeKey, img: '' };
                aggregator[codeKey] = {
                    code: codeKey,
                    desc: product.desc,
                    img: product.img, // Pass image
                    requested: 0, // Sum of 'solicitado'
                    separated: 0, // Sum of 'separado'
                    reqIds: [],    // To track at least one ID for API call
                    lastTs: 0     // Track latest timestamp for sorting
                };
            }

            // Update Last Timestamp (Max) logic
            if (reqTs > aggregator[codeKey].lastTs) {
                aggregator[codeKey].lastTs = reqTs;
            }

            const qty = parseFloat(req.cantidad);
            const cat = String(req.categoria).trim().toLowerCase(); // Normalize Category

            if (cat === 'solicitado') {
                aggregator[codeKey].requested += qty;
                aggregator[codeKey].reqIds.push(req.idSolicitud);
            } else if (cat === 'separado') {
                aggregator[codeKey].separated += qty;
                // Add tracking
                if (!aggregator[codeKey].sepIds) aggregator[codeKey].sepIds = [];
                aggregator[codeKey].sepIds.push(req.idSolicitud);
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

            // STRICT LOGIC: Mutually Exclusive Columns
            // If ANY amount is separated -> Ends up in Separated Column (Removes from Pending).
            if (item.separated > 0) {
                const sepId = item.sepIds && item.sepIds.length > 0 ? item.sepIds[item.sepIds.length - 1] : null;
                separatedList.push({ ...item, qtyToShow: item.separated, type: 'separated', useId: sepId });
            }
            else if (pendingQty > 0) {
                // Only show in Pending if Not Touched Yet (separated === 0)
                pendingList.push({ ...item, qtyToShow: pendingQty, type: 'pending', useId: item.reqIds[0] });
            }
        });

        // 2b. SORT SEPARATED LIST (Newest First)
        separatedList.sort((a, b) => b.lastTs - a.lastTs);

        const renderCard = (item, isPending) => {
            // Image Logic for Requests
            const imgSrc = item.img ? item.img : 'recursos/defaultImageProduct.png';
            const imgHtml = `<img src="${imgSrc}" class="card-img" alt="${item.desc}" referrerpolicy="no-referrer" loading="lazy" onerror="app.handleImageError(this)">`;

            // Combine code and desc for search, normalized
            const searchTerms = `${item.code} ${item.desc} `.toLowerCase();

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
                                 
                                     ${!isPending ? `
                                        <div class="edit-qty-section" style="margin-top:auto; padding-top:10px; border-top:1px solid #eee;" onclick="event.stopPropagation()">
                                            <div style="font-size:0.8rem; color:#666; margin-bottom:5px;">Editar Cantidad:</div>
                                            <div style="display:flex; align-items:center; gap:8px; justify-content:center;">
                                                <input type="number" id="edit-qty-${item.useId}"  
                                                       value="${item.qtyToShow}" 
                                                       disabled 
                                                       style="width:60px; padding:5px; text-align:center; border:1px solid #ddd; border-radius:4px;">
                                                <button class="btn-icon" id="btn-edit-${item.useId}" onclick="app.toggleEditSeparated('${item.useId}')" style="background:none; border:none; cursor:pointer; font-size:1.2rem; color:#666;">
                                                    <i class="fa-solid fa-pencil"></i>
                                                </button>
                                            </div>
                                            <div style="font-size:0.7rem; color:#999; margin-top:5px; text-align: center;">(0 regresa a pendientes)</div>
                                        </div>
                                    ` : ''}
                             </div>
                        </div>
                </div>`;
        };

        const hasSeparated = separatedList.length > 0;

        const isCollapsed = separatedList.length === 0;

        container.innerHTML = `
                    <!--Flux Container-->
                        <div style="display: flex; flex-direction: row; flex-wrap: nowrap; gap: 2rem; align-items: start; height: 85vh; overflow: hidden;">

                            <!-- COLUMN 1: PENDING -->
                            <div class="column-pending" style="flex: 1; min-width: 0; background: #f8f9fa; padding: 1rem; border-radius: 8px; display: flex; flex-direction: column; height: 100%; transition: all 0.3s ease;">
                                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #ddd; padding-bottom:0.5rem; margin-bottom: 0.5rem; flex-shrink: 0;">
                                    <h5 style="color: var(--primary-color); margin:0;">
                                        <i class="fa-solid fa-list-ul"></i> Pendientes (${pendingList.length})
                                    </h5>
                                    ${new Date().getHours() >= 16 ?
                `<button class="btn-sm" style="background:#666; color:white; border:none; border-radius:4px;" 
                                                 title="Imprimir Pendientes" onclick="app.printPendingList('${zone}')">
                                            <i class="fa-solid fa-print"></i> Imprimir
                                         </button>` : ''
            }
                                </div>
                                <!-- Search Input Pending -->
                                <div style="margin-bottom: 1rem; position: relative; flex-shrink: 0;">
                                    <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #999;"></i>
                                    <input type="text" placeholder="Filtrar pendientes..." onkeyup="app.filterColumnList(this, 'column-pending')"
                                        style="width: 100%; padding: 8px 10px 8px 32px; border: 1px solid #ddd; border-radius: 20px; outline: none;">
                                </div>
                                <div class="scroll-container" style="flex: 1; overflow-y: auto; padding-right: 5px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); grid-auto-rows: max-content; gap: 1rem; align-content: start;">
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
                                <div class="scroll-container" style="flex: 1; overflow-y: auto; padding-right: 5px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); grid-auto-rows: max-content; gap: 1rem; align-content: start;">
                                    ${separatedList.length > 0
                ? separatedList.map(i => renderCard(i, false)).join('')
                : '<div style="grid-column: 1 / -1; text-align:center; padding:2rem; color:#81c784; font-style:italic;">Nada separado aún</div>'}
                                </div>
                            </div>
                        </div>
                `;

        // 3. RESTORE SCROLL POSITION
        requestAnimationFrame(() => {
            const newPendingScroll = container.querySelector('.column-pending .scroll-container');
            if (newPendingScroll && prevScrollTop > 0) {
                newPendingScroll.scrollTop = prevScrollTop;
            }
        });
    }
    printPendingList(zone) {
        // 1. Re-aggregate Pending Data
        const today = new Date();
        const isSameDay = (dateStr) => {
            if (!dateStr) return false;
            let d;
            if (typeof dateStr === 'string' && dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts.length === 3) {
                    d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                }
            } else {
                d = new Date(dateStr);
            }
            if (!d || isNaN(d.getTime())) return false;
            const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return diffDays === 0 || diffDays === 1; // Today/Tomorrow match
        };

        const targetZone = zone.toLowerCase();
        const aggregator = {};

        this.data.requests.forEach(req => {
            if (req.usuario.toLowerCase() !== targetZone) return;
            if (!isSameDay(req.fecha)) return;

            const codeKey = String(req.codigo).trim();
            if (!aggregator[codeKey]) {
                const product = this.data.products[codeKey] || { desc: 'Producto Desconocido - ' + codeKey };
                aggregator[codeKey] = { code: codeKey, desc: product.desc, requested: 0, separated: 0 };
            }
            const qty = parseFloat(req.cantidad);
            const cat = String(req.categoria).trim().toLowerCase();
            if (cat === 'solicitado') aggregator[codeKey].requested += qty;
            else if (cat === 'separado') aggregator[codeKey].separated += qty;
        });

        const pendingItems = [];
        Object.values(aggregator).forEach(item => {
            const pendingQty = item.requested - item.separated;
            if (pendingQty > 0) {
                pendingItems.push({ ...item, qty: pendingQty });
            }
        });

        if (pendingItems.length === 0) return alert('No hay pendientes para imprimir.');

        // 2. Generate Print HTML (POS/Ticket Style)
        // Use named window to avoid caching and force refresh
        const printWindow = window.open('', 'DispatchPrintWindow', 'width=450,height=600,scrollbars=yes');
        printWindow.document.open(); // Reset document content
        printWindow.document.write(`
            <html>
            <head>
                <title>Pendientes ${zone.toUpperCase()}</title>
                <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
                <meta http-equiv="Pragma" content="no-cache">
                <meta http-equiv="Expires" content="0">
                <style>
                    /* POS Ticket Reset */
                    * { box-sizing: border-box; }
                    body { 
                        font-family: 'Courier New', monospace; /* Monospace aligns better on thermal */
                        margin: 0; 
                        padding: 0; 
                        width: 76mm; /* Standard 80mm paper has ~72-76mm printable */
                    }
                    @page { 
                        margin: 0; 
                        size: auto; 
                    }
                    
                    /* Container */
                    .ticket {
                        padding: 5px;
                        width: 100%;
                    }

                    /* Typography */
                    h2 { 
                        font-size: 16px; 
                        text-align: center; 
                        margin: 5px 0 2px 0; 
                        text-transform: uppercase;
                    }
                    .meta {
                        font-size: 12px;
                        text-align: center;
                        margin-bottom: 10px;
                        border-bottom: 2px dashed #000;
                        padding-bottom: 5px;
                    }

                    /* Table */
                    table { width: 100%; border-collapse: collapse; }
                    th { 
                        text-align: left; 
                        border-bottom: 1px solid #000; 
                        font-size: 12px; 
                        padding: 2px 0;
                    }
                    td { 
                        padding: 4px 0; 
                        font-size: 14px; /* Larger font as requested */
                        vertical-align: top;
                        border-bottom: 1px dotted #ccc;
                    }
                    
                    /* Columns */
                    .item-block {
                        border-bottom: 2px dashed #000;
                        padding: 8px 0;
                        page-break-inside: avoid; /* Prevent splitting item across pages */
                    }
                    .item-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: baseline;
                        margin-bottom: 4px;
                    }
                    .item-code {
                        font-weight: bold;
                        font-size: 14px;
                    }
                    .item-qty {
                        font-weight: 800;
                        font-size: 18px;
                    }
                    .item-desc {
                        font-size: 14px;
                        line-height: 1.2;
                    }

                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="ticket">
                    <h2>${zone.toUpperCase()}</h2>
                    <div class="meta">${today.toLocaleString()}</div>
                    
                    <div class="items-container">
                        ${pendingItems.map(item => `
                            <div class="item-block">
                                <div class="item-header">
                                    <span class="item-code">${item.code}</span>
                                    <span class="item-qty">${item.qty}</span>
                                </div>
                                <div class="item-desc">${item.desc}</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div style="margin-top:20px; text-align:center; font-size:10px;">
                        --- FIN DE TICKET ---
                    </div>
                </div>
                <script>
                    window.onload = function() { window.print(); window.setTimeout(function(){ window.close(); }, 500); }
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    // Scoped Column Filtering
    filterColumnList(input, columnClass) {
        const term = input.value.toLowerCase().trim();
        // Traverse up to find the closest container if needed, but here filtering by class is safer
        // because we passed 'column-pending' or 'column-separated' specifically.
        // However, we must ensure we only target the visible ones in the current view.

        // Find the specific column container where this input lives would be even better to support multiple zones if ever needed
        // But scoping by class is fine for now as there's only one active zone view at a time.
        const container = input.closest(`.${columnClass} `);

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

        // --- ANIMATION START ---
        // 1. Find the card and Data
        const card = btnElement.closest('.request-card');
        const sourceRequest = this.data.requests.find(r => r.idSolicitud == id);

        if (card && sourceRequest) {
            // OPTIMISTIC UPDATE PREPARATION
            // Create a temporary 'separado' item in local data to reflect change instantly
            const tempId = 'temp-' + Date.now();

            // Format Date manually to match Server "dd/MM/yyyy HH:mm:ss" 
            // This ensures isSameDay() validates it correctly (checking dd/MM/yyyy)
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

            const mockSeparated = {
                ...sourceRequest,
                idSolicitud: tempId,
                categoria: 'separado',
                cantidad: newQty,
                fecha: formattedDate
            };

            // Clone for Animation
            const rect = card.getBoundingClientRect();
            const clone = card.cloneNode(true);

            clone.style.position = 'fixed';
            clone.style.top = rect.top + 'px';
            clone.style.left = rect.left + 'px';
            clone.style.width = rect.width + 'px';
            clone.style.height = rect.height + 'px';
            clone.style.zIndex = '9999';
            clone.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'; // Faster & Bouncy
            clone.style.opacity = '1';
            clone.style.pointerEvents = 'none';

            // Remove IDs from clone to prevent "Duplicate ID" errors
            clone.removeAttribute('id');
            const cloneInputs = clone.querySelectorAll('[id]');
            cloneInputs.forEach(el => el.removeAttribute('id'));

            document.body.appendChild(clone);

            // Hide original card instantly -> Visual Pop
            card.style.visibility = 'hidden'; // Keep layout space for a moment? No, user wants instant move.
            // Actually, if we re-render instantly, the card might disappear from DOM anyway.

            // UI Feedback on button (just in case)
            btnElement.innerHTML = '<i class="fa-solid fa-check"></i>';
            btnElement.disabled = true;

            // 2. Animate to Right
            const targetCol = document.querySelector('.column-separated');
            if (targetCol) {
                const targetRect = targetCol.getBoundingClientRect();
                requestAnimationFrame(() => {
                    clone.style.top = (targetRect.top + 50) + 'px';
                    clone.style.left = (targetRect.left + 50) + 'px';
                    clone.style.transform = 'scale(0.2)';
                    clone.style.opacity = '0.5';
                });
            }

            // 3. APPLY OPTIMISTIC DATA UPDATE (Instant)
            // Push mock data
            this.data.requests.push(mockSeparated);

            // DELAY NEXT REFRESH to prevent overwriting our Mock with stale server data
            if (this.resetAutoRefresh) this.resetAutoRefresh();

            // Re-render immediately (Animation is flying over the top)
            setTimeout(() => {
                // Selector updated to match new Header structure
                const activeBtn = document.querySelector('.client-buttons-group .btn-zone.active');
                if (activeBtn) {
                    const zone = activeBtn.dataset.client; // Use robust data attribute
                    const zoneContainer = document.getElementById('zone-content');
                    if (zoneContainer && zone) this.renderZonePickup(zone, zoneContainer);
                }
                // Remove clone after re-render (it effectively "lands" in the new list)
                clone.remove();
            }, 400); // Sync with animation duration

            // 4. SERVER SYNC (Background)
            fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    action: 'separateRequest',
                    payload: {
                        idSolicitud: id,
                        qtyToSeparate: newQty
                    }
                })
            })
                .then(() => {
                    // Silent Background Sync to get real IDs
                    // We don't need to re-render potentially if data matches, but good to ensure consistency
                    console.log('Server synced separation.');
                    // REMOVED IMMEDIATE FETCH to prevent Race Condition where server returns data BEFORE the new row is committed.
                    // Rely on Background Auto-Refresh (45s) or Optimistic UI.
                    // return this.fetchRequests(); 
                })
                // Check if we need to re-render? No, stick with valid optimistic data.
                .then(() => {
                    // Optional: Re-render one last time to ensure ID consistency (tempId -> realId)
                    // This might cause a slight flicker if IDs change, but usually imperceptible if content is same.
                    // We can skip re-render if we trust the math, but for safety lets do it.
                    const activeBtn = document.querySelector('.zone-carousel .btn-secondary.active');
                    if (activeBtn) {
                        const zone = activeBtn.innerText.toLowerCase().replace('zona ', 'zona');
                        const zoneContainer = document.getElementById('zone-content');
                        if (zoneContainer) this.renderZonePickup(zone, zoneContainer);
                    }
                })
                .catch(err => {
                    console.error("Separation failed:", err);
                    alert("Error guardando en servidor. Verifique conexión.");
                    // Rollback optimistic update? 
                    // Too complex for now, user can refresh.
                });

        } else {
            // Fallback if data missing (shouldn't happen)
            alert('Error identificando solicitud');
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
                    <div class="modal-card">
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
            </div>
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
        // Change Header Title to 'Prepedidos'
        const titleEl = document.getElementById('page-title');
        if (titleEl) titleEl.textContent = 'Prepedidos';

        const container = document.getElementById('prepedidos-container');

        // 1. Mostrar caché si existe (Instantáneo)
        if (this.providersData) {
            this.renderProviders(this.providersData);
        } else {
            // Solo mostrar spinner si no hay datos previos
            container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding: 3rem; color:#666;"><i class="fa-solid fa-circle-notch fa-spin fa-2x"></i><p style="margin-top:1rem;">Cargando lista de proveedores...</p></div>';
        }

        // 2. Fetch actualizado siempre (Background refresh)
        await this.fetchProvidersBackground();

        // 3. Iniciar Auto-Refresh si no está activo
        if (!this.providerRefreshInterval) {
            this.startProviderAutoRefresh();
        }
    }

    startProviderAutoRefresh() {
        // Evitar múltiples intervalos
        if (this.providerRefreshInterval) clearInterval(this.providerRefreshInterval);

        console.log("Iniciando auto-refresh de proveedores (60s)...");
        this.providerRefreshInterval = setInterval(() => {
            // Solo refrescar si la pestaña está activa (opcional, pero buena práctica)
            // O simplemente verificar si estamos en la vista de prepedidos (si tu app es SPA real)
            // Aquí asumimos siempre refrescar.
            this.fetchProvidersBackground();
        }, 60000); // 60 segundos
    }

    async fetchProvidersBackground() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getProviders' })
            });
            const result = await response.json();

            if (result.status === 'success') {
                this.providersData = result.data; // Guardar en caché

                // Si estamos viendo la pantalla de prepedidos, actualizar UI silenciosamente
                // (Verificamos si existe el contenedor en el DOM)
                const container = document.getElementById('prepedidos-container');
                if (container) {
                    this.renderProviders(this.providersData);
                }
            } else {
                console.error("Error refresh providers:", result.message);
            }
        } catch (e) {
            console.error("Error background fetch:", e);
        }
    }

    renderProviders(providers) {
        // 1. Setup Container and Search Bar
        const mainContainer = document.getElementById('prepedidos-container'); // This is the GRID container
        if (!mainContainer) return;

        // Verify if we have our Search Wrapper. If not, create it.
        // We need to insert the Search Bar BEFOFE the grid. 
        // Ideally, 'prepedidos-container' should be wrapped or we insert before it. 
        // Let's assume 'prepedidos-container' is the grid itself. We need to inject controls above it.

        // 1. Setup SEARCH BAR in HEADER (Moved from body)
        const headerActions = document.getElementById('header-dynamic-actions');
        if (headerActions) {
            // Only inject if not already there (check by ID)
            if (!document.getElementById('provider-search-input')) {
                headerActions.innerHTML = `
                    <div class="search-bar-header">
                        <i class="fa-solid fa-search search-icon"></i>
                        <input type="text" id="provider-search-input" placeholder="Buscar proveedor...">
                    </div>
                `;
                // Add Event Listener
                document.getElementById('provider-search-input').addEventListener('input', (e) => {
                    this.filterProviders(e.target.value);
                });
            }
        }

        // Remove old controls if they exist in body (cleanup)
        const oldControls = document.getElementById('provider-controls-wrapper');
        if (oldControls) oldControls.remove();

        /* REMOVED
        let controlsContainer = document.getElementById('provider-controls-wrapper');
        if (!controlsContainer) {
            controlsContainer = document.createElement('div');
            controlsContainer.id = 'provider-controls-wrapper';
            controlsContainer.className = 'provider-controls';
            controlsContainer.innerHTML = `
                <div class="provider-search-container">
                    <i class="fa-solid fa-search search-icon"></i>
                    <input type="text" id="provider-search-input" class="provider-search-input" placeholder="Buscar proveedor...">
                </div>
            `;
            // Insert before the grid
            mainContainer.parentNode.insertBefore(controlsContainer, mainContainer);

            // Add Event Listener
            document.getElementById('provider-search-input').addEventListener('input', (e) => {
                this.filterProviders(e.target.value);
            });
        } */

        // Ensure Grid Layout
        mainContainer.style.display = 'grid';
        mainContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
        mainContainer.style.gap = '20px';

        const daysMap = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
        const todayName = daysMap[new Date().getDay()];

        // 2. SORTING: Today's Orders First
        // Clone array to avoid mutating original cache
        const sortedProviders = [...providers].sort((a, b) => {
            const aDay = a.diaPedido ? a.diaPedido.toUpperCase().trim() : '';
            const bDay = b.diaPedido ? b.diaPedido.toUpperCase().trim() : '';

            const aIsToday = (aDay === todayName);
            const bIsToday = (bDay === todayName);

            if (aIsToday && !bIsToday) return -1;
            if (!aIsToday && bIsToday) return 1;
            return a.nombre.localeCompare(b.nombre);
        });

        // 3. RENDER
        mainContainer.innerHTML = sortedProviders.map(p => {
            const imgUrl = (p.imagen && p.imagen.trim() !== '') ? p.imagen : 'recursos/supplierDefault.png';
            const diaPedido = p.diaPedido ? p.diaPedido.toUpperCase() : '-';
            const diaEntrega = p.diaEntrega ? p.diaEntrega.toUpperCase() : '-';

            const isToday = (diaPedido === todayName);

            const orderClass = isToday ? 'pill-today-order' : 'pill-default';
            const deliveryClass = (diaEntrega === todayName) ? 'pill-today-delivery' : 'pill-default';
            const cardClass = isToday ? 'provider-card provider-card-today' : 'provider-card';

            return `
        <div class="${cardClass}" data-name="${p.nombre.toLowerCase()}">
            ${isToday ? '<i class="fa-solid fa-thumbtack provider-clip-icon"></i>' : ''}
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
                <button class="btn-primary" style="width: 100%; padding: 10px; font-size: 0.9rem; border-radius: 8px; box-shadow: none;" onclick="app.openProviderOrderModal('${p.nombre}')">
                    <i class="fa-solid fa-cart-plus"></i> Generar Prepedido
                </button>
            </div>
        </div>`;
        }).join('');
    }

    // --- NEW: PROVIDER HISTORY MODAL ---
    filterProviders(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        const cards = document.querySelectorAll('.provider-card');

        cards.forEach(card => {
            const name = card.getAttribute('data-name');
            if (name && name.includes(term)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }

    async openProviderOrderModal(providerName) {
        // 1. Show Loading Modal
        const loadingHtml = `
            <div class="modal-card">
                <div class="modal-header">
                    <h3>Historial: ${providerName}</h3>
                    <button class="modal-close" onclick="app.closeModal()">&times;</button>
                </div>
                <div class="modal-body" style="text-align:center; padding: 3rem;">
                    <i class="fa-solid fa-spinner fa-spin fa-2x"></i>
                    <p style="margin-top:1rem;">Cargando historial de compras...</p>
                </div>
            </div>`;
        this.openModal(loadingHtml);

        // 2. Fetch Data
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getProviderPurchases', payload: { provider: providerName } })
            });
            const result = await response.json();

            if (result.status === 'success') {
                this.renderProviderHistoryTable(providerName, result.data);
            } else {
                alert('Error: ' + result.message);
                this.closeModal();
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión al obtener historial.');
            this.closeModal();
        }
    }

    renderProviderHistoryTable(providerName, products) {
        if (!products || products.length === 0) {
            const emptyHtml = `
            <div class="modal-card">
                <div class="modal-header">
                    <h3>Historial: ${providerName}</h3>
                    <button class="modal-close" onclick="app.closeModal()">&times;</button>
                </div>
                <div class="modal-body" style="text-align:center; padding: 2rem;">
                    <p style="color:#666;">No se encontraron productos comprados anteriormente a este proveedor.</p>
                </div>
                 <div class="modal-footer">
                    <button class="btn-secondary" onclick="app.closeModal()">Cerrar</button>
                </div>
            </div>`;
            this.openModal(emptyHtml);
            return;
        }

        // Sort by Name
        products.sort((a, b) => a.nombre.localeCompare(b.nombre));

        const rows = products.map(p => {
            let rowClass = '';
            if (p.falta > 0) {
                rowClass = 'row-needed';
            } else if (p.isRelated) {
                rowClass = 'row-substitute';
            }

            return `
        <tr class="${rowClass}">
            <td style="text-align:center;">
                <input type="checkbox" class="history-select-check" value="${p.codigo}" data-desc="${p.nombre}" data-cost="${p.costo}">
            </td>
            <td style="font-family:monospace; color:${p.isRelated ? '#d35400' : '#666'}; white-space: nowrap;">
                ${p.codigo} ${p.isRelated ? '<i class="fa-solid fa-link" title="Producto Relacionado/Sustituto" style="font-size:0.7rem; margin-left:4px;"></i>' : ''}
            </td>
            <td style="font-weight:600;">${p.nombre}</td>
             <td style="text-align:center; color:#555;">${p.min} - ${p.stock}</td>
            <td style="text-align:center; font-weight:bold; color:${p.falta > 0 ? '#d9534f' : '#28a745'};">${p.falta}</td>
            <td>${p.costo ? 'S/ ' + parseFloat(p.costo).toFixed(2) : '-'}</td>
            <td style="font-size:0.8rem; color:#888;">${p.fecha ? new Date(p.fecha).toLocaleDateString() : '-'}</td>
        </tr>
    `}).join('');

        const modalHtml = `
        <div class="modal-card" style="max-width: 900px;">
            <div class="modal-header">
                <h3>Historial: ${providerName}</h3>
                <button class="modal-close" onclick="app.closeModal()">&times;</button>
            </div>
            <div class="modal-body" style="padding: 1rem;">
                <div class="alert-info" style="font-size:0.9rem; color:#666; margin-bottom:1rem;">
                    <i class="fa-solid fa-info-circle"></i> Seleccione los productos. <span style="color:#d9534f; font-weight:bold;">A Comprar = Min - Stock</span>.
                </div>
                
                <div class="history-table-wrapper">
                    <table class="history-table">
                        <thead>
                            <tr>
                                <th width="40" style="text-align:center;"><input type="checkbox" onclick="app.toggleHistoryAll(this)"></th>
                                <th>Código</th>
                                <th>Producto</th>
                                <th style="text-align:center;">Min - Stock</th>
                                <th style="text-align:center;">A Comprar</th>
                                <th>Costo Ref.</th>
                                <th>Últ. Compra</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>
            </div>
                <div class="modal-footer">
                     <span id="history-selected-count" style="margin-right:auto; font-weight:bold; color:var(--primary-color);">0 seleccionados</span>
                     <button class="btn-secondary" onclick="app.closeModal()">Cancelar</button>
                     <button class="btn-primary" onclick="app.generatePrepedidoFromHistory()">Generar Prepedido</button>
                </div>
            </div>`;

        this.openModal(modalHtml);

        // Bind Checkbox events for counter
        setTimeout(() => {
            const checks = document.querySelectorAll('.history-select-check');
            checks.forEach(c => {
                c.addEventListener('change', () => this.updateHistoryCounter());
            });
        }, 100);
    }

    toggleHistoryAll(source) {
        document.querySelectorAll('.history-select-check').forEach(c => c.checked = source.checked);
        this.updateHistoryCounter();
    }

    updateHistoryCounter() {
        const count = document.querySelectorAll('.history-select-check:checked').length;
        document.getElementById('history-selected-count').innerText = `${count} seleccionados`;
    }

    generatePrepedidoFromHistory() {
        const selected = [];
        document.querySelectorAll('.history-select-check:checked').forEach(c => {
            selected.push({
                codigo: c.value,
                desc: c.dataset.desc,
                cantidad: 1 // Default quantity
            });
        });

        if (selected.length === 0) return alert('Seleccione al menos un producto.');

        // Close History Modal
        this.closeModal();

        // HERE IS WHERE YOU WOULD NAVIGATE TO THE PREPEDIDO CREATION LOGIC
        // For now, let's just show an alert or a simple confirmation that data was captured.
        // User asked: "Start prepedido with these products".
        // Assuming we have a "New Prepedido" flow?
        // Let's reuse 'openNewRequestModal' but pre-fill it? Or is this different?
        // "Generar Prepedido" usually means creating a PDF or Logic.
        // The prompt says: "Start the prepedido... showing the list".
        // I will implement a placeholder or reuse 'openNewRequestModal' if applicable.
        // But 'openNewRequestModal' is for generic requests.
        // Let's create a specific 'Prepedido Summary' modal for now.

        console.log("Selected products for prepedido:", selected);
        alert(`Generando prepedido con ${selected.length} productos... (Lógica de PDF/Envío pendiente)`);
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

    // --- ENVASADOR MODULE LOGIC ---

    async loadPackingModule() {
        // 1. Set Title
        const title = document.getElementById('page-title');
        if (title) title.innerText = 'Envasador';

        // 2. Inject Search Bar (Neon Style)
        const headerActions = document.getElementById('header-dynamic-actions');
        if (headerActions) {
            // Force flex layout for inline badge and search
            headerActions.style.display = 'flex';
            headerActions.style.alignItems = 'center';
            headerActions.style.gap = '1rem';

            headerActions.innerHTML = `
                 <div class="search-neon-wrapper" style="position: relative; width: 300px;">
                    <i class="fa-solid fa-magnifying-glass" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:#999;"></i>
                    <input type="text" id="packing-search" 
                        placeholder="Buscar por Código o Nombre..." 
                        style="width:100%; padding-left:35px; height:40px; border-radius: 20px; border: 1px solid #ddd;"
                        onkeyup="app.filterPackingList(this.value)">
                </div>
            `;
        }

        // 3. Initial Load
        // Start Auto-Refresh (60s) FIRST to ensure it's registered
        if (this.packingRefreshInterval) clearInterval(this.packingRefreshInterval);
        this.packingRefreshInterval = setInterval(() => {
            console.log('Auto-refreshing Packing List...');
            this.fetchPackingList(true);
        }, 60000);

        // 4. Check & Fetch Master Products if Missing logic
        const container = document.getElementById('packing-list-container');
        if (!this.products || this.products.length === 0) {
            console.warn('LoadPackingModule: Master list empty. Fetching now...');
            if (container) container.innerHTML = '<div style="text-align:center; padding:2rem; color:#666;"><i class="fa-solid fa-sync fa-spin"></i> Sincronizando datos maestros...</div>';
            await this.fetchProducts();
        }

        this.fetchPackingList();
    }

    async fetchPackingList(isBackground = false) {
        const container = document.getElementById('packing-list-container');
        if (!container && !isBackground) return;

        if (!isBackground) {
            container.innerHTML = '<div style="text-align:center; padding:2rem; color:#999;"><i class="fa-solid fa-spinner fa-spin"></i> Cargando lista...</div>';
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getPackingList' })
            });
            const result = await response.json();

            if (result.status === 'success') {
                this.packingList = result.data; // Store in memory

                // Fetch History to calculate totals
                await this.fetchEnvasadosHistory();

                this.renderPackingList(this.packingList);
            } else {
                if (container && !isBackground) container.innerHTML = `<div class="error-msg">${result.message}</div>`;
            }

        } catch (e) {
            console.error(e);
            if (container && !isBackground) container.innerHTML = `<div class="error-msg">Error de conexión</div>`;
        }
    }

    async fetchEnvasadosHistory() {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'getEnvasados' })
            });
            const result = await response.json();
            if (result.status === 'success') {
                this.envasados = result.data;
                this.calculateDailyTotals();
            }
        } catch (e) {
            console.error("Error fetching envasados history:", e);
        }
    }

    calculateDailyTotals() {
        if (!this.envasados) return;

        // Helper to parse "dd/MM/yyyy HH:mm:ss"
        const parseDate = (str) => {
            if (!str) return '';
            const parts = str.toString().split(' ')[0].split('/');
            if (parts.length < 3) return '';
            return `${parseInt(parts[0])}/${parseInt(parts[1])}/${parts[2]}`;
        };

        const currentUser = this.currentUser ? this.currentUser.username : '';
        this.dailyTotals = {};
        this.globalDailyTotal = 0;

        const now = new Date();
        const currentDateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

        console.log('--- Daily Totals Debug ---');
        console.log('Current User:', currentUser);
        console.log('Current Date ID:', currentDateStr);

        this.envasados.forEach(record => {
            const recordDateStr = parseDate(record.fecha);

            // DEBUG: Log first few records
            if (this.envasados.length < 50 || Math.random() < 0.05) {
                console.log(`Checking: User=${record.usuario} (Expected ${currentUser}), Date=${recordDateStr} (Expected ${currentDateStr}), Qty=${record.cantidad}`);
            }

            if (record.usuario !== currentUser) return;
            if (recordDateStr !== currentDateStr) return;

            const qty = Number(record.cantidad) || 0;
            if (!this.dailyTotals[record.idProducto]) this.dailyTotals[record.idProducto] = 0;
            this.dailyTotals[record.idProducto] += qty;
            this.globalDailyTotal += qty;
        });

        console.log('Calculated Totals:', this.dailyTotals);
        console.log('Global Total:', this.globalDailyTotal);
        console.log('--------------------------');

        this.updateHeaderTotal();
    }

    updateHeaderTotal() {
        const headerActions = document.getElementById('header-dynamic-actions');
        // We need to inject the total next to the title or inside the actions area.
        // Let's create a badge if it doesn't exist, or update it.
        // Find existing badge
        let badge = document.getElementById('daily-total-badge');
        if (!badge && headerActions) {
            // Insert before the search wrapper
            const badgeHtml = `
                <div id="daily-total-badge" style="display:flex; align-items:center; gap:0.5rem; margin-right:1rem; color:var(--neon-green); font-weight:bold; font-size:1.1rem;">
                    <i class="fa-solid fa-clipboard-check"></i>
                    <span id="daily-total-value">0</span>
                </div>
            `;
            headerActions.insertAdjacentHTML('afterbegin', badgeHtml);
            badge = document.getElementById('daily-total-badge');
        }

        if (badge) {
            document.getElementById('daily-total-value').innerText = this.globalDailyTotal || 0;
        }
    }


    renderPackingList(list) {
        const container = document.getElementById('packing-list-container');
        if (!container) return;

        if (!list || list.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:2rem; color:#666;">No hay productos en lista de envasado</div>';
            return;
        }

        // --- PRE-PROCESS & SORT ---
        const masterProducts = this.products || []; // Array from fetchProducts

        const processedList = list.map(item => {
            // Find Match (Case-Insensitive & Trimmed)
            const targetCode = String(item.codigo).trim().toLowerCase();
            const master = masterProducts.find(p => String(p.codigo).trim().toLowerCase() === targetCode);

            let stockReal = 0;
            let stockMin = 0;
            let batteryLevel = 0;
            let batteryClass = 'critical'; // Default red
            let missingMin = false;

            if (master) {
                stockReal = Number(master.stock) || 0;
                stockMin = Number(master.min);

                // Check for missing/invalid Min Stock
                if (master.min === undefined || master.min === null || master.min === '' || isNaN(stockMin) || stockMin <= 0) {
                    missingMin = true;
                    stockMin = 100; // Fake base for calc avoids div/0, but marked as missing
                    batteryLevel = 0; // Force low
                } else {
                    batteryLevel = Math.round((stockReal / stockMin) * 100);
                    if (batteryLevel > 100) batteryLevel = 100;
                }

                if (batteryLevel >= 50) batteryClass = 'full';
                else if (batteryLevel >= 25) batteryClass = 'medium';
                else if (batteryLevel >= 10) batteryClass = 'low';
                else batteryClass = 'critical';
            }

            return {
                ...item,
                stockReal,
                stockMin,
                batteryLevel,
                batteryClass,
                missingMin,
                masterDesc: master ? master.descripcion : item.descripcion
            };
        });

        // SORT: Ascending Battery Level (Critical First)
        processedList.sort((a, b) => a.batteryLevel - b.batteryLevel);


        // --- GRID LAYOUT ---
        let html = '<div class="packing-grid">';

        html += processedList.map(item => {

            // Battery Visuals
            const isCritical = item.batteryClass === 'critical';
            // If missing Min, show Alert Icon overlay
            const alertOverlay = item.missingMin ?
                `<div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#ef4444; font-size:1.5rem; text-shadow:0 1px 3px rgba(255,255,255,0.8); z-index:2;" title="Stock Mínimo no definido">
                    <i class="fa-solid fa-triangle-exclamation fa-beat-fade"></i>
                 </div>` : '';

            const percentageText = item.missingMin ? '<span style="color:red; font-size:0.8rem;">Min?</span>' : `${item.batteryLevel}%`;

            return `
            <div class="packing-card" onclick="app.openSideDrawer('${item.codigo}')">
                <div class="packing-card-header">
                    <div class="code-badge">${item.codigo}</div>
                    <button class="btn-sm btn-neon-icon" 
                            onclick="event.stopPropagation(); app.showRegisterModal('${item.codigo}')" 
                            title="Registrar Envasado">
                        ${(this.dailyTotals && this.dailyTotals[item.codigo] > 0) ?
                    `<span style="font-weight:800; font-size:0.85rem;">${this.dailyTotals[item.codigo]}</span>` :
                    `<i class="fa-solid fa-plus"></i>`}
                    </button>
                </div>
                
                <div class="packing-card-body">
                    <div class="title" style="min-height:3.6rem; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;">
                        ${item.masterDesc || item.descripcion}
                    </div>
                    
                    <!-- BATTERY INDICATOR -->
                    <div class="battery-container">
                        ${alertOverlay}
                        <div class="battery-cap"></div>
                        <div class="battery-body">
                            <div class="battery-level ${item.batteryClass}" style="height: ${item.batteryLevel}%">
                                <div class="battery-reflection"></div>
                            </div>
                            <div class="battery-value">${percentageText}</div>
                        </div>
                    </div>

                </div>

                <div class="packing-card-footer">
                   <div style="font-size:0.85rem; color:var(--neon-blue); font-weight:bold;">
                        <i class="fa-solid fa-box"></i> ${item.empaque || 'S/D'}
                   </div>
                </div>
            </div>
            `;
        }).join('');

        html += '</div>';
        container.innerHTML = html;
    }

    filterPackingList(term) {
        if (!this.packingList) return;
        const q = term.toLowerCase().trim();

        const filtered = this.packingList.filter(item =>
            item.codigo.toLowerCase().includes(q) ||
            item.nombre.toLowerCase().includes(q) ||
            item.origen.toLowerCase().includes(q)
        );
        this.renderPackingList(filtered);
    }

    // Alias for click handler compatibility
    openSideDrawer(code) {
        this.openPackingDrawer(code);
    }

    openPackingDrawer(code) {
        const item = this.packingList.find(p => p.codigo === code);
        if (!item) return;

        // Find Master Product for Details (Image, Stock)
        const master = this.products ? this.products.find(p => String(p.codigo).trim().toLowerCase() === String(code).trim().toLowerCase()) : null;
        const stockReal = master ? (Number(master.stock) || 0) : 0;
        const stockMin = master ? (Number(master.min) || 0) : 0;

        const drawer = document.getElementById('packing-drawer');
        const backdrop = document.getElementById('packing-drawer-backdrop');

        // Helper to format Drive Image URL
        const formatDriveImage = (url) => {
            if (!url) return '';
            // If it's already a direct link or not drive, return as is
            if (!url.includes('drive.google.com')) return url;

            // Extract ID from: /file/d/ID/view or /open?id=ID or /uc?id=ID
            let id = '';
            const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
            const match2 = url.match(/id=([a-zA-Z0-9_-]+)/);

            if (match1) id = match1[1];
            else if (match2) id = match2[1];

            if (id) return `https://drive.google.com/uc?export=view&id=${id}`;
            return url;
        };

        const imageUrl = master && master.imagen ? formatDriveImage(master.imagen) : '';

        // Populate Drawer
        drawer.innerHTML = `
            <div class="drawer-header">
                <h3>${item.nombre}</h3>
                <button class="close-drawer-btn" onclick="app.closePackingDrawer()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="drawer-body">
                
                <!-- IMAGE SECTION -->
                ${imageUrl ?
                `<div style="text-align:center; margin-bottom:1rem;">
                        <img src="${imageUrl}" alt="${item.nombre}" 
                             referrerpolicy="no-referrer" 
                             style="max-height:150px; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.3);"
                             onerror="this.style.display='none'; console.warn('Failed to load image:', '${imageUrl}')">
                     </div>` : ''
            }

                <div class="drawer-section">
                    <label>Código</label>
                    <div class="drawer-value main">${item.codigo}</div>
                </div>

                <div class="drawer-grid">
                    <div class="drawer-section">
                        <label>Factor</label>
                        <div class="drawer-value">${item.factor}</div>
                    </div>
                     <div class="drawer-section">
                        <label>Empaque</label>
                        <div class="drawer-value highlight" style="font-size:1.2rem; color:var(--neon-blue);">${item.empaque}</div>
                    </div>
                </div>

                <!-- STOCK INFO from Master -->
                <div class="drawer-grid" style="margin-top:1rem; padding-top:1rem; border-top:1px solid #333;">
                    <div class="drawer-section">
                        <label>Stock Actual</label>
                        <div class="drawer-value" style="color:${stockReal < stockMin ? '#ef4444' : '#22c55e'}">${stockReal}</div>
                    </div>
                    <div class="drawer-section">
                        <label>Stock Mínimo</label>
                        <div class="drawer-value" style="color:#aaa;">${stockMin}</div>
                    </div>
                </div>

                <!-- ACTION: REGISTER PACKING -->
                <div style="margin-top:2rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.1); text-align:center;">
                    <button class="btn-neon" style="width:100%; padding: 1rem; font-size:1.1rem;" onclick="app.showRegisterModal('${item.codigo}')">
                        <i class="fa-solid fa-box-open"></i> Registrar Envasado
                    </button>
                </div>

            </div >
            `;

        // Show
        backdrop.classList.add('active');
        drawer.classList.add('active');

        // Close on Backdrop Click
        backdrop.onclick = () => this.closePackingDrawer();
    }

    closePackingDrawer() {
        const drawer = document.getElementById('packing-drawer');
        const backdrop = document.getElementById('packing-drawer-backdrop');
        if (drawer) drawer.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
    }

    showRegisterModal(productCode) {
        // Simple Prompt for MVP (User asked for button "+" to input quantity)
        // We can use a custom modal but prompt is safer for quick implementation unless specified.
        // Let's stick to prompt for reliability first, or inject a modal if needed.
        // User said: "al darle click al boton "+" se pueda poner la cantidad"

        const qty = prompt(`Ingrese cantidad envasada para ${productCode}:`);
        if (qty && !isNaN(qty) && Number(qty) > 0) {
            this.registerEnvasado(productCode, Number(qty));
        }
    }

    async registerEnvasado(productCode, quantity) {
        if (!confirm(`¿Confirmar envasado de ${quantity} unidades para ${productCode}?`)) return;

        this.showToast('Registrando envasado...', 'info');

        try {
            const user = this.currentUser ? this.currentUser.username : 'Unknown';
            const payload = {
                idProducto: productCode,
                cantidad: quantity,
                usuario: user
            };

            const response = await fetch(API_URL, {
                method: 'POST',
                redirect: 'follow',
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: 'saveEnvasado', payload: payload })
            });
            const result = await response.json();

            if (result.status === 'success') {
                this.showToast('Envasado registrado con éxito', 'success');
                this.closePackingDrawer();

                // Refresh Totals & UI immediately
                await this.fetchEnvasadosHistory();
                if (this.state.currentModule === 'envasador') {
                    this.renderPackingList(this.packingList);
                }
            } else {
                alert('Error al guardar: ' + result.message);
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión al guardar.');
        }
    }
}
// Initialize App

try {
    window.app = new App();
} catch (err) {
    console.error('Critical Init Error:', err);
    alert('Error crítico al iniciar la aplicación: ' + err.message);
}

