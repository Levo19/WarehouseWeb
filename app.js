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
        console.log("🚀 APP VERSION 17 - DYNAMIC SPLIT");
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

            return `
            <div class="product-card request-card" onclick="this.classList.toggle('flipped')">
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
                    <h5 style="color: var(--primary-color); border-bottom:1px solid #ddd; padding-bottom:0.5rem; flex-shrink: 0;">
                        <i class="fa-solid fa-list-ul"></i> Pendientes (${pendingList.length})
                    </h5>
                    <div style="flex: 1; overflow-y: auto; padding-right: 5px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); grid-auto-rows: max-content; gap: 1rem; align-content: start;">
                        ${pendingList.length > 0
                ? pendingList.map(i => renderCard(i, true)).join('')
                : '<div style="grid-column: 1 / -1; text-align:center; padding:2rem; color:#999;">Todo al día 🎉</div>'}
                    </div>
                </div>

                <!-- COLUMN 2: SEPARATED -->
                <div class="column-separated" style="${isCollapsed ? 'width: 320px; flex: 0 0 320px;' : 'flex: 1; min-width: 0;'} background: #e8f5e9; padding: 1rem; border-radius: 8px; display: flex; flex-direction: column; height: 100%; transition: all 0.3s ease;">
                    <h5 style="color: #2e7d32; border-bottom:1px solid #a5d6a7; padding-bottom:0.5rem; flex-shrink: 0;">
                        <i class="fa-solid fa-boxes-packing"></i> Separados (${separatedList.length})
                    </h5>
                     <div style="flex: 1; overflow-y: auto; padding-right: 5px; display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); grid-auto-rows: max-content; gap: 1rem; align-content: start;">
                        ${separatedList.length > 0
                ? separatedList.map(i => renderCard(i, false)).join('')
                : '<div style="grid-column: 1 / -1; text-align:center; padding:2rem; color:#81c784; font-style:italic;">Nada separado aún</div>'}
                    </div>
                </div>
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
}

// Initialize App

try {
    app = new App();
} catch (err) {
    console.error('Critical Init Error:', err);
    alert('Error crítico al iniciar la aplicación: ' + err.message);
}
