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

        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.checkSession();
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
     * MOCK LOGIN - To be replaced by Backend Call
     */
    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value; // In real app, hash this or send securely

        // Mock Validation for now
        // TODO: Replace with fetch(API_URL, { action: 'login', ... })
        setTimeout(() => {
            if (username.length > 3) {
                const mockUser = {
                    name: username.charAt(0).toUpperCase() + username.slice(1),
                    role: username === 'admin' ? 'Master' : 'Operador',
                    permissions: username === 'admin' ? ['dashboard', 'dispatch', 'movements', 'users'] : ['dashboard', 'dispatch']
                };

                this.setUser(mockUser);
            } else {
                alert('Usuario inválido (Mock: usa un nombre > 3 letras)');
            }
        }, 500);
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
        // Find the button that called this (dirty but quick way for now, or pass event)
        // For now just re-render is fine.

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
                        <button class="btn-primary" onclick="alert('Funcionalidad de Crear Solicitud Pendiente')">
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
                container.innerHTML = `<p style="color:red;">Error al cargar: ${result.message}</p>`;
            }
        } catch (error) {
            container.innerHTML = `<p style="color:red;">Error de conexión: ${error.message}</p>`;
        }
    }

    renderDispatchPickup(container) {
        container.innerHTML = `
            <h4>Pickup / Recolección</h4>
            <div style="margin-top: 1rem;">
                <div class="input-group">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <input type="text" placeholder="Buscar orden de pickup...">
                </div>
                <p style="color: #666; margin-top: 1rem;">Escanee o ingrese el código de despacho para iniciar pickup.</p>
            </div>
        `;
    }
}

// Initialize App
const app = new App();
