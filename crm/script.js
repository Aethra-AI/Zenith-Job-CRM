// script.js

// ======================================================
// --- AUTENTICACIÓN Y GESTIÓN DE SESIÓN ---
// ======================================================

// Obtener token y ruta actual
const token = localStorage.getItem('crm_token');
const currentPath = window.location.pathname;

// Determinar si estamos en la landing page o en el CRM
const isLandingPage = !currentPath.includes('/crm/') && 
                     (currentPath.endsWith('/') || 
                      currentPath.endsWith('index.html') ||
                      currentPath.endsWith('/Zenith-Job-CRM/') ||
                      currentPath.endsWith('/Zenith-Job-CRM/index.html'));

// Obtener la ruta base según el entorno
const isGHPages = window.location.hostname.includes('github.io');
const basePath = isGHPages ? '/Zenith-Job-CRM/' : '/';
const crmPath = isGHPages ? basePath + 'crm/' : '/crm/';

// Evitar redirecciones innecesarias
const shouldRedirectToLanding = !isLandingPage && !token;
const shouldRedirectToCRM = isLandingPage && token && !currentPath.startsWith(crmPath);

// Manejar redirecciones
if (shouldRedirectToLanding) {
    // Redirigir a la landing page si no hay token
    window.location.href = basePath + 'index.html';
} else if (shouldRedirectToCRM) {
    // Redirigir al dashboard después del inicio de sesión exitoso
    // Usar replace() en lugar de href para evitar problemas con el historial del navegador
    window.location.replace(crmPath);
}

// Función para realizar el inicio de sesión
async function login() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const errorMsg = document.getElementById('error-message');
    const loginBtn = document.getElementById('login-btn');
    
    // Usar la ruta base ya definida al inicio del archivo

    if (!email || !password) {
        showError('Por favor, ingresa el correo y la contraseña.');
        return;
    }

    try {
        // Deshabilitar el botón y mostrar estado de carga
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Ingresando...';
        }
        
        // Limpiar mensajes de error previos
        if (errorMsg) errorMsg.textContent = '';

        // Realizar la petición de login
        const response = await fetch(`/api/auth/login`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error en las credenciales');
        }

        // Guardar el token
        localStorage.setItem('crm_token', data.token);
        localStorage.setItem('crm_refresh_token', data.refreshToken);
        localStorage.setItem('crm_token_expiry', (Date.now() + (data.expiresIn * 1000)).toString());
        
        // Redirigir al dashboard con la ruta correcta
        const redirectPath = basePath.endsWith('/') 
            ? basePath + 'crm/'
            : basePath + '/crm/';
        window.location.href = redirectPath;

    } catch (error) {
        showError(error.message || 'Error al iniciar sesión. Intenta de nuevo.');
    } finally {
        // Restaurar el estado del botón
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Ingresar';
        }
    }
}

// Función para cerrar sesión
function logout() {
    // Obtener la ruta base según el entorno
    const basePath = window.location.hostname.includes('github.io') 
        ? '/Zenith-Job-CRM/'
        : '/';
        
    // Limpiar datos de sesión
    localStorage.removeItem('crm_token');
    localStorage.removeItem('crm_refresh_token');
    localStorage.removeItem('crm_token_expiry');
    
    // Redirigir a la landing page
    window.location.href = basePath === '/' ? '../index.html' : basePath;
}

// Función auxiliar para mostrar mensajes de error
function showError(message) {
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) {
        errorMsg.textContent = message;
    } else {
        console.error('Error:', message);
    }
}

// Configurar el event listener para el formulario de login
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            login();
        });
    }

    const token = localStorage.getItem('crm_token');
    const isLoginPage = window.location.pathname.endsWith('login.html') || 
                       window.location.pathname === '/';
    
    if (!token && !isLoginPage) {
        window.location.href = 'login.html';
        return;
    }
    
    if (token && isLoginPage) {
        window.location.href = 'index.html';
        return;
    }

    setupEventListeners();
    loadPanelContent('dashboard');
});

// ======================================================
// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
// ======================================================
const API_BASE_URL = 'https://34-136-149-39.sslip.io/api';  
const WS_BRIDGE_URL = 'wss://34-136-149-39.sslip.io/bridge-ws/'; // URL del puente de Node.js en tu PC
const NODE_API_URL = 'https://34-136-149-39.sslip.io/bridge-ws';


window.crmDataStore = {}; // Almacén de datos en memoria
window.pendingAlerts = []; // Un array para guardar las alertas que aún no se han mostrado
window.waSocket = null; // Conexión WebSocket al puente de WhatsApp
window.speechRecognition = null; // Objeto para el reconocimiento de voz
window.assistantHistory = []; // ✨ NUEVO: Almacén para el historial del asistente

function setupEventListeners() {
    // --------------------------------------------------
    // PARTE 1: NAVEGACIÓN PRINCIPAL POR PESTAÑAS (Lógica de no-recarga)
    // --------------------------------------------------
    document.addEventListener('click', (e) => {
        // Manejar clics en los botones de navegación
        const navBtn = e.target.closest('.nav-btn');
        if (navBtn && navBtn.dataset.tab) {
            e.preventDefault();
            e.stopPropagation();
            
            const tabId = navBtn.dataset.tab;
            console.log(`Navegando a pestaña: ${tabId}`);
            
            // Cargar el contenido del panel usando loadPanelContent
            loadPanelContent(tabId);
        }
        
        // Manejar clics en los elementos del menú desplegable
        const dropdownItem = e.target.closest('.dropdown-item');
        if (dropdownItem && dropdownItem.dataset.tab) {
            e.preventDefault();
            e.stopPropagation();
            
            const tabId = dropdownItem.dataset.tab;
            console.log(`Navegando a pestaña desde menú: ${tabId}`);
            
            // Cerrar el menú desplegable
            const dropdown = dropdownItem.closest('.dropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
            
            // Cargar el contenido del panel
            loadPanelContent(tabId);
        }
    });

    // --------------------------------------------------
    // PARTE 2: LISTENER PARA LA TECLA ESCAPE
    // --------------------------------------------------
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            const assistantWindow = document.getElementById('assistant-chat-window');
            if (assistantWindow && !assistantWindow.classList.contains('hidden')) {
                assistantWindow.classList.add('hidden');
            }
        }
    });

    // --------------------------------------------------
    // PARTE 3: LISTENER DELEGADO PARA CLICS EN TARJETAS DE CANDIDATOS
    // --------------------------------------------------
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('#candidates-results-container')) {
            const profileLink = target.closest('.profile-link');
            if (profileLink) {
                showCandidateProfile(profileLink.dataset.candidateId);
                return;
            }
            const postularBtn = target.closest('.postular-btn');
            if (postularBtn) {
                const { candidateId, candidateName } = postularBtn.dataset;
                openPostulacionModal(candidateId, candidateName);
                return;
            }
            const editObsBtn = target.closest('.edit-obs-btn');
            if (editObsBtn) {
                const { candidateId, candidateName, currentObs } = editObsBtn.dataset;
                editObservaciones(candidateId, candidateName, decodeURIComponent(currentObs));
                return;
            }
            const profileBtn = target.closest('.profile-btn');
            if (profileBtn) {
                showCandidateProfile(profileBtn.dataset.candidateId);
                return;
            }
        }
    });

    // --------------------------------------------------
    // PARTE 4: LÓGICA PARA EL WIDGET DEL ASISTENTE FLOTANTE
    // --------------------------------------------------
    const assistantWindow = document.getElementById('assistant-chat-window');
    const toggleBtn = document.getElementById('assistant-toggle-btn');
    const closeBtn = document.getElementById('close-assistant-btn');
    const sendBtn = document.getElementById('assistant-send-btn');
    const input = document.getElementById('assistant-input');

    if (assistantWindow && toggleBtn && closeBtn && sendBtn && input) {
        toggleBtn.addEventListener('click', () => assistantWindow.classList.toggle('hidden'));
        closeBtn.addEventListener('click', () => assistantWindow.classList.add('hidden'));
        sendBtn.addEventListener('click', () => sendAssistantCommand());
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendAssistantCommand();
            }
        });
        addMessageToChat('Hola, soy tu asistente. ¿En qué te ayudo?', 'assistant');
    }
    
    // --- CONEXIÓN AUTOMÁTICA DEL WEBSOCKET AL CARGAR LA PÁGINA ---
    setTimeout(() => {
        console.log("Iniciando conexión automática de WebSocket en segundo plano...");
        initializeWhatsAppChatLogic(false);
    }, 500);
}

// ======================================================
// --- COMUNICACIÓN CON LA API Y MANEJO DE ERRORES ---
// ======================================================

/**
 * Realiza una llamada a la API del backend con manejo automático de autenticación.
 * @param {string} endpoint - Ruta del endpoint (sin el prefijo API_BASE_URL)
 * @param {string} [method='GET'] - Método HTTP (GET, POST, PUT, DELETE, etc.)
 * @param {Object|FormData|null} [body=null] - Cuerpo de la petición (se serializa automáticamente si es un objeto)
 * @param {Object} [customHeaders={}] - Cabeceras personalizadas adicionales
 * @returns {Promise<Object>} - Respuesta de la API parseada como JSON
 * @throws {Error} Si la petición falla o la sesión expira
 */
// 1. Restore the original apiCall function
async function apiCall(endpoint, method = 'GET', body = null) {
    showLoader(true);
    const token = localStorage.getItem('crm_token');

    try {
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const options = {
            method: method.toUpperCase(),
            headers
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('crm_token');
                window.location.href = 'login.html';
                throw new Error('Sesión expirada');
            }
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Error del servidor');
        }

        return await response.json();
    } catch (error) {
        console.error(`API Error [${endpoint}]:`, error);
        throw error;
    } finally {
        showLoader(false);
    }
}

// 2. Simplify the login function

function showLoader(show) {
    document.getElementById('global-loader').classList.toggle('hidden', !show);
}

function handleError(error) {
    console.error('Error Detallado:', error);
    showToast('Ocurrió un error: ' + (error.message || 'Error desconocido.'), 'error');
}

// ======================================================
// --- LÓGICA DE CARGA DE PANELES ---
// ======================================================
async function loadPanelContent(panelId) {
    console.log(`Cargando panel: ${panelId}`);
    const panel = document.getElementById(panelId);
    if (!panel) {
        console.error(`Panel no encontrado: ${panelId}`);
        return;
    }

    // Ocultar todos los paneles primero
    document.querySelectorAll('.panel').forEach(p => {
        p.classList.remove('active');
    });
    
    // Desactivar todos los botones de navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Activar el botón correspondiente
    const activeBtn = document.querySelector(`.nav-btn[data-tab="${panelId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Mostrar indicador de carga
    const loadingHtml = `
        <div class="loading-overlay">
            <div class="spinner"></div>
            <p>Cargando ${panelId}...</p>
        </div>
    `;
    
    // Guardar el contenido actual para restaurarlo en caso de error
    const originalContent = panel.innerHTML;
    
    // Solo mostrar loading si el panel no ha sido cargado previamente
    if (panel.getAttribute('data-loaded') !== 'true') {
        panel.innerHTML = loadingHtml;
    } else {
        panel.classList.add('active');
    }

    try {
        // Llamar a la función de renderizado correspondiente
        switch(panelId) {
            case 'dashboard': 
                await renderDashboard(); 
                break;
            case 'buscar': 
                await renderCandidateSearch(); 
                break;
            case 'vacantes': 
                await renderVacanciesView(); 
                break;
            case 'postulaciones': 
                await renderPostulacionesView(); 
                break;
            case 'entrevistas': 
                await renderEntrevistasView(); 
                break;
            case 'contratados': 
                await renderContratadosView(); 
                break;
            case 'clientes': 
                await renderClientsView(); 
                break;
            case 'reportes': 
                await renderReportsView(); 
                break;
            case 'configuracion': 
                await renderSettingsView(); 
                break;
            case 'chatbot_settings': 
                await renderChatbotSettingsView(); 
                break;
            case 'whatsapp_chat': 
                await renderWhatsappChatView(); 
                break;
            case 'mensajes': 
                await renderMessagesView(); 
                break;
            case 'posts': 
                await renderPostsManagementView(); 
                break;
            default: 
                console.warn(`Panel no reconocido: ${panelId}`);
                throw new Error(`Panel no reconocido: ${panelId}`);
        }
        
        // Marcar el panel como cargado y mostrarlo
        panel.setAttribute('data-loaded', 'true');
        panel.classList.add('active');
        
    } catch (error) {
        console.error(`Error al cargar el panel ${panelId}:`, error);
        
        // Mostrar mensaje de error con opción de reintentar
        panel.innerHTML = `
            <div class="error-message">
                <h3>Error al cargar el contenido</h3>
                <p>${error.message || 'Ocurrió un error inesperado'}</p>
                <button onclick="loadPanelContent('${panelId}')" class="btn primary-btn">
                    <i class="fas fa-sync-alt"></i> Reintentar
                </button>
            </div>
        `;
        
        // Restaurar el contenido original después de un tiempo
        setTimeout(() => {
            if (panel.innerHTML.includes('error-message')) {
                panel.innerHTML = originalContent;
            }
        }, 5000);
    }
}

// ======================================================
// --- FUNCIONES DE GRÁFICOS ---
// ======================================================

/**
 * Renderiza un gráfico de pastel para mostrar la distribución de estados.
 * @param {Object} statusData - Datos de estado para el gráfico.
 */
function renderStatusPieChart(statusData) {
    const ctx = document.getElementById('statusPieChart');
    if (!ctx) return;
    
    // Verificar si ya existe un gráfico y destruirlo
    if (window.statusPieChart) {
        window.statusPieChart.destroy();
    }

    // Preparar datos para el gráfico
    const labels = Object.keys(statusData);
    const data = Object.values(statusData);
    const backgroundColors = [
        '#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', 
        '#858796', '#5a5c69', '#e83e8c', '#fd7e14', '#20c9a6'
    ];

    // Crear el gráfico
    window.statusPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors.slice(0, labels.length),
                hoverBackgroundColor: backgroundColors.slice(0, labels.length),
                hoverBorderColor: 'rgba(234, 236, 244, 1)',
            }],
        },
        options: {
            maintainAspectRatio: false,
            tooltips: {
                backgroundColor: 'rgb(255,255,255)',
                bodyFontColor: '#858796',
                borderColor: '#dddfeb',
                borderWidth: 1,
                xPadding: 15,
                yPadding: 15,
                displayColors: true,
                caretPadding: 10,
            },
            legend: {
                display: true,
                position: 'right',
            },
            cutoutPercentage: 70,
        },
    });
}

/**
 * Renderiza un gráfico de líneas para mostrar la actividad.
 * @param {Array} afiliadosData - Datos de afiliados.
 * @param {Array} postulacionesData - Datos de postulaciones.
 */
function renderActivityLineChart(afiliadosData, postulacionesData) {
    const ctx = document.getElementById('activityLineChart');
    if (!ctx) return;
    
    // Verificar si ya existe un gráfico y destruirlo
    if (window.activityLineChart) {
        window.activityLineChart.destroy();
    }

    // Obtener las fechas de los últimos 30 días
    const dates = [];
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
    }

    // Crear el gráfico
    window.activityLineChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [
                {
                    label: 'Nuevos Afiliados',
                    data: afiliadosData.map(item => item.total),
                    backgroundColor: 'rgba(78, 115, 223, 0.05)',
                    borderColor: 'rgba(78, 115, 223, 1)',
                    pointRadius: 3,
                    pointBackgroundColor: 'rgba(78, 115, 223, 1)',
                    pointBorderColor: 'rgba(78, 115, 223, 1)',
                    pointHoverRadius: 3,
                    pointHoverBackgroundColor: 'rgba(78, 115, 223, 1)',
                    pointHoverBorderColor: 'rgba(78, 115, 223, 1)',
                    pointHitRadius: 10,
                    pointBorderWidth: 2,
                    tension: 0.3,
                    fill: true,
                },
                {
                    label: 'Postulaciones',
                    data: postulacionesData.map(item => item.total),
                    backgroundColor: 'rgba(28, 200, 138, 0.05)',
                    borderColor: 'rgba(28, 200, 138, 1)',
                    pointRadius: 3,
                    pointBackgroundColor: 'rgba(28, 200, 138, 1)',
                    pointBorderColor: 'rgba(28, 200, 138, 1)',
                    pointHoverRadius: 3,
                    pointHoverBackgroundColor: 'rgba(28, 200, 138, 1)',
                    pointHoverBorderColor: 'rgba(28, 200, 138, 1)',
                    pointHitRadius: 10,
                    pointBorderWidth: 2,
                    tension: 0.3,
                    fill: true,
                }
            ],
        },
        options: {
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 10,
                    right: 25,
                    top: 25,
                    bottom: 0
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        maxTicksLimit: 7
                    }
                },
                y: {
                    ticks: {
                        maxTicksLimit: 5,
                        padding: 10,
                        callback: function(value) {
                            return value;
                        }
                    },
                    grid: {
                        color: 'rgb(234, 236, 244)',
                        borderDash: [2],
                        drawBorder: false,
                        zeroLineColor: 'rgb(234, 236, 244)',
                        zeroLineBorderDash: [2],
                        zeroLineBorderDashOffset: [2]
                    }
                }
            },
            legend: {
                display: true,
                position: 'top',
            },
            tooltips: {
                backgroundColor: 'rgb(255,255,255)',
                bodyFontColor: '#858796',
                titleMarginBottom: 10,
                titleFontColor: '#6e707e',
                titleFontSize: 14,
                borderColor: '#dddfeb',
                borderWidth: 1,
                xPadding: 15,
                yPadding: 15,
                displayColors: false,
                intersect: false,
                mode: 'index',
                caretPadding: 10,
            }
        }
    });
}

// ======================================================
// --- RENDERIZADO DE VISTAS PRINCIPALES ---
// ======================================================

// REEMPLAZA ESTA FUNCIÓN COMPLETA
/**
 * Navega a una pestaña específica y aplica filtros predefinidos.
 * @param {string} tabId - El ID de la pestaña de destino (ej: 'entrevistas').
 * @param {object} filters - Un objeto con los filtros a aplicar (ej: { registered_today: true }).
 */
function navigateToFilteredView(tabId, filters = {}) {
    // 1. Activar la pestaña correcta en la UI
    document.querySelectorAll('.tab-btn, .panel').forEach(el => el.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`).classList.add('active');
    const targetPanel = document.getElementById(tabId);
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    // 2. Cargar el contenido del panel (esto renderiza los inputs de los filtros)
    loadPanelContent(tabId);

    // 3. Esperar un momento a que los elementos del DOM del nuevo panel se creen
    setTimeout(() => {
        // 4. Lógica para aplicar los filtros
        if (tabId === 'buscar' && filters.registered_today) {
            // Para la búsqueda de afiliados de hoy, llamamos directamente a executeCandidateSearch con el filtro
            executeCandidateSearch({ registered_today: true });
        } else if (tabId === 'entrevistas') {
             // Simplemente llamamos a applyTableFilters que ya muestra todas las entrevistas por defecto.
             // Podríamos añadir filtros aquí si el dashboard los proveyera.
             applyTableFilters('entrevistas');
        } else {
            // Para cualquier otro caso como 'vacantes' o 'contratados', la vista por defecto ya es suficiente.
            // Si tuviéramos filtros para ellos, los aplicaríamos aquí antes de llamar a applyTableFilters.
        }
    }, 200); // 200ms es un delay seguro.
}


async function renderDashboard() {
    const panel = document.getElementById('dashboard');
    const date = new Date().toLocaleDateString('es-HN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    // --- ESTRUCTURA HTML MEJORADA ---
    // Hemos movido la tarjeta de "Solicitudes Pendientes" para que esté justo después de los KPIs,
    // ya que es una de las tarjetas de acción más importantes.
    panel.innerHTML = `
        <div class="panel-header">
            <h1>Dashboard</h1>
            <span style="color: var(--text-secondary);">${date}</span>
        </div>
        
        <!-- 1. KPIs Principales -->
        <div class="dashboard-grid" id="kpi-cards-container"><div class="spinner"></div></div>
        
        <!-- 2. Tarjeta de Alertas: Solicitudes de Postulación Pendientes -->
        <div class="dashboard-list-card" style="margin-top: 30px;">
            <h3><i class="fa-solid fa-bell" style="color: var(--warning);"></i> Solicitudes de Postulación Pendientes</h3>     
            <div id="application-requests-container">
                <div class="spinner"></div> <!-- Spinner de carga inicial -->
            </div>
        </div>

        <!-- 3. Gráficos de Actividad -->
        <div class="card-grid" style="grid-template-columns: 1fr 2fr; align-items: flex-start; margin-top: 30px;">
            <div class="dashboard-list-card">
                <h3><i class="fa-solid fa-pie-chart"></i> Estado Actual de Postulaciones</h3>
                <div style="position: relative; height: 300px; width: 100%;"><canvas id="status-pie-chart"></canvas></div>
            </div>
            <div class="dashboard-list-card">
                <h3><i class="fa-solid fa-chart-line"></i> Actividad en los Últimos 30 Días</h3>
                <div style="position: relative; height: 300px; width: 100%;"><canvas id="activity-line-chart"></canvas></div>
            </div>
        </div>

        <!-- 4. Monitor de Conversaciones (sin cambios) -->
        <div class="dashboard-list-card" style="margin-top: 30px;">
            <h3><i class="fa-solid fa-satellite-dish"></i> Monitor de Conversaciones en Vivo</h3>
            <div id="live-alert-panel">
                <p style="color: var(--text-secondary); padding: 10px;">Cargando notificaciones...</p>
            </div>
        </div>
    `;

    // --- LÓGICA DE CARGA DE DATOS ---
    try {
        // Ejecutamos las llamadas a la API para los KPIs y gráficos
        const [kpiData, activityData] = await Promise.all([
            apiCall('/reports/kpi'),
            apiCall('/dashboard/activity_chart') 
        ]);
        
        // Renderizamos los KPIs (sin cambios)
        const kpiContainer = document.getElementById('kpi-cards-container');
        if (kpiContainer) {
            kpiContainer.innerHTML = `
                <div class="stat-card">
                    <div class="icon" style="background:var(--primary);"><i class="fa-solid fa-business-time"></i></div>
                    <div class="value">${kpiData.kpis.avgTimeToFillDays}</div>
                    <div class="label">Días para Llenar Vacante</div>
                </div>
                <div class="stat-card">
                    <div class="icon" style="background:var(--info);"><i class="fa-solid fa-user-clock"></i></div>
                    <div class="value">${kpiData.kpis.avgTimeToHireDays}</div>
                    <div class="label">Días para Contratar</div>
                </div>
                <div class="stat-card">
                    <div class="icon" style="background:var(--success);"><i class="fa-solid fa-user-plus"></i></div>
                    <div class="value">${activityData.afiliados.reduce((sum, day) => sum + day.total, 0)}</div>
                    <div class="label">Nuevos Afiliados (30 Días)</div>
                </div>
                <div class="stat-card">
                    <div class="icon" style="background:var(--warning);"><i class="fa-solid fa-hourglass-half"></i></div>
                    <div class="value">${kpiData.kpis.conversionFunnelRaw['En Entrevista'] || 0}</div>
                    <div class="label">Candidatos en Entrevista</div>
                </div>
            `;
        }
        
        // Renderizamos los gráficos (sin cambios)
        renderStatusPieChart(kpiData.kpis.conversionFunnelRaw);
        renderActivityLineChart(activityData.afiliados, activityData.postulaciones);

        // Cargamos el monitor de conversaciones (sin cambios)
        // La función `loadAndDisplayNotifications` debe existir en tu código
        if (typeof loadAndDisplayNotifications === "function") {
            loadAndDisplayNotifications();
        }

        // --- LLAMADA A LA NUEVA FUNCIONALIDAD ---
        // Al final, una vez que el resto del dashboard ha cargado,
        // llamamos a la función para cargar las solicitudes de postulación.
        loadApplicationRequests();

    } catch (error) {
        console.error("Error al renderizar el dashboard:", error);
        // Si falla la carga principal, lo indicamos también en las solicitudes
        const requestsContainer = document.getElementById('application-requests-container');
        if (requestsContainer) {
            requestsContainer.innerHTML = '<p style="color:red;">Error al cargar datos del dashboard.</p>';
        }
    }
}



async function loadAndDisplayNotifications() {
    try {
        const response = await apiCall('/notifications');
        if (!response) return;
        
        // Resto del código para mostrar notificaciones...
    } catch (error) {
        console.error('Error al cargar notificaciones:', error);
        // No mostrar error al usuario si es 404
        if (!error.message.includes('404')) {
            showToast('Error al cargar notificaciones', 'error');
        }
    }
}

function renderNotificationList(notifications) {
    const alertPanel = document.getElementById('live-alert-panel');
    if (!alertPanel) return;

    if (!notifications || notifications.length === 0) {
        alertPanel.innerHTML = '<p style="color: var(--text-secondary); padding: 10px;">Todo tranquilo. No hay notificaciones pendientes.</p>';
        return;
    }

    alertPanel.innerHTML = '';
    notifications.forEach(notification => {
        let alertRow = document.createElement('div');
        alertRow.className = 'alert-item';
        alertRow.id = `notification-${notification.id}`;

        let icon = '<i class="fa-solid fa-comment-dots" style="color: var(--text-secondary);"></i>';
        let borderColor = 'var(--border)';
        let notificationText = `<strong>${notification.contact_name || 'Desconocido'}</strong>: ${notification.summary}`;

        switch (notification.type) {
            case 'consulta_de_estado':
                icon = '<i class="fa-solid fa-user-clock" style="color: var(--info);"></i>';
                borderColor = 'var(--info)';
                notificationText = `<strong>${notification.contact_name}</strong> está consultando su estado.`;
                break;
            case 'interes_en_vacante':
                icon = '<i class="fa-solid fa-briefcase" style="color: var(--success);"></i>';
                borderColor = 'var(--success)';
                notificationText = `<strong>${notification.contact_name}</strong> pregunta por una vacante.`;
                break;
            case 'duda_sobre_pago':
                icon = '<i class="fa-solid fa-hand-holding-dollar" style="color: var(--warning);"></i>';
                borderColor = 'var(--warning)';
                notificationText = `<strong>${notification.contact_name}</strong> tiene dudas sobre pagos.`;
                break;
            case 'queja_general':
            case 'problema_tecnico':
            case 'human_intervention_required':
                icon = '<i class="fa-solid fa-triangle-exclamation" style="color: var(--danger);"></i>';
                borderColor = 'var(--danger)';
                notificationText = `<strong>${notification.contact_name}</strong> requiere atención humana.`;
                break;
        }
        alertRow.style.borderLeft = `4px solid ${borderColor}`;

        alertRow.innerHTML = `
            ${icon}
            <div class="alert-details">
                ${notificationText}
            </div>
        `;

        alertRow.onclick = () => handleNotificationClick(notification.id, notification.chat_id, notification.contact_name);
        alertPanel.appendChild(alertRow);
    });
}

async function handleNotificationClick(notificationId, chatId, contactName) {
    try {
        const response = await fetch(`${NODE_API_URL}/api/crm/notifications/${notificationId}/mark-read`, { method: 'POST' });
        if (!response.ok) throw new Error('No se pudo marcar como leída');
        
        const notificationElement = document.getElementById(`notification-${notificationId}`);
        if (notificationElement) {
            notificationElement.style.transition = 'opacity 0.3s ease';
            notificationElement.style.opacity = '0';
            setTimeout(() => {
                notificationElement.remove();
                const alertPanel = document.getElementById('live-alert-panel');
                if (alertPanel && alertPanel.children.length === 0) {
                    alertPanel.innerHTML = '<p style="color: var(--text-secondary); padding: 10px;">Todo tranquilo. No hay notificaciones pendientes.</p>';
                }
            }, 300);
        }
        
        document.querySelector('.tab-btn[data-tab="whatsapp_chat"]').click();
        setTimeout(() => loadConversation(chatId, contactName), 100);

    } catch (error) {
        console.error("Error al procesar click de notificación:", error);
        showToast("No se pudo procesar la notificación.", 'error');
    }
}



async function renderCandidateSearch() {
    const panel = document.getElementById('buscar');
    panel.innerHTML = `
        <div class="panel-header"><h1>Buscar Candidatos</h1></div>
        <div class="search-bar">
            <input type="text" id="search-candidates-input" placeholder="Buscar 'meseros san pedro sula con moto'..." onkeyup="if(event.key === 'Enter') executeCandidateSearch()">
            <div id="tags-filter-container" style="min-width: 250px;"></div>
            <button class="primary-btn" onclick="executeCandidateSearch()"><i class="fa-solid fa-search"></i> Buscar</button>
        </div>
        <div id="candidates-results-container" class="card-grid"><p>Realiza una búsqueda para ver los resultados.</p></div>`;
    
    // La llamada a executeCandidateSearch() ha sido eliminada de aquí para restaurar el comportamiento original.

    try {
        const tags = await apiCall('/tags');
        const tagsFilterContainer = document.getElementById('tags-filter-container');
        let options = tags.map(tag => `<option value="${tag.id_tag}">${tag.nombre_tag}</option>`).join('');
        tagsFilterContainer.innerHTML = `<select id="search-tags-input" multiple placeholder="Filtrar por etiquetas...">${options}</select>`;
    } catch (error) {
        console.error("No se pudieron cargar las etiquetas para el filtro.");
    }
}


async function renderVacanciesView() {
    const panel = document.getElementById('vacantes');
    // ✨ CAMBIO: Añadimos la barra de búsqueda y un contenedor para la tabla.
    panel.innerHTML = `
        <div class="panel-header">
            <h1>Gestión de Vacantes</h1>
            <button class="primary-btn" onclick="openAddVacancyModal()"><i class="fa-solid fa-plus"></i> Nueva Vacante</button>
        </div>
        <div class="search-bar">
            <input type="text" id="vacancies-search-input" placeholder="Buscar por cargo, empresa o ciudad..." onkeyup="filterTable('vacancies')">
        </div>
        <div id="vacancies-table-container"><div class="spinner"></div></div>
    `;

    try {
        const vacancies = await apiCall('/vacancies');
        // Almacenamos los datos para poder filtrarlos después.
        window.crmDataStore.vacancies = vacancies; 
        // Llamamos a la nueva función para mostrar la tabla.
        displayVacanciesTable(vacancies); 
    } catch (error) {
        document.getElementById('vacancies-table-container').innerHTML = `<p style="color:red;">No se pudieron cargar las vacantes.</p>`;
    }
}


function displayVacanciesTable(data) {
    const container = document.getElementById('vacancies-table-container');
    const headers = ['ID', 'Cargo Solicitado', 'Empresa', 'Ciudad', 'Estado', 'Acciones'];
    let tableHTML = '<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
    
    if (!data || data.length === 0) {
        tableHTML += `<tr><td colspan="${headers.length}" style="text-align:center;">No se encontraron vacantes.</td></tr>`;
    } else {
        tableHTML += data.map(v => `
            <tr>
                <td><strong>${v.id_vacante}</strong></td>
                <td>${v.cargo_solicitado}</td>
                <td>${v.empresa}</td>
                <td>${v.ciudad}</td>
                <td><span class="status-badge" data-status="${v.estado}">${v.estado}</span></td>
                <td><div class="actions"><button class="primary-btn" onclick="showVacancyPipeline(${v.id_vacante})"><i class="fa-solid fa-users"></i> Ver Pipeline</button></div></td>
            </tr>`).join('');
    }
    
    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}


async function renderPostulacionesView() {
    const panel = document.getElementById('postulaciones');
    panel.innerHTML = `
        <div class="panel-header"><h1>Todas las Postulaciones</h1></div>
        <div class="search-bar" id="postulaciones-filters">
            <!-- ✨ CAMBIO: Añadimos un input de búsqueda -->
            <input type="text" id="postulaciones-search-input" placeholder="Buscar localmente..." onkeyup="filterPostulacionesTable()">
            <select id="postulaciones-vacante-filter"><option value="">Todas las Vacantes</option></select>
            <select id="postulaciones-estado-filter"><option value="">Todos los Estados</option><option>Recibida</option><option>En Revisión</option><option>Pre-seleccionado</option><option>En Entrevista</option><option>Oferta</option><option>Contratado</option><option>Rechazado</option></select>
            <input type="date" id="postulaciones-fecha-filter">
            <button class="primary-btn" onclick="applyTableFilters('postulaciones')"><i class="fa-solid fa-filter"></i> Filtrar</button>
        </div>
        <div id="postulaciones-table-container"><div class="spinner"></div></div>`;
    try {
        const activeVacancies = await apiCall('/vacancies/active');
        const vacanteSelect = document.getElementById('postulaciones-vacante-filter');
        vacanteSelect.innerHTML += activeVacancies.map(v => `<option value="${v.id}">${v.puesto}</option>`).join('');
    } catch(e) { console.error("Error cargando filtros de vacantes"); }
    applyTableFilters('postulaciones');
}


async function renderEntrevistasView() {
    const panel = document.getElementById('entrevistas');
    panel.innerHTML = `
        <div class="panel-header"><h1>Todas las Entrevistas</h1></div>
        <div class="search-bar" id="entrevistas-filters">
            <!-- ✨ CAMBIO: Añadimos un input de búsqueda -->
            <input type="text" id="entrevistas-search-input" placeholder="Buscar localmente..." onkeyup="filterEntrevistasTable()">
            <input type="date" id="entrevistas-fecha-filter" style="width: auto;">
            <button class="primary-btn" onclick="applyTableFilters('entrevistas')"><i class="fa-solid fa-filter"></i> Filtrar</button>
        </div>
        <div id="entrevistas-table-container"><div class="spinner"></div></div>`;
    applyTableFilters('entrevistas');
}


async function renderContratadosView() {
    const panel = document.getElementById('contratados');
    // ✨ CAMBIO: Añadimos la barra de búsqueda.
    panel.innerHTML = `
        <div class="panel-header"><h1>Historial de Contratados</h1></div>
        <div class="search-bar">
            <input type="text" id="contratados-search-input" placeholder="Buscar por candidato, vacante o empresa..." onkeyup="filterContratadosTable()">
        </div>
        <div id="contratados-table-container"><div class="spinner"></div></div>`;
    
    try {
        const contratados = await apiCall('/hired');
        // Almacenamos los datos para el filtrado.
        window.crmDataStore.contratados = contratados;
        // Llamamos a la función que mostrará la tabla con los datos completos.
        displayContratadosTable(contratados);
    } catch (error) {
        document.getElementById('contratados-table-container').innerHTML = `<p style="color:red;">No se pudo cargar el historial.</p>`;
    }
}


function displayContratadosTable(data) {
    const container = document.getElementById('contratados-table-container');
    const headers = ['Candidato (ID)', 'Vacante', 'Empresa', 'Fecha Cont.', 'Tarifa', 'Pagado', 'Saldo', 'Acciones'];

    let tableHTML = '<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';

    if(!data || data.length === 0) {
        tableHTML += `<tr><td colspan="${headers.length}" style="text-align: center;">No se encontraron contrataciones con ese criterio.</td></tr>`;
    } else {
        tableHTML += data.map(c => `
            <tr>
                <td><a href="#" onclick="showCandidateProfile(${c.id_afiliado})">${c.nombre_completo}</a> (ID: ${c.id_afiliado})</td>
                <td>${c.cargo_solicitado}</td>
                <td>${c.empresa}</td>
                <td>${formatReportCell(c.fecha_contratacion, 'fecha_contratacion')}</td>
                <td>${formatReportCell(c.tarifa_servicio, 'tarifa_servicio')}</td>
                <td>${formatReportCell(c.monto_pagado, 'monto_pagado')}</td>
                <td><strong>${formatReportCell(c.saldo_pendiente, 'saldo_pendiente')}</strong></td>
                <td>
                    <div class="actions">
                        ${c.saldo_pendiente > 0 ? 
                            `<button class="primary-btn btn" onclick="openRegisterPaymentModal(${c.id_contratado})"><i class="fa-solid fa-cash-register"></i></button>`
                            : '<span class="status-badge" data-status="Contratado" style="margin-right: 5px;">Pagado</span>'
                        }
                        <button class="btn" style="background-color: var(--danger);" title="Anular Contratación" onclick="confirmAnnulHiring(${c.id_contratado})"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </td>
            </tr>`).join('');
    }

    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}


function filterContratadosTable() {
    const searchTerm = document.getElementById('contratados-search-input').value.toLowerCase();
    const dataToFilter = window.crmDataStore.contratados || [];

    if (!dataToFilter) return;

    const filteredData = dataToFilter.filter(row => {
        // Busca el término en todos los valores del objeto
        return Object.values(row).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });

    // Vuelve a mostrar la tabla con los datos filtrados
    displayContratadosTable(filteredData);
}


/**
 * Abre un modal para registrar un nuevo pago para una contratación específica.
 * @param {number} contratadoId - El ID del registro en la tabla Contratados.
 */
function openRegisterPaymentModal(contratadoId) {
    const content = `
        <p>Ingresa el monto del pago que deseas registrar.</p>
        <div>
            <label>Monto del Pago:</label>
            <input type="number" id="modal-pago-monto" placeholder="Ej: 2500.00" step="0.01">
        </div>
    `;
    showModal('Registrar Nuevo Pago', content, [
        { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
        { label: 'Confirmar Pago', class: 'primary-btn', handler: `submitPayment(${contratadoId})` }
    ]);
}

/**
 * Envía el monto del pago a la API para registrarlo.
 * @param {number} contratadoId - El ID del registro en la tabla Contratados.
 */
async function submitPayment(contratadoId) {
    const monto = document.getElementById('modal-pago-monto').value;
    if (!monto || parseFloat(monto) <= 0) {
        showToast('Debes ingresar un monto de pago válido.', 'error');
        return;
    }

    try {
        const response = await apiCall(`/hired/${contratadoId}/payment`, 'POST', { monto: monto });
        closeModal();
        showToast(response.message, 'success');
        renderContratadosView(); // Recargamos la vista para ver el saldo actualizado
    } catch (error) {
        // El error ya es manejado por apiCall.
    }
}

// AÑADE esta nueva función justo después de 'submitPayment'

function confirmAnnulHiring(contratadoId) {
    if (confirm("¿Estás seguro de que deseas anular esta contratación? Esta acción no se puede deshacer.")) {
        annulHiring(contratadoId);
    }
}

async function annulHiring(contratadoId) {
    try {
        const response = await apiCall(`/hired/${contratadoId}`, 'DELETE');
        showToast(response.message, 'success');
        renderContratadosView(); // Recargar la vista
    } catch (error) {
        // apiCall ya maneja el error
    }
}


async function renderClientsView() {
    const panel = document.getElementById('clientes');
    try {
        const clients = await apiCall('/clients');
        const headers = ['Empresa', 'Contacto', 'Teléfono', 'Email', 'Sector'];
        let tableHTML = '<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
        tableHTML += clients.map(c => `
            <tr>
                <td>${c.empresa}</td><td>${c.contacto_nombre}</td><td>${c.telefono}</td><td>${c.email}</td><td>${c.sector}</td>
            </tr>`).join('');
        tableHTML += '</tbody></table>';
        panel.innerHTML = `<div class="panel-header"><h1>Gestión de Clientes</h1><button class="primary-btn" onclick="openAddClientModal()"><i class="fa-solid fa-plus"></i> Nuevo Cliente</button></div>` + tableHTML;
    } catch (error) {
        panel.innerHTML = `<div class="panel-header"><h1>Gestión de Clientes</h1></div><p style="color:red;">No se pudieron cargar los clientes.</p>`;
    }
}

// AÑADE ESTE BLOQUE COMPLETO DE 3 FUNCIONES EN SCRIPT.JS

/**
 * Construye la vista principal del panel de Reportes con su menú.
 */
function renderReportsView() {
    const panel = document.getElementById('reportes');

    const reportList = [
        { id: 'vacantes_activas', name: 'Vacantes Activas', icon: 'fa-briefcase' },
        { id: 'postulaciones_recientes', name: 'Postulaciones Recientes', icon: 'fa-file-invoice' },
        { id: 'entrevistas_agendadas', name: 'Entrevistas Agendadas', icon: 'fa-calendar-check' },
        { id: 'contrataciones_realizadas', name: 'Contrataciones Recientes', icon: 'fa-handshake' },
        { id: 'pagos_pendientes', name: 'Pagos Pendientes', icon: 'fa-dollar-sign' },
        { id: 'vacantes_sin_movimiento', name: 'Vacantes sin Movimiento', icon: 'fa-bed' },
        { id: 'resumen_por_cliente', name: 'Resumen por Cliente', icon: 'fa-building-user' },
        { id: 'afiliados_nuevos', name: 'Afiliados Nuevos', icon: 'fa-user-plus' },
        { id: 'clientes_inactivos', name: 'Clientes Inactivos', icon: 'fa-building-circle-exclamation' },
        { id: 'entrevistas_pendientes_decision', name: 'Entrevistas sin Decisión', icon: 'fa-gavel' },
        { id: 'candidatos_sin_exito', name: 'Candidatos con Múltiples Postulaciones', icon: 'fa-user-graduate' },
        { id: 'afiliados_inactivos', name: 'Afiliados Inactivos', icon: 'fa-user-clock' },
        { id: 'tiempos_promedio', name: 'Tiempos Promedio (KPI)', icon: 'fa-hourglass-half' },
        { id: 'indicadores_mensuales', name: 'Indicadores del Mes (KPI)', icon: 'fa-chart-pie' }
    ];

    let menuHTML = reportList.map(report => `
        <button class="tab-btn" onclick="loadReport('${report.id}')">
            <i class="fa-solid ${report.icon}"></i> ${report.name}
        </button>
    `).join('');

    panel.innerHTML = `
        <div class="panel-header"><h1>Centro de Reportes</h1></div>
        <div class="reports-layout">
            <aside class="reports-menu">
                ${menuHTML}
            </aside>
            <main id="report-content-area" style="padding:0;">
                <div class="dashboard-list-card" style="padding: 30px; text-align: center;">
                    <i class="fa-solid fa-arrow-left" style="font-size: 2rem; color: var(--text-secondary); margin-bottom: 15px;"></i>
                    <h3>Bienvenido al Centro de Reportes</h3>
                    <p style="color: var(--text-secondary);">Selecciona un reporte del menú de la izquierda para comenzar.</p>
                </div>
            </main>
        </div>
    `;

    // Opcional: Cargar el primer reporte por defecto al entrar
    // loadReport(reportList[0].id);
}

/**
 * Llama a la API para obtener los datos de un reporte específico y lo muestra como una tabla.
 * @param {string} reportName - El identificador del reporte (ej: 'vacantes_activas').
 */
async function loadReport(reportName) {
    const contentArea = document.getElementById('report-content-area');
    contentArea.innerHTML = '<div class="spinner"></div>';

    try {
        const result = await apiCall(`/reports?name=${reportName}`);
        const data = result.data;

        if (!data || data.length === 0) {
            contentArea.innerHTML = '<div class="dashboard-list-card"><p>No hay datos disponibles para este reporte.</p></div>';
            return;
        }

        const headers = Object.keys(data[0]);
        let tableHTML = `
            <div class="dashboard-list-card">
                <h3 style="text-transform: capitalize; margin-bottom: 20px;">${reportName.replace(/_/g, ' ')}</h3>
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                ${headers.map(h => `<th>${h.replace(/_/g, ' ')}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(row => `
                                <tr>
                                    ${headers.map(header => `<td>${formatReportCell(row[header], header)}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;

        contentArea.innerHTML = tableHTML;
    } catch (error) {
        contentArea.innerHTML = `<div class="dashboard-list-card"><p style="color:red;">No se pudo cargar el reporte: ${error.message}</p></div>`;
    }
}

/**
 * Función auxiliar para dar formato a los datos en las celdas de la tabla de reportes.
 * @param {*} value - El valor de la celda.
 * @param {string} key - El nombre de la columna.
 */
function formatReportCell(value, key) {
    if (value === null || value === undefined) return 'N/A';

    const moneyKeys = ['tarifa_servicio', 'monto_pagado', 'saldo_pendiente', 'ingresos_mes', 'salario_final', 'total_facturado', 'total_cobrado', 'total_pendiente'];
    if (moneyKeys.includes(key) && typeof value === 'number') {
        return `Lps. ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    if (typeof value === 'string' && (value.includes('T') || value.match(/^\d{4}-\d{2}-\d{2}$/))) {
        const date = new Date(value);
        // Si la fecha es inválida, devuelve el valor original
        if (isNaN(date.getTime())) return value; 
        // Si tiene horas, minutos o segundos, muestra la fecha y hora. Si no, solo la fecha.
        if (date.getUTCHours() > 0 || date.getUTCMinutes() > 0 || date.getUTCSeconds() > 0) {
             return date.toLocaleString('es-HN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('es-HN', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    return value;
}


async function renderSettingsView() {
    const panel = document.getElementById('configuracion');
    panel.innerHTML = `<div class="panel-header"><h1>Configuración del Sistema</h1></div>
                       <div id="settings-content" class="card-grid" style="grid-template-columns: 1fr 1fr; align-items: flex-start;">
                           <div class="spinner"></div>
                       </div>`;
    try {
        const [tags, templates] = await Promise.all([apiCall('/tags'), apiCall('/templates')]);
        
        const systemActionsHTML = `
            <div class="dashboard-list-card">
                <h3><i class="fa-solid fa-gears"></i> Acciones del Sistema</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">
                    Usa estas herramientas para mantenimiento y sincronización.
                </p>
                <div style="margin-top: 20px; text-align: right;">
                    <button class="secondary-btn" onclick="resyncNotifications()">
                        <i class="fa-solid fa-sync"></i> Resincronizar Notificaciones
                    </button>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 10px;">
                    Si crees que algunas notificaciones de postulación no se enviaron (ej. si el puente estaba desconectado), usa este botón para reenviarlas.
                </p>
            </div>
        `;

        const uploadHTML = `
            <div class="dashboard-list-card">
                <h3><i class="fa-solid fa-file-excel"></i> Carga Masiva de Datos</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 15px;">Sube un archivo Excel (.xlsx) para cargar datos masivamente. Descarga la plantilla para asegurar el formato correcto.</p>
                <div style="margin-bottom: 15px;">
                    <label for="upload-type-select">Tipo de dato a subir:</label>
                    <select id="upload-type-select">
                        <option value="afiliados">Afiliados</option><option value="clientes">Clientes</option><option value="vacantes">Vacantes</option><option value="postulaciones">Postulaciones</option>
                    </select>
                </div>
                <input type="file" id="excel-upload-input" accept=".xlsx, .xls">
                <div style="margin-top: 20px; display: flex; justify-content: space-between;">
                    <button class="secondary-btn" onclick="downloadTemplate()"><i class="fa-solid fa-download"></i> Descargar Plantilla</button>
                    <button class="primary-btn" onclick="uploadExcelFile()"><i class="fa-solid fa-upload"></i> Subir y Procesar</button>
                </div>
            </div>`;

        const tagsHTML = `<div class="dashboard-list-card"><h3><i class="fa-solid fa-tags"></i> Gestionar Etiquetas</h3><ul id="tags-list">${tags.map(t => `<li>${t.nombre_tag}</li>`).join('')}</ul><div class="search-bar" style="margin-top: 20px; padding: 8px;"><input type="text" id="new-tag-input" placeholder="Nueva etiqueta..."><button class="primary-btn" onclick="addNewTag()">Añadir</button></div></div>`;
        const templatesHTML = `<div class="dashboard-list-card"><h3><i class="fa-solid fa-envelope-open-text"></i> Plantillas de Correo</h3><ul id="templates-list">${templates.map(t => `<li>${t.nombre_plantilla}</li>`).join('')}</ul><div style="margin-top: 20px; text-align: right;"><button class="primary-btn" onclick="openAddTemplateModal()">Nueva Plantilla</button></div></div>`;
        
        // El nuevo card de acciones del sistema se añade al principio.
        document.getElementById('settings-content').innerHTML = systemActionsHTML + uploadHTML + tagsHTML + templatesHTML;
    } catch (error) {
        document.getElementById('settings-content').innerHTML = `<p style="color:red;">No se pudo cargar la configuración.</p>`;
    }
}

// --- ✨ NUEVA FUNCIÓN PARA EL BOTÓN DE RESINCRONIZACIÓN ✨ ---
async function resyncNotifications() {
    if (!confirm("¿Estás seguro de que deseas resincronizar las notificaciones pendientes? Esto buscará postulaciones que no se hayan notificado y las reenviará a la cola.")) {
        return;
    }
    showLoader(true);
    try {
        const response = await fetch(`${API_BASE_URL}/applications/resync_pending_notifications`, {
            method: 'POST',
            // No necesitamos un cuerpo, pero sí la cabecera si la API está protegida,
            // aunque en este caso, al ser llamada desde el frontend, no requiere API Key.
            // Si la hicieras segura en el futuro, añadirías la cabecera aquí.
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error del servidor');
        }

        const result = await response.json();
        showToast(`Resincronización completada. ${result.tasks_resent || 0} tareas reenviadas a la cola.`, 'success');
    } catch (error) {
        handleError(error);
    } finally {
        showLoader(false);
    }
}
// --- FIN DE LA NUEVA FUNCIÓN ---
// ======================================================
// --- ✨ SECCIÓN DE MENSAJERÍA Y ASISTENTE IA (COMPLETA) ✨ ---
// ======================================================


/**
 * ✨ NUEVO: Maneja el evento de presionar tecla en el input del asistente.
 * Llama a sendAssistantCommand si se presiona Enter sin Shift.
 * @param {KeyboardEvent} event - El evento del teclado.
 */
function handleAssistantInputKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendAssistantCommand();
    }
}



// EN app.js, REEMPLAZA LA FUNCIÓN sendAssistantCommand

async function sendAssistantCommand() {
    const input = document.getElementById('assistant-input');
    const prompt = input.value.trim();
    if (!prompt) return;

    addMessageToChat(prompt, 'user');
    input.value = '';
    input.disabled = true;
    document.getElementById('assistant-send-btn').disabled = true;

    try {
        const response = await apiCall('/assistant/command', 'POST', { 
            prompt: prompt,
            history: window.assistantHistory // Enviamos el historial actual
        });
        
        // Aseguramos que siempre tengamos un texto de respuesta
        const assistantReply = (response.type === 'whatsapp_campaign_prepared' ? response.text_response : response.data) || "No he recibido una respuesta válida.";
        
        addMessageToChat(assistantReply, 'assistant');
        
        // Guardamos el intercambio en el historial para la siguiente petición
        window.assistantHistory.push({ user: prompt, assistant: assistantReply });
        if (window.assistantHistory.length > 5) { // Mantenemos el historial corto
            window.assistantHistory.shift();
        }

        if (response.type === 'whatsapp_campaign_prepared') {
            openWhatsappConfirmationModal(response.campaign_data);
        }

    } catch (error) {
        addMessageToChat('Lo siento, no pude procesar tu solicitud.', 'assistant');
    } finally {
        input.disabled = false;
        document.getElementById('assistant-send-btn').disabled = false;
        input.focus();
    }
}

// REEMPLAZA LA FUNCIÓN 'addMessageToChat' COMPLETA CON ESTE BLOQUE:

function addMessageToChat(text, role) {
    const messagesContainer = document.getElementById('assistant-messages');
    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${role}`;

    // ✨ CAMBIO CLAVE AQUÍ ✨
    // En lugar de mostrar el texto plano con .textContent,
    // usamos la librería 'marked' para convertir el texto con formato Markdown a HTML
    // y lo insertamos con .innerHTML. La librería se encarga de la seguridad.
    if (window.marked) {
        bubble.innerHTML = window.marked.parse(text);
    } else {
        // Fallback por si la librería no carga
        bubble.textContent = text;
    }

    messagesContainer.appendChild(bubble);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}





function toggleSpeechRecognition() {
    const micBtn = document.getElementById('mic-btn');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Tu navegador no soporta la API de voz.', 'error');
        return;
    }

    if (!window.speechRecognition || window.speechRecognition.curentlyRecording === false) {
        // Iniciar una nueva grabación
        window.speechRecognition = new SpeechRecognition();
        window.speechRecognition.lang = 'es-HN';
        window.speechRecognition.interimResults = false;
        window.speechRecognition.maxAlternatives = 1;
        window.speechRecognition.curentlyRecording = true;

        window.speechRecognition.start();
        micBtn.classList.add('recording');
        showToast('Escuchando...', 'info');

        window.speechRecognition.onresult = (event) => {
            const speechResult = event.results[0][0].transcript;
            document.getElementById('assistant-input').value = speechResult;
            sendAssistantCommand();
        };

        window.speechRecognition.onend = () => {
            micBtn.classList.remove('recording');
            window.speechRecognition.curentlyRecording = false;
        };

        window.speechRecognition.onerror = (event) => {
            showToast('Error en el reconocimiento de voz: ' + event.error, 'error');
            micBtn.classList.remove('recording');
            window.speechRecognition.curentlyRecording = false;
        };

    } else {
        // Detener la grabación actual
        window.speechRecognition.stop();
        micBtn.classList.remove('recording');
        window.speechRecognition.curentlyRecording = false;
    }
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        // Detener cualquier locución anterior para evitar que se solapen
        window.speechSynthesis.cancel(); 
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'es-ES';
        window.speechSynthesis.speak(utterance);
    }
}

// AÑADE ESTE BLOQUE DE 2 FUNCIONES NUEVAS Y POTENTES EN LUGAR DE LAS VIEJAS

/**
 * Abre un modal avanzado para confirmar y configurar una campaña de WhatsApp.
 * @param {object} campaignData - Objeto con { recipients, message_body }.
 */
function openWhatsappConfirmationModal(campaignData) {
    const { recipients, message_body } = campaignData;
    if (!recipients || recipients.length === 0) {
        showToast('No hay destinatarios válidos para esta campaña.', 'info');
        return;
    }

    // Guardamos los datos globalmente para que el lanzador los pueda usar
    window.crmDataStore.whatsappCampaign = { recipients, message_body };

    let recipientListHTML = recipients.map(r => `<li>${r.nombre_completo} (${r.telefono})</li>`).join('');

    const content = `
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <p>Se enviará el siguiente mensaje a <strong>${recipients.length} candidato(s)</strong>:</p>
            <textarea id="campaign-message-body" class="obs-box" style="width: 100%; margin: 15px 0;" rows="5">${message_body}</textarea>
            
            <div>
                <label for="campaign-interval"><strong>Intervalo de envío (segundos):</strong></label>
                <input type="number" id="campaign-interval" value="15" min="5" style="width: 100px; margin-left: 10px;">
                <p style="font-size: 0.8rem; color: var(--text-secondary);">Se recomienda un intervalo de 10-20 segundos para evitar bloqueos.</p>
            </div>

            <p><strong>Lista de Destinatarios Validados:</strong></p>
            <ul style="max-height: 200px; overflow-y: auto; background: #f8fafc; padding: 10px; border-radius: 6px;">${recipientListHTML}</ul>
        </div>
    `;

    showModal('Confirmar y Lanzar Campaña de WhatsApp', content, [
        { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
        { label: 'Lanzar Campaña Ahora', class: 'primary-btn', handler: 'launchWhatsappCampaign()' }
    ]);
}


function launchWhatsappCampaign() {
    const campaign = window.crmDataStore.whatsappCampaign;
    const intervalSeconds = parseInt(document.getElementById('campaign-interval').value, 10);
    const messageBody = document.getElementById('campaign-message-body').value;

    if (!campaign || intervalSeconds < 5 || !messageBody) {
        showToast('Datos de campaña inválidos o intervalo muy corto.', 'error');
        return;
    }

    // --- ✨ CORRECCIÓN CLAVE AQUÍ ✨ ---
    // Verificamos la conexión usando la nueva variable unificada: window.waChatSocket
    if (!window.waChatSocket || window.waChatSocket.readyState !== WebSocket.OPEN) {
        showToast('El puente de WhatsApp no está conectado. Por favor, ve a la pestaña "Chat de WhatsApp" y conéctalo.', 'error');
        return;
    }

    closeModal();
    showToast(`Iniciando campaña... Se enviará un mensaje cada ${intervalSeconds} segundos.`, 'success');

    const tasks = campaign.recipients.map(recipient => {
        const personalizedMessage = messageBody.replace(/\[name\]/g, recipient.nombre_completo.split(' ')[0]);
        return {
            telefono: recipient.telefono,
            nombre: recipient.nombre_completo,
            mensaje: personalizedMessage
        };
    });

    let currentIndex = 0;
    
    function sendNextMessage() {
        if (currentIndex >= tasks.length) {
            showToast('Campaña de WhatsApp completada.', 'success');
            delete window.crmDataStore.whatsappCampaign;
            return;
        }

        const task = tasks[currentIndex];
        
        // --- ✨ Y LA SEGUNDA CORRECCIÓN CLAVE AQUÍ ✨ ---
        // Enviamos la orden a través de la conexión correcta: window.waChatSocket
        window.waChatSocket.send(JSON.stringify({ action: 'send_single_message', task: task }));
        
        // (La lógica para mostrar el mensaje en el chat del asistente no es necesaria aquí,
        // ya que las campañas son una acción de fondo)
        const logContainer = document.getElementById('whatsapp-log'); // Buscamos el log si existe
        if (logContainer) {
            const logEntry = document.createElement('p');
            logEntry.textContent = `[${new Date().toLocaleTimeString()}] Enviando a ${task.nombre}...`;
            logContainer.appendChild(logEntry);
            logContainer.scrollTop = logContainer.scrollHeight;
        }

        currentIndex++;
        setTimeout(sendNextMessage, intervalSeconds * 1000);
    }

    sendNextMessage();
}



// REEMPLAZA ESTA FUNCIÓN COMPLETA
async function executeCandidateSearch(filters = {}) {
    const term = document.getElementById('search-candidates-input')?.value || '';
    const tagsSelect = document.getElementById('search-tags-input');
    const selectedTags = tagsSelect ? [...tagsSelect.options].filter(option => option.selected).map(option => option.value) : [];
    
    // ✨ CAMBIO: Usamos URLSearchParams para construir la URL de forma más limpia
    const params = new URLSearchParams({
        q: term
    });

    if (selectedTags.length > 0) {
        params.append('tags', selectedTags.join(','));
    }

    // ✨ CAMBIO: Añadimos los filtros que vienen del dashboard
    if (filters.registered_today) {
        params.append('registered_today', 'true');
    }
    
    const endpoint = `/candidates/search?${params.toString()}`;

    try {
        const results = await apiCall(endpoint);
        displayCandidates(results);
    } catch (error) {
        const container = document.getElementById('candidates-results-container');
        if (container) {
            container.innerHTML = `<p style="color:red;">La búsqueda falló.</p>`;
        }
    }
}

// REEMPLAZA ESTA FUNCIÓN COMPLETA
function displayCandidates(results) {
    const container = document.getElementById('candidates-results-container');
    if (!container) return;

    let resultsHTML = `<div style="grid-column: 1 / -1; margin-bottom: 10px; font-size: 1.1rem; color: var(--text-secondary);"><strong>${results.length}</strong> ${results.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}.</div>`;
    if (results.length === 0) {
        container.innerHTML = '<p>No se encontraron candidatos que coincidan con la búsqueda.</p>';
        return;
    }

    results.forEach(c => {
        const encodedObs = encodeURIComponent(c.observaciones || '');

        resultsHTML += `
        <div class="candidate-card" data-candidate-id="${c.id_afiliado}">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <h3 style="margin-bottom: 0;"><a class="profile-link" style="cursor:pointer;" data-candidate-id="${c.id_afiliado}">${c.nombre_completo || 'Sin Nombre'}</a></h3>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">ID: ${c.id_afiliado}</span>
            </div>
            
            <!-- ✨ LÍNEA AÑADIDA: Mostramos la fecha de registro. -->
            <p style="color: var(--text-secondary); font-size: 0.8rem; margin: 5px 0 0 0;">Registrado: ${new Date(c.fecha_registro).toLocaleDateString('es-HN')}</p>

            <p style="color: var(--info); font-size: 0.85rem; margin-top: 5px; min-height: 1.2em; font-weight: 500;">
                ${c.historialEmpresas ? `Enviado a: ${c.historialEmpresas}` : 'CV no enviado'}
            </p>
            
            <div class="info-grid" style="margin-top: 15px;">
                <p><strong><i class="fa-solid fa-location-dot fa-fw"></i> Ciudad:</strong> ${c.ciudad || 'N/A'}</p>
                <p><strong><i class="fa-solid fa-user-graduate fa-fw"></i> Grado:</strong> ${c.grado_academico || 'N/A'}</p>
                <p><strong><i class="fa-solid fa-car fa-fw"></i> Transporte:</strong> ${c.transporte_propio ? 'Sí' : 'No'}</p>
                <p><strong><i class="fa-solid fa-clock fa-fw"></i> Turnos Rot.:</strong> ${c.disponibilidad_rotativos ? 'Sí' : 'No'}</p>
            </div>

            <div><strong><i class="fa-solid fa-briefcase"></i> Experiencia:</strong><div class="obs-box" style="max-height: 80px;">${c.experiencia || 'No especificada.'}</div></div>
            
            <div style="margin-top: 15px;">
                <strong><i class="fa-solid fa-pen-to-square"></i> Observaciones:</strong>
                <div class="obs-box" id="obs-${c.id_afiliado}">${c.observaciones || 'Sin observaciones.'}</div>
            </div>

            <div class="actions" style="margin-top:20px; border-top: 1px solid var(--border); padding-top: 15px; justify-content: space-between;">
                <div>
                    <button class="primary-btn postular-btn" style="background-color: var(--success);" data-candidate-id="${c.id_afiliado}" data-candidate-name="${c.nombre_completo}"><i class="fa-solid fa-paper-plane"></i> Postular</button>
                    <button class="secondary-btn edit-obs-btn" data-candidate-id="${c.id_afiliado}" data-candidate-name="${c.nombre_completo}" data-current-obs="${encodedObs}"><i class="fa-solid fa-pencil"></i> Notas</button>
                </div>
                <div>
                    ${c.cv_url ? `<a href="${c.cv_url}" target="_blank" class="secondary-btn"><i class="fa-solid fa-file-lines"></i> Ver CV</a>` : ''}
                    <button class="secondary-btn profile-btn" data-candidate-id="${c.id_afiliado}"><i class="fa-solid fa-eye"></i> Perfil</button>
                </div>
            </div>
        </div>`;
    });
    container.innerHTML = resultsHTML;
}

/**
 * ✨ NUEVO: Abre el modal para postular un candidato a una vacante.
 * @param {number} candidatoId - El ID del candidato.
 * @param {string} candidatoNombre - El nombre del candidato.
 */
async function openPostulacionModal(candidatoId, candidatoNombre) {
    try {
        const vacantes = await apiCall('/vacancies/active');
        if (!vacantes || vacantes.length === 0) {
            showToast('No hay vacantes activas para postular.', 'info');
            return;
        }
        
        // Nos aseguramos de usar v.id, que es lo que el endpoint /api/vacancies/active nos envía.
        let vacantesOptions = vacantes.map(v => `<option value="${v.id}">${v.puesto}</option>`).join('');
        
        const modalContent = `
            <p>Postulando a <strong>${candidatoNombre}</strong></p>
            <div style="margin-top: 15px;">
                <label for="modal-vacante-select">Seleccionar Vacante:</label>
                <select id="modal-vacante-select">
                    <option value="" disabled selected>-- Por favor, elige una vacante --</option>
                    ${vacantesOptions}
                </select>
            </div>
            <div style="margin-top: 15px;">
                <label>Comentarios (opcional):</label>
                <textarea id="modal-comentarios-textarea" rows="3"></textarea>
            </div>`;
            
        showModal('Postular Candidato', modalContent, [
            { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
            { label: 'Registrar Postulación', class: 'primary-btn', handler: `submitPostulacion(${candidatoId})` }
        ]);
    } catch (error) {
        handleError(error);
    }
}

/**
 * ✨ NUEVO: Envía los datos de la nueva postulación al backend.
 * @param {number} candidatoId - El ID del candidato a postular.
 */


// En script.js, reemplaza esta función completa
async function submitPostulacion(candidatoId) {
    const vacanteSelect = document.getElementById('modal-vacante-select');
    const idVacante = parseInt(vacanteSelect.value, 10);
    // Para obtener el nombre del candidato, lo buscamos en el botón que abrió el modal
    const postularBtn = document.querySelector(`.postular-btn[data-candidate-id="${candidatoId}"]`);
    const candidatoNombre = postularBtn ? postularBtn.dataset.candidateName : 'Candidato';
    const vacanteTexto = vacanteSelect.options[vacanteSelect.selectedIndex].text.split(' - ');

    if (!idVacante || idVacante <= 0) {
        showToast('Por favor, selecciona una vacante válida.', 'error');
        return;
    }

    const data = {
        id_afiliado: candidatoId,
        id_vacante: idVacante,
        comentarios: document.getElementById('modal-comentarios-textarea').value
    };
    
    try {
        const response = await apiCall('/applications', 'POST', data);
        closeModal();
        showToast(response.message, response.success ? 'success' : 'error');
        
        if (response.success) {
            // Lógica de envío de tarea por WebSocket
            if (response.whatsapp_task) {
                if (window.waChatSocket && window.waChatSocket.readyState === WebSocket.OPEN) {
                    console.log("Enviando tarea de POSTULACIÓN vía WebSocket:", response.whatsapp_task);
                    window.waChatSocket.send(JSON.stringify({
                        action: 'queue_notification_task',
                        task: response.whatsapp_task
                    }));
                } else {
                    showToast('Notificación no enviada: El puente de WhatsApp no está conectado.', 'error');
                }
            }
            
            // Lógica de actualización instantánea de la UI
            if (document.getElementById('postulaciones').style.display === 'block' && window.crmDataStore.postulaciones) {
                const nuevaPostulacion = {
                    id_postulacion: response.id_postulacion,
                    id_afiliado: candidatoId,
                    nombre_completo: candidatoNombre,
                    cargo_solicitado: vacanteTexto[0] || 'N/A',
                    empresa: vacanteTexto[1] || 'N/A',
                    fecha_aplicacion: new Date().toISOString(),
                    estado: 'Recibida',
                    comentarios: data.comentarios,
                    whatsapp_notification_status: 'pending',
                    cv_url: null
                };
                window.crmDataStore.postulaciones.unshift(nuevaPostulacion);
                displayPostulacionesTable(window.crmDataStore.postulaciones);
            }

            // Actualizar la tarjeta del candidato si está visible en la vista de búsqueda
            const candidateCard = document.querySelector(`.candidate-card[data-candidate-id="${candidatoId}"]`);
            if (candidateCard) {
                const historialElement = candidateCard.querySelector('p[style*="color: var(--info)"]');
                if (historialElement) {
                    const empresaNombre = vacanteTexto[1] || 'Empresa';
                    const currentHistorial = historialElement.textContent;
                    if (currentHistorial.includes('CV no enviado')) {
                        historialElement.textContent = `Enviado a: ${empresaNombre}`;
                    } else {
                        historialElement.textContent += `, ${empresaNombre}`;
                    }
                }
            }
        }
    } catch (error) {
        // apiCall ya maneja el error y muestra un toast
    }
}
/**
 * ✨ NUEVO: Abre el modal para editar las observaciones de un candidato.
 * @param {number} afiliadoId - El ID del candidato.
 * @param {string} nombre - El nombre del candidato.
 * @param {string} observacionesActuales - El texto actual de las observaciones.
 */
function editObservaciones(afiliadoId, nombre, observacionesActuales) {
    const modalContent = `
        <p>Editando notas para <strong>${nombre}</strong>.</p>
        <textarea id="modal-obs-editor" rows="6" style="margin-top:10px;">${observacionesActuales}</textarea>`;
    showModal('Editar Observaciones', modalContent, [
        { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
        { label: 'Guardar', class: 'primary-btn', handler: `saveObservaciones(${afiliadoId})` }
    ]);
}

/**
 * ✨ NUEVO: Guarda las nuevas observaciones en el backend.
 * @param {number} afiliadoId - El ID del candidato a actualizar.
 */
async function saveObservaciones(afiliadoId) {
    const newObs = document.getElementById('modal-obs-editor').value;
    try {
        // Usamos el endpoint de PUT del perfil que ya creamos
        await apiCall(`/candidate/profile/${afiliadoId}`, 'PUT', { observaciones: newObs });
        closeModal();
        showToast('Observaciones guardadas.');
        // Actualizar la vista sin recargar toda la página
        const obsDiv = document.getElementById(`obs-${afiliadoId}`);
        if (obsDiv) {
            obsDiv.textContent = newObs || 'Sin observaciones.';
        }
    } catch (error) {
        // El error ya es manejado
    }
}


async function applyTableFilters(type) {
    let endpoint = '';
    const params = new URLSearchParams();

    if (type === 'postulaciones') {
        endpoint = '/applications';
        const vacanteId = document.getElementById('postulaciones-vacante-filter').value;
        const estado = document.getElementById('postulaciones-estado-filter').value;
        const fecha = document.getElementById('postulaciones-fecha-filter').value;
        if (vacanteId) params.append('vacante_id', vacanteId);
        if (estado) params.append('estado', estado);
        if (fecha) params.append('fecha_inicio', fecha);
    } else if (type === 'entrevistas') {
        endpoint = '/interviews';
        const fecha = document.getElementById('entrevistas-fecha-filter').value;
        if (fecha) params.append('fecha_inicio', fecha);
    }

    try {
        const results = await apiCall(`${endpoint}?${params.toString()}`);
        if (type === 'postulaciones') {
            // ✨ CAMBIO: Guardamos los resultados para poder filtrarlos localmente.
            window.crmDataStore.postulaciones = results;
            displayPostulacionesTable(results);
        }
        if (type === 'entrevistas') {
            // ✨ CAMBIO: Haremos lo mismo para entrevistas más adelante.
            window.crmDataStore.entrevistas = results;
            displayEntrevistasTable(results);
        }
    } catch (error) {
        document.getElementById(`${type}-table-container`).innerHTML = `<p style="color:red;">Error al aplicar filtros.</p>`;
    }
}


function filterPostulacionesTable() {
    const searchTerm = document.getElementById('postulaciones-search-input').value.toLowerCase();
    const dataToFilter = window.crmDataStore.postulaciones || [];

    const filteredData = dataToFilter.filter(row => {
        return Object.values(row).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });

    displayPostulacionesTable(filteredData);
}


function filterTable(tableType) {
    let searchTerm = '';
    let dataToFilter = [];
    let displayFunction;

    // 1. Configurar según el tipo de tabla
    if (tableType === 'vacancies') {
        searchTerm = document.getElementById('vacancies-search-input').value.toLowerCase();
        dataToFilter = window.crmDataStore.vacancies || [];
        displayFunction = displayVacanciesTable;
    } else if (tableType === 'contratados') {
        searchTerm = document.getElementById('contratados-search-input').value.toLowerCase();
        dataToFilter = window.crmDataStore.contratados || [];
        displayFunction = displayContratadosTable;
    }
    // (Se añadirán más tipos de tabla aquí en pasos futuros)

    if (!dataToFilter) return;

    // 2. Filtrar los datos
    const filteredData = dataToFilter.filter(row => {
        // Busca el término en todos los valores del objeto
        return Object.values(row).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });

    // 3. Volver a mostrar la tabla con los datos filtrados
    displayFunction(filteredData);
}




function displayPostulacionesTable(data) {
    const container = document.getElementById('postulaciones-table-container');
    const headers = ['Candidato (ID)', 'Vacante', 'Empresa', 'Fecha Aplicación', 'Estado', 'Comentarios', 'Acciones'];
    let tableHTML = '<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
    
    if (data.length === 0) {
        tableHTML += `<tr><td colspan="${headers.length}" style="text-align:center;">No se encontraron postulaciones.</td></tr>`;
    } else {
        tableHTML += data.map(p => {
            const encodedComentarios = encodeURIComponent(p.comentarios || '');
            
            // ✨ LÓGICA PARA EL BOTÓN DEL CV ✨
            // Creamos el botón del CV solo si la URL existe.
            const cvButtonHTML = p.cv_url 
                ? `<a href="${p.cv_url}" target="_blank" class="secondary-btn btn" title="Ver CV"><i class="fa-solid fa-file-lines"></i></a>` 
                : `<button class="secondary-btn btn disabled" title="No hay CV disponible" disabled><i class="fa-solid fa-file-excel"></i></button>`;

            return `
                <tr>
                    <td><a href="#" onclick="showCandidateProfile(${p.id_afiliado})">${p.nombre_completo}</a> (ID: ${p.id_afiliado})</td>
                    <td>${p.cargo_solicitado}</td>
                    <td>${p.empresa}</td>
                    <td>${new Date(p.fecha_aplicacion).toLocaleDateString()}</td>
                    <td><span class="status-badge" data-status="${p.estado}">${p.estado}</span></td>
                    <td>
                        ${p.comentarios || ''}
                        <i class="fa-solid fa-pencil" style="cursor:pointer; margin-left:8px; color:var(--text-secondary);" 
                           onclick="openEditCommentsModal(${p.id_postulacion}, '${encodedComentarios}')"></i>
                    </td>
                    <td><div class="actions">
                        ${cvButtonHTML} <!-- ✨ BOTÓN DEL CV AÑADIDO AQUÍ -->
                        <button class="secondary-btn btn" title="Cambiar Estado" onclick="openChangeStatusModal(${p.id_postulacion}, '${p.estado}')"><i class="fa-solid fa-shuffle"></i></button>
                        <button class="primary-btn btn" title="Agendar Entrevista" onclick="openAgendarEntrevistaModal(${p.id_postulacion}, '${p.nombre_completo}')"><i class="fa-solid fa-calendar-plus"></i></button>
                        <button class="btn" style="background-color: var(--danger);" title="Eliminar Postulación" onclick="confirmDeleteApplication(${p.id_postulacion})"><i class="fa-solid fa-trash"></i></button>
                    </div></td>
                </tr>`;
        }).join('');
    }
    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}


// =================================================================
// INSERTAR NUEVA FUNCIÓN
// =================================================================
function filterChatList() {
    const searchTerm = document.getElementById('chat-search-input').value.toLowerCase();
    const chatItems = document.querySelectorAll('#chat-list-container .chat-item');

    chatItems.forEach(item => {
        // Aseguramos que dataset.chatName no sea undefined
        const chatName = (item.dataset.chatName || '').toLowerCase();
        const chatId = (item.dataset.chatId || '');

        // El ID del chat incluye el número, por lo que buscamos en ambos
        if (chatName.includes(searchTerm) || chatId.includes(searchTerm)) {
            item.style.display = 'flex'; // Usamos 'flex' porque es el display por defecto de los items
        } else {
            item.style.display = 'none';
        }
    });
}

function displayEntrevistasTable(data) {
    const container = document.getElementById('entrevistas-table-container');
    const headers = ['Candidato', 'Vacante', 'Empresa', 'Fecha/Hora', 'Entrevistador', 'Observaciones', 'Acciones'];
    let tableHTML = '<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
    if (data.length === 0) {
        tableHTML += '<tr><td colspan="7" style="text-align:center;">No se encontraron entrevistas.</td></tr>';
    } else {
        tableHTML += data.map(e => `
            <tr>
                <td><a href="#" onclick="showCandidateProfile(${e.id_afiliado})">${e.nombre_completo}</a></td>
                <td>${e.cargo_solicitado}</td>
                <td>${e.empresa}</td>
                <td>${new Date(e.fecha_hora).toLocaleString()}</td>
                <td>${e.entrevistador}</td>
                <td>${e.observaciones || ''}</td>
                <td><div class="actions"><button class="primary-btn" style="background-color: var(--success);" title="Marcar como Contratado" onclick="openMarkAsHiredModal(${e.id_afiliado}, ${e.id_vacante})"><i class="fa-solid fa-user-check"></i></button></div></td>
            </tr>`).join('');
    }
    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}



function filterEntrevistasTable() {
    const searchTerm = document.getElementById('entrevistas-search-input').value.toLowerCase();
    const dataToFilter = window.crmDataStore.entrevistas || [];

    const filteredData = dataToFilter.filter(row => {
        return Object.values(row).some(value => 
            String(value).toLowerCase().includes(searchTerm)
        );
    });

    displayEntrevistasTable(filteredData);
}


// EN app.js, REEMPLAZA LA FUNCIÓN showCandidateProfile COMPLETA

async function showCandidateProfile(candidateId) {
    const detailPanel = document.getElementById('candidate-detail-view');
    // Obtenemos el panel desde el que venimos (probablemente 'buscar')
    const searchPanel = document.getElementById('buscar'); 
    
    // Preparamos la vista
    detailPanel.innerHTML = `<div class="spinner"></div>`;
    if(searchPanel) searchPanel.style.display = 'none';
    detailPanel.style.display = 'block';

    try {
        const perfil = await apiCall(`/candidate/profile/${candidateId}`);
        window.crmDataStore.currentProfile = perfil;
        const info = perfil.infoBasica;

        // --- INICIO DEL CÓDIGO DE CONSTRUCCIÓN HTML (SIN CAMBIOS) ---
        const whatsappLink = `https://wa.me/504${String(info.telefono || '').replace(/\s+/g, '')}`;
        const infoBasicaHTML = `
            <div class="candidate-card" style="padding: 25px;">
                <h2 style="font-size:1.8rem;">${info.nombre_completo}</h2>
                <p style="color:var(--text-secondary); margin-bottom:20px;">ID Afiliado: ${info.id_afiliado}</p>
                <p><strong><i class="fa-solid fa-envelope fa-fw"></i> Correo:</strong> ${info.email || 'N/A'}</p>
                <p><strong><i class="fa-solid fa-phone fa-fw"></i> Teléfono:</strong> ${info.telefono || 'N/A'}</p>
                <p><strong><i class="fa-solid fa-location-dot fa-fw"></i> Ciudad:</strong> ${info.ciudad || 'N/A'}</p>
                <p><strong><i class="fa-solid fa-user-graduate fa-fw"></i> Grado:</strong> ${info.grado_academico || 'N/A'}</p>
                <p><strong><i class="fa-solid fa-calendar-alt fa-fw"></i> Registrado:</strong> ${new Date(info.fecha_registro).toLocaleDateString('es-HN')}</p>
                <div class="actions" style="margin-top: 25px; gap: 10px;">
                    <a href="${whatsappLink}" target="_blank" class="primary-btn" style="background-color: #25D366;"><i class="fa-brands fa-whatsapp"></i> Contactar</a>
                    <button class="primary-btn" onclick="openEmailModal(${info.id_afiliado}, '${info.nombre_completo}')"><i class="fa-solid fa-paper-plane"></i> Correo</button>
                    ${info.cv_url ? `<a href="${info.cv_url}" target="_blank" class="secondary-btn"><i class="fa-solid fa-file-lines"></i> Ver CV</a>` : ''}
                </div>
            </div>`;
        
        let postulacionesHTML = perfil.postulaciones.length === 0 ? '<tr><td colspan="4">No hay postulaciones.</td></tr>'
            : perfil.postulaciones.map(p => `<tr><td>${p.cargo_solicitado}</td><td>${p.empresa}</td><td>${new Date(p.fecha_aplicacion).toLocaleDateString()}</td><td><span class="status-badge" data-status="${p.estado}">${p.estado}</span></td></tr>`).join('');
            
        const tagsHTML = `<div class="tag-container">${perfil.tags.map(t => `<span class="tag">${t.nombre_tag} <i class="fa-solid fa-times remove-tag" onclick="removeTagFromCandidate(${info.id_afiliado}, ${t.id_tag})"></i></span>`).join('')} <span class="tag add-new-tag" onclick="openAddTagToCandidateModal(${info.id_afiliado})"><i class="fa-solid fa-plus"></i> Añadir</span></div>`;
        
        detailPanel.innerHTML = `
            <div class="panel-header">
                <h1>Perfil del Candidato</h1>
                <button class="secondary-btn" onclick="goBackToSearch()"><i class="fa-solid fa-arrow-left"></i> Volver a Búsqueda</button>
            </div>
            <div style="display: grid; grid-template-columns: 450px 1fr; gap: 25px; align-items: flex-start; padding: 20px;">
                <div>
                    ${infoBasicaHTML}
                    <div class="candidate-card" style="margin-top: 20px; padding: 25px;"><h3><i class="fa-solid fa-tags"></i> Etiquetas</h3>${tagsHTML}</div>
                </div>
                <div class="candidate-card">
                    <h3><i class="fa-solid fa-file-invoice"></i> Historial de Postulaciones</h3>
                    <div style="overflow-x: auto; margin-top: 15px;">
                        <table>
                            <thead><tr><th>Vacante</th><th>Empresa</th><th>Fecha</th><th>Estado</th></tr></thead>
                            <tbody>${postulacionesHTML}</tbody>
                        </table>
                    </div>
                </div>
            </div>`;
        // --- FIN DEL CÓDIGO DE CONSTRUCCIÓN HTML ---

    } catch (error) {
        detailPanel.innerHTML = `<p style="color:red;">No se pudo cargar el perfil del candidato.</p>`;
    }
}

// AÑADE ESTE BLOQUE de 2 funciones nuevas justo después de 'showCandidateProfile'

function openChangeStatusModal(postulacionId, currentStatus) {
    const statuses = ['Recibida', 'En Revisión', 'Pre-seleccionado', 'En Entrevista', 'Oferta', 'Contratado', 'Rechazado'];
    let optionsHTML = statuses.map(s => `<option value="${s}" ${s === currentStatus ? 'selected' : ''}>${s}</option>`).join('');

    const content = `
        <p>Selecciona el nuevo estado para la postulación ID: <strong>${postulacionId}</strong>.</p>
        <select id="modal-new-status-select">${optionsHTML}</select>
    `;
    showModal('Cambiar Estado de Postulación', content, [
        { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
        { label: 'Actualizar Estado', class: 'primary-btn', handler: `submitStatusChange(${postulacionId})` }
    ]);
}

async function submitStatusChange(postulacionId) {
    const nuevoEstado = document.getElementById('modal-new-status-select').value;
    try {
        // Reutilizamos el endpoint que ya usa el pipeline
        const response = await apiCall(`/applications/${postulacionId}/status`, 'PUT', { estado: nuevoEstado });
        closeModal();
        showToast(response.message, 'success');
        applyTableFilters('postulaciones'); // Recargar la tabla
    } catch (error) {
        // apiCall maneja el error
    }
}

// AÑADE este nuevo bloque de 2 funciones justo después de 'submitStatusChange'

function confirmDeleteApplication(postulacionId) {
    if (confirm("¿Estás seguro de que deseas eliminar esta postulación? Esta acción es permanente y también borrará las entrevistas asociadas.")) {
        deleteApplication(postulacionId);
    }
}



async function deleteApplication(postulacionId) {
    try {
        const response = await apiCall(`/applications/${postulacionId}`, 'DELETE');
        showToast(response.message, 'success');
        applyTableFilters('postulaciones'); // Recargar la tabla
    } catch (error) {
        // apiCall maneja el error
    }
}

// AÑADE ESTE BLOQUE DE 2 FUNCIONES NUEVAS DEBAJO DE 'deleteApplication'

// REEMPLAZA ESTA FUNCIÓN EN app.js

/**
 * Abre un modal para editar los comentarios de una postulación.
 * @param {number} postulationId - El ID de la postulación.
 * @param {string} currentCommentsEncoded - Los comentarios actuales, codificados para URL.
 */
function openEditCommentsModal(postulationId, currentCommentsEncoded) {
    // Decodificamos los comentarios para mostrarlos correctamente en el textarea.
    const currentComments = decodeURIComponent(currentCommentsEncoded);
    const content = `
        <p>Editando comentarios para la postulación ID: <strong>${postulationId}</strong>.</p>
        <textarea id="modal-comments-editor" class="obs-box" style="width:100%; margin-top:10px;" rows="5">${currentComments}</textarea>
    `;
    // ✨ CAMBIO CLAVE: El `handler` del botón ahora llama a la función de guardado con el ID correcto.
    showModal('Editar Comentarios de Postulación', content, [
        { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
        { label: 'Guardar Cambios', class: 'primary-btn', handler: `submitCommentsChange(${postulationId})` }
    ]);
}

// REEMPLAZA ESTA FUNCIÓN EN app.js

/**
 * Envía los nuevos comentarios al backend.
 * @param {number} postulationId - El ID de la postulación a actualizar.
 */
async function submitCommentsChange(postulationId) {
    // Leemos el valor directamente del textarea del modal.
    const nuevosComentarios = document.getElementById('modal-comments-editor').value;
    try {
        // La llamada a la API ahora es correcta, con el endpoint y el método PUT.
        const response = await apiCall(`/applications/${postulationId}/comments`, 'PUT', { comentarios: nuevosComentarios });
        closeModal();
        showToast(response.message, 'success');
        // Recargamos la tabla para ver el cambio reflejado.
        applyTableFilters('postulaciones'); 
    } catch (error) {
        // apiCall ya se encarga de mostrar el error en un toast si algo sale mal.
    }
}



function goBackToSearch() {
    const detailPanel = document.getElementById('candidate-detail-view');
    const searchPanel = document.getElementById('buscar');
    if (detailPanel) detailPanel.style.display = 'none';
    if (searchPanel) searchPanel.style.display = 'block';
}


async function showVacancyPipeline(vacancyId) {
    window.crmDataStore.currentVacancyId = vacancyId;
    const pipelinePanel = document.getElementById('vacancy-pipeline-view');
    const vacanciesPanel = document.getElementById('vacantes'); // Obtenemos el panel de vacantes
    const allPanels = document.querySelectorAll('.panel'); // Obtenemos todos los paneles

    // Preparamos la vista: mostramos spinner y gestionamos la visibilidad de los paneles
    pipelinePanel.innerHTML = `<div class="spinner"></div>`;

    // Ocultamos todos los paneles "principales"
    allPanels.forEach(p => {
        if (p.id !== 'vacancy-pipeline-view' && p.id !== 'candidate-detail-view') { // No ocultamos nuestros paneles virtuales
             // Si estás usando la lógica de clases 'active', esta línea sería necesaria:
             // p.classList.remove('active');
        }
    });

    // ✨ LÓGICA DE VISIBILIDAD CORREGIDA ✨
    // Ocultamos el panel de vacantes y mostramos el del pipeline
    if(vacanciesPanel) vacanciesPanel.style.display = 'none';
    pipelinePanel.style.display = 'block';


    try {
        const pipelineData = await apiCall(`/vacancies/${vacancyId}/pipeline`);
        const vacancyInfo = (window.crmDataStore.vacancies || []).find(v => v.id_vacante === vacancyId);
        
        // --- INICIO DEL CÓDIGO DE CONSTRUCCIÓN HTML (SIN CAMBIOS) ---
        let pipelineHTML = `<div class="panel-header"><h1>Pipeline: ${vacancyInfo?.cargo_solicitado || ''}</h1><button class="secondary-btn" onclick="goBackToVacancies()"><i class="fa-solid fa-arrow-left"></i> Volver a Vacantes</button></div>`;
        pipelineHTML += `<div class="pipeline-container">`;
        const columns = ['Recibida', 'En Revisión', 'Pre-seleccionado', 'En Entrevista', 'Oferta', 'Contratado', 'Rechazado'];
        
        columns.forEach(colName => {
            const cards = pipelineData[colName] || [];
            pipelineHTML += `
                <div class="pipeline-column" id="col-${colName.replace(/\s+/g, '-')}" ondragover="handleDragOver(event)" ondrop="handleDrop(event, '${colName}')">
                    <h3>${colName} (${cards.length})</h3>
                    <div class="pipeline-cards">
                        ${cards.map(card => {
                            const cvLinkHTML = card.cv_url 
                                ? `<a href="${card.cv_url}" target="_blank" class="pipeline-card-action" title="Ver CV" onclick="event.stopPropagation();"><i class="fa-solid fa-file-lines"></i></a>` 
                                : '';

                            return `
                                <div class="pipeline-card" draggable="true" id="card-${card.id_postulacion}" ondragstart="handleDragStart(event, ${card.id_postulacion})">
                                    <strong>${card.nombre_completo}</strong>
                                    <div class="pipeline-card-footer">
                                        <span class="card-id">ID: ${card.id_postulacion}</span>
                                        <div class="card-actions">
                                            ${cvLinkHTML}
                                            <span class="pipeline-card-action" title="Ver Perfil Completo" onclick="event.stopPropagation(); showCandidateProfile(${card.id_afiliado});"><i class="fa-solid fa-user"></i></span>
                                        </div>
                                    </div>
                                -</div>`;
                        }).join('')}
                    </div>
                </div>`;
        });
        pipelineHTML += `</div>`;
        // --- FIN DEL CÓDIGO DE CONSTRUCCIÓN HTML ---

        pipelinePanel.innerHTML = pipelineHTML;
    } catch (error) {
        pipelinePanel.innerHTML = `<div class="panel-header"><h1>Pipeline</h1><button class="secondary-btn" onclick="goBackToVacancies()">Volver</button></div><p style="color:red; padding: 20px;">No se pudo cargar el pipeline.</p>`;
    }
}



function goBackToVacancies() {
    const pipelinePanel = document.getElementById('vacancy-pipeline-view');
    const vacanciesPanel = document.getElementById('vacantes');
    if(pipelinePanel) pipelinePanel.style.display = 'none';
    if(vacanciesPanel) vacanciesPanel.style.display = 'block';
}

function handleDragStart(event, postulationId) { event.dataTransfer.setData("text/plain", postulationId); event.currentTarget.classList.add('dragging'); }
function handleDragOver(event) { event.preventDefault(); event.currentTarget.classList.add('over'); }
document.addEventListener('dragleave', (event) => { if (event.target.classList.contains('pipeline-column')) event.target.classList.remove('over'); });
document.addEventListener('dragend', () => document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging')));

async function handleDrop(event, newStatus) {
    event.preventDefault();
    const column = event.currentTarget;
    column.classList.remove('over');
    const postulationId = event.dataTransfer.getData("text/plain");
    const cardElement = document.getElementById(`card-${postulationId}`);
    column.querySelector('.pipeline-cards').appendChild(cardElement);
    try {
        await apiCall(`/applications/${postulationId}/status`, 'PUT', { estado: newStatus });
        showToast(`Candidato movido a "${newStatus}".`, 'success');
        showVacancyPipeline(window.crmDataStore.currentVacancyId);
    } catch (error) {
        showToast(`No se pudo mover al candidato.`, 'error');
        showVacancyPipeline(window.crmDataStore.currentVacancyId);
    }
}

function showModal(title, content, actions = []) {
    const container = document.getElementById('modal-container');
    let actionButtons = actions.map(a => `<button class="${a.class || 'primary-btn'}" onclick="${a.handler}">${a.label}</button>`).join('');
    container.innerHTML = `<div class="modal-backdrop" id="modal-backdrop-id" onclick="closeModal()">
        <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header"><h2>${title}</h2><button class="close-modal" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">${content}</div>
            <div class="modal-actions">${actionButtons}</div>
        </div></div>`;
    container.querySelector('.modal-backdrop').style.display = 'flex';
}

function closeModal() { 
    const modal = document.getElementById('modal-backdrop-id');
    if (modal) { modal.remove(); }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.dataset.type = type;
    toast.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${message}`;
    if (type === 'error') { toast.innerHTML = `<i class="fa-solid fa-xmark-circle"></i> ${message}`; }
    if (type === 'info') { toast.innerHTML = `<i class="fa-solid fa-info-circle"></i> ${message}`; }
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

async function openEmailModal(candidateId, candidateName) {
    try {
        const templates = await apiCall('/templates');
        const options = templates.map(t => `<option value="${t.id_template}">${t.nombre_plantilla}</option>`).join('');
        const content = `<p>Enviando correo a <strong>${candidateName}</strong>.</p>
                         <label for="email-template-select">Seleccionar Plantilla:</label>
                         <select id="email-template-select">${options}</select>`;
        showModal('Enviar Correo', content, [
            { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
            { label: 'Enviar', class: 'primary-btn', handler: `executeSendEmail(${candidateId})` }
        ]);
    } catch (error) {
        showToast('No se pudieron cargar las plantillas de correo.', 'error');
    }
}

async function executeSendEmail(candidateId) {
    const templateId = document.getElementById('email-template-select').value;
    try {
        const response = await apiCall('/communications/send-email', 'POST', { id_afiliado: candidateId, id_template: templateId });
        closeModal();
        showToast(response.message, 'success');
    } catch (error) { /* Ya manejado */ }
}

async function openAddTagToCandidateModal(candidateId) {
    try {
        const allTags = await apiCall('/tags');
        const candidateTags = window.crmDataStore.currentProfile.tags.map(t => t.id_tag);
        const availableTags = allTags.filter(tag => !candidateTags.includes(tag.id_tag));
        if (availableTags.length === 0) {
            showToast('Este candidato ya tiene todas las etiquetas disponibles.', 'info');
            return;
        }
        const options = availableTags.map(t => `<option value="${t.id_tag}">${t.nombre_tag}</option>`).join('');
        const content = `<label for="tag-select">Seleccionar etiqueta para añadir:</label><select id="tag-select">${options}</select>`;
        showModal('Añadir Etiqueta', content, [
            { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
            { label: 'Añadir', class: 'primary-btn', handler: `submitTagToCandidate(${candidateId})` }
        ]);
    } catch (error) {
        showToast('No se pudieron cargar las etiquetas.', 'error');
    }
}

async function submitTagToCandidate(candidateId) {
    const tagId = document.getElementById('tag-select').value;
    try {
        await apiCall(`/candidate/${candidateId}/tags`, 'POST', { id_tag: tagId });
        closeModal();
        showToast('Etiqueta añadida.', 'success');
        showCandidateProfile(candidateId);
    } catch (error) { /* Ya manejado */ }
}

async function removeTagFromCandidate(candidateId, tagId) {
    try {
        await apiCall(`/candidate/${candidateId}/tags`, 'DELETE', { id_tag: tagId });
        showToast('Etiqueta eliminada.', 'success');
        showCandidateProfile(candidateId);
    } catch (error) { /* Ya manejado */ }
}

function openAddClientModal() {
    const content = `<input type="text" id="modal-client-empresa" placeholder="Nombre de la Empresa"><input type="text" id="modal-client-contacto" placeholder="Nombre del Contacto"><input type="text" id="modal-client-telefono" placeholder="Teléfono"><input type="email" id="modal-client-email" placeholder="Correo Electrónico"><input type="text" id="modal-client-sector" placeholder="Sector"><textarea id="modal-client-observaciones" placeholder="Observaciones" rows="3"></textarea>`;
    showModal('Agregar Nuevo Cliente', content, [
        { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
        { label: 'Guardar Cliente', class: 'primary-btn', handler: 'submitNewClient()' }
    ]);
}

async function submitNewClient() {
    const data = {
        empresa: document.getElementById('modal-client-empresa').value,
        contacto_nombre: document.getElementById('modal-client-contacto').value,
        telefono: document.getElementById('modal-client-telefono').value,
        email: document.getElementById('modal-client-email').value,
        sector: document.getElementById('modal-client-sector').value,
        observaciones: document.getElementById('modal-client-observaciones').value,
    };
    if (!data.empresa) { showToast('El nombre de la empresa es obligatorio.', 'error'); return; }
    try {
        const response = await apiCall('/clients', 'POST', data);
        closeModal();
        showToast(response.message, 'success');
        renderClientsView();
    } catch (error) { /* Ya manejado */ }
}

async function openAddVacancyModal() {
    try {
        const clients = await apiCall('/clients');
        if (clients.length === 0) {
            showToast('Debe crear un cliente primero.', 'info');
            return;
        }
        const clientOptions = clients.map(c => `<option value="${c.id_cliente}">${c.empresa}</option>`).join('');
        const content = `<select id="modal-vacancy-client">${clientOptions}</select><input type="text" id="modal-vacancy-cargo" placeholder="Cargo Solicitado"><input type="text" id="modal-vacancy-ciudad" placeholder="Ciudad"><input type="text" id="modal-vacancy-salario" placeholder="Salario (opcional)"><textarea id="modal-vacancy-requisitos" placeholder="Requisitos de la vacante" rows="4"></textarea>`;
        showModal('Crear Nueva Vacante', content, [
            { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
            { label: 'Crear Vacante', class: 'primary-btn', handler: 'submitNewVacancy()' }
        ]);
    } catch (error) {
        showToast('No se pudieron cargar los clientes.', 'error');
    }
}

async function submitNewVacancy() {
    const data = {
        id_cliente: document.getElementById('modal-vacancy-client').value,
        cargo_solicitado: document.getElementById('modal-vacancy-cargo').value,
        ciudad: document.getElementById('modal-vacancy-ciudad').value,
        salario: document.getElementById('modal-vacancy-salario').value,
        requisitos: document.getElementById('modal-vacancy-requisitos').value,
    };
    if (!data.id_cliente || !data.cargo_solicitado) { showToast('El cliente y el cargo son obligatorios.', 'error'); return; }
    try {
        const response = await apiCall('/vacancies', 'POST', data);
        closeModal();
        showToast(response.message, 'success');
        renderVacanciesView();
    } catch (error) { /* Ya manejado */ }
}

async function openAgendarEntrevistaModal(postulationId, candidateName) {
    const content = `
        <p>Agendando entrevista para <strong>${candidateName}</strong>.</p>
        <label>Fecha y Hora:</label><input type="datetime-local" id="modal-entrevista-fecha">
        <label>Entrevistador:</label><input type="text" id="modal-entrevista-entrevistador" placeholder="Nombre del entrevistador">
        <label>Observaciones (Enlace Meet, etc.):</label><textarea id="modal-entrevista-observaciones" rows="3"></textarea>
    `;
    showModal('Agendar Nueva Entrevista', content, [
        { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
        { label: 'Agendar', class: 'primary-btn', handler: `submitNewInterview(${postulationId})` }
    ]);
}


// En script.js, reemplaza esta función completa
async function submitNewInterview(postulationId) {
    const data = {
        id_postulacion: postulationId,
        fecha_hora: document.getElementById('modal-entrevista-fecha').value,
        entrevistador: document.getElementById('modal-entrevista-entrevistador').value,
        observaciones: document.getElementById('modal-entrevista-observaciones').value,
    };
    if (!data.fecha_hora || !data.entrevistador) { 
        showToast('La fecha y el entrevistador son obligatorios.', 'error'); 
        return; 
    }

    try {
        const response = await apiCall('/interviews', 'POST', data);
        closeModal();
        showToast(response.message, 'success');
        
        if (response.success) {
            // Lógica de envío de tarea por WebSocket
            if (response.whatsapp_task) {
                if (window.waChatSocket && window.waChatSocket.readyState === WebSocket.OPEN) {
                    console.log("Enviando tarea de ENTREVISTA vía WebSocket:", response.whatsapp_task);
                    window.waChatSocket.send(JSON.stringify({
                        action: 'queue_notification_task',
                        task: response.whatsapp_task
                    }));
                } else {
                    showToast('Notificación no enviada: El puente de WhatsApp no está conectado.', 'error');
                }
            }

            // Lógica de actualización instantánea de la UI
            if (document.getElementById('postulaciones').style.display === 'block' && window.crmDataStore.postulaciones) {
                const postulacionAActualizar = window.crmDataStore.postulaciones.find(p => p.id_postulacion === postulationId);
                if (postulacionAActualizar) {
                    postulacionAActualizar.estado = 'En Entrevista';
                    displayPostulacionesTable(window.crmDataStore.postulaciones);
                }
            }
            
            if (document.getElementById('entrevistas').style.display === 'block') {
                applyTableFilters('entrevistas');
            }
        }
    } catch (error) { 
        // apiCall ya maneja el error
    }
}

async function openMarkAsHiredModal(afiliadoId, vacanteId) {
    const content = `
        <p>Por favor, confirma los datos financieros para esta contratación.</p>
        <div style="display: flex; flex-direction: column; gap: 15px; margin-top: 15px;">
            <div>
                <label>Salario Final del Candidato:</label>
                <input type="text" id="modal-salario-final" placeholder="Ej: 15000">
            </div>
            <div>
                <label>Tarifa del Servicio (Costo total a facturar):</label>
                <input type="text" id="modal-tarifa-servicio" placeholder="Ej: 8000">
            </div>
        </div>
    `;
    showModal('Confirmar Contratación', content, [
        { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
        { label: 'Confirmar Contratación', class: 'primary-btn', handler: `submitHired(${afiliadoId}, ${vacanteId})` }
    ]);
}


// En script.js, reemplaza esta función completa
async function submitHired(afiliadoId, vacanteId) {
    const data = {
        id_afiliado: parseInt(afiliadoId, 10),
        id_vacante: parseInt(vacanteId, 10),
        salario_final: document.getElementById('modal-salario-final').value,
        tarifa_servicio: document.getElementById('modal-tarifa-servicio').value
    };

    if (!data.salario_final || !data.tarifa_servicio) { 
        showToast('El salario final y la tarifa del servicio son requeridos.', 'error'); 
        return; 
    }
    
    try {
        const response = await apiCall('/hired', 'POST', data);
        closeModal();
        showToast(response.message, 'success');

        if (response.success) {
            // Lógica de envío de tarea por WebSocket
            if (response.whatsapp_task) {
                if (window.waChatSocket && window.waChatSocket.readyState === WebSocket.OPEN) {
                    console.log("Enviando tarea de CONTRATACIÓN vía WebSocket:", response.whatsapp_task);
                    window.waChatSocket.send(JSON.stringify({
                        action: 'queue_notification_task',
                        task: response.whatsapp_task
                    }));
                } else {
                    showToast('Notificación no enviada: El puente de WhatsApp no está conectado.', 'error');
                }
            }

            // Lógica de actualización instantánea de la UI
            renderContratadosView();

            if (document.getElementById('postulaciones').style.display === 'block' && window.crmDataStore.postulaciones) {
                const postulacionAActualizar = window.crmDataStore.postulaciones.find(p => p.id_afiliado === data.id_afiliado && p.id_vacante === data.id_vacante);
                if (postulacionAActualizar) {
                    postulacionAActualizar.estado = 'Contratado';
                    displayPostulacionesTable(window.crmDataStore.postulaciones);
                }
            }
        }
    } catch(error) { 
        // apiCall ya maneja el error
    }
}

function openAddTemplateModal() {
    const content = `<input type="text" id="modal-template-nombre" placeholder="Nombre de la Plantilla (ej. 'Invitación Entrevista')"><input type="text" id="modal-template-asunto" placeholder="Asunto del Correo (use [name] para el nombre)"><textarea id="modal-template-cuerpo" placeholder="Cuerpo del correo en HTML. Use [name] para el nombre del candidato." rows="8"></textarea>`;
    showModal('Crear Nueva Plantilla de Correo', content, [
        { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
        { label: 'Guardar Plantilla', class: 'primary-btn', handler: 'submitNewTemplate()' }
    ]);
}

async function submitNewTemplate() {
    const data = {
        nombre_plantilla: document.getElementById('modal-template-nombre').value,
        asunto: document.getElementById('modal-template-asunto').value,
        cuerpo_html: document.getElementById('modal-template-cuerpo').value,
    };
    if (!data.nombre_plantilla || !data.asunto || !data.cuerpo_html) { showToast('Todos los campos son obligatorios.', 'error'); return; }
    try {
        const response = await apiCall('/templates', 'POST', data);
        closeModal();
        showToast(response.message, 'success');
        renderSettingsView();
    } catch (error) { /* Ya manejado */ }
}

function downloadTemplate() {
    const type = document.getElementById('upload-type-select').value;
    window.location.href = `${API_BASE_URL}/download-template?type=${type}`;
}

async function uploadExcelFile() {
    const fileInput = document.getElementById('excel-upload-input');
    if (fileInput.files.length === 0) {
        showToast('Por favor, selecciona un archivo Excel primero.', 'info');
        return;
    }
    const file = fileInput.files[0];
    const type = document.getElementById('upload-type-select').value;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    try {
        const response = await apiCall('/upload-excel', 'POST', formData);
        showToast(response.message, 'success');
        fileInput.value = ''; // Limpiar el input
    } catch (error) {
        // El error ya es manejado por la función apiCall

    }
}



// =================================================================
// --- SECCIÓN 8: LÓGICA DE WHATSAPP Y PANEL DE CONTROL (UNIFICADO) ---
// =================================================================

let activeChatId = null; // Guardará el ID del chat que estamos viendo

// -----------------------------------------------------------------
// --- PARTE A: LÓGICA DEL CHAT MANUAL DE WHATSAPP ---
// -----------------------------------------------------------------

/**
 * Función de ayuda para sincronizar la UI del panel de chat (estado y botón)
 * con el estado real de la conexión WebSocket.
 */
function updateChatConnectionStatus() {
    const statusSpan = document.getElementById('wa-connection-status');
    const connectBtn = document.getElementById('wa-connect-btn');
    
    if (!statusSpan || !connectBtn) return;

    if (!window.waChatSocket) {
        statusSpan.textContent = 'Desconectado';
        statusSpan.className = 'disconnected';
        connectBtn.textContent = 'Conectar';
        connectBtn.disabled = false;
        connectBtn.onclick = () => initializeWhatsAppChatLogic(true);
        return;
    }

    switch (window.waChatSocket.readyState) {
        case WebSocket.CONNECTING:
            statusSpan.textContent = 'Conectando...';
            statusSpan.className = 'connecting';
            connectBtn.textContent = 'Conectando...';
            connectBtn.disabled = true;
            break;
        case WebSocket.OPEN:
            statusSpan.textContent = 'Conectado';
            statusSpan.className = 'connected';
            connectBtn.textContent = 'Conectado';
            connectBtn.disabled = true;
            break;
        case WebSocket.CLOSING:
            statusSpan.textContent = 'Desconectando...';
            statusSpan.className = 'disconnecting';
            connectBtn.disabled = true;
            break;
        case WebSocket.CLOSED:
            statusSpan.textContent = 'Desconectado';
            statusSpan.className = 'disconnected';
            connectBtn.textContent = 'Reconectar';
            connectBtn.disabled = false;
            connectBtn.onclick = () => initializeWhatsAppChatLogic(true);
            break;
    }
}

/**
 * Construye la estructura principal de la vista de chat con el nuevo diseño moderno,
 * sin eliminar ninguna funcionalidad del CRM original.
 */
function renderWhatsappChatView() {
    const panel = document.getElementById('whatsapp_chat');
    const isAlreadyRendered = panel.querySelector('.app-container');

    if (!isAlreadyRendered) {
        panel.innerHTML = `
            <div class="app-container chat-layout">
                <!-- Sidebar de chats -->
                <div class="chat-sidebar">
                    <div class="sidebar-header">
                        <h3><i class="fa-solid fa-comment-dots"></i> Conversaciones</h3>
                        <div class="search-container">
                            <i class="fas fa-search"></i>
                            <input type="search" id="chat-search-input" placeholder="Buscar conversaciones...">
                        </div>
                        <div id="wa-connection-status-panel" class="status-indicator">
                            <div id="wa-connection-status-dot" class="status-dot" style="background:var(--danger);"></div>
                            <span id="wa-connection-status">Desconectado</span>
                        </div>
                    </div>
                    <div id="chat-tag-filters"></div>
                    <div id="chat-list-container" class="chat-list-container">
                        <div class="spinner"></div>
                    </div>
                </div>
                
                <!-- Área de chat principal -->
                <div class="main-chat-area">
                    <div class="conversation-header" id="conversation-header">
                        <p style="text-align: center; color: var(--text-light); margin: auto;">Selecciona un chat para ver la conversación</p>
                    </div>
                    <div class="messages-container" id="messages-container"></div>
                    <div class="message-input-area" id="message-input-area" style="display:none;">
                        <div class="suggestion-container">
                           <input type="text" id="message-text-input" class="message-input" placeholder="Escribe un mensaje..." autocomplete="off">
                           <input type="text" id="suggestion-input" class="message-input" style="position: absolute; top: 0; left: 0; z-index: -1; background-color: transparent; color: #a0a0a0;" disabled>
                        </div>
                        <button class="send-button" id="send-message-btn" onclick="sendMessage()">
                            <i class="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Panel de contexto -->
                <div class="context-panel" id="chat-context-panel">
                     <p style="text-align: center; color: var(--text-light); margin: auto;">La información del contacto aparecerá aquí</p>
                </div>
            </div>
        `;
        document.getElementById('chat-search-input').addEventListener('keyup', filterChatList);
    }
    
    updateChatConnectionStatus();
    loadChatList();
    loadTagFilters();
}

function createOrUpdateChatItem(chatData, insertionMethod = 'prepend') {
    const container = document.getElementById('chat-list-container');
    if (!container) return null;

    let chatItem = document.querySelector(`.chat-item[data-chat-id="${chatData.id}"]`);
    if (chatItem) chatItem.remove();

    chatItem = document.createElement('div');
    chatItem.className = 'chat-item'; // Clase principal
    if (activeChatId === chatData.id) chatItem.classList.add('active');
    
    chatItem.dataset.chatId = chatData.id;
    const displayName = chatData.custom_name || chatData.name || 'Desconocido';
    chatItem.dataset.chatName = displayName;
    
    const initials = getInitials(displayName);
    const avatarColor = getAvatarColor(displayName);
    const time = chatData.last_message_timestamp ? new Date(chatData.last_message_timestamp * 1000).toLocaleTimeString('es-HN', { hour: 'numeric', minute: '2-digit' }) : '';
    const unreadCount = chatData.unread_count || 0;
    
    // Esta estructura HTML está diseñada para que el CSS funcione correctamente
    chatItem.innerHTML = `
        <div class="chat-avatar" style="background: ${avatarColor};">
            <span>${initials}</span>
        </div>

        <div class="chat-info">
            <div class="chat-info-top">
                <span class="chat-name">${displayName}</span>
                <span class="chat-time">${time}</span>
            </div>
            <div class="chat-info-bottom">
                <span class="chat-preview">${chatData.lastMessage || '[Mensaje multimedia]'}</span>
                ${unreadCount > 0 ? `<div class="unread-count">${unreadCount}</div>` : ''}
            </div>
        </div>
    `;
    
    chatItem.addEventListener('click', () => handleChatClick(chatItem));
    
    if (insertionMethod === 'append') {
        container.appendChild(chatItem);
    } else {
        container.prepend(chatItem);
    }
    return chatItem;
}


async function loadChatList() {
    const chatListContainer = document.getElementById('chat-list-container');
    if (!chatListContainer) return;

    try {
        // ✨ LÓGICA MEJORADA: El endpoint ahora necesita devolver si el último mensaje fue del reclutador.
        // Esto requiere un cambio en bridge.js que haremos ahora.
        const response = await fetch(`${NODE_API_URL}/api/crm/chats`);
        if (!response.ok) {
            throw new Error('El puente de comunicación no está listo. Conéctalo primero.');
        }
        const chats = await response.json();
        chatListContainer.innerHTML = '';

        if (chats.length === 0) {
            chatListContainer.innerHTML = '<p style="padding: 15px; text-align: center; color: var(--text-secondary);">No hay conversaciones guardadas.</p>';
            return;
        }

        chats.forEach(chat => createOrUpdateChatItem(chat, 'append'));

        // ✨ NUEVO: Llamamos a la función que actualiza los indicadores ⏳ después de renderizar la lista.
        updateFollowUpIndicators();

    } catch (error) {
        console.error('Error al cargar lista de chats:', error);
        if (chatListContainer) {
            chatListContainer.innerHTML = `<p style="padding: 15px; text-align: center; color: var(--danger);">${error.message}</p>`;
        }
    }
}



/**
 * Carga la conversación y el panel de contexto con el nuevo diseño,
 * funcionalidad completa y TODA la información del afiliado.
 */
async function loadConversation(chatId, chatName) {
    activeChatId = chatId;
    
    const headerContainer = document.getElementById('conversation-header');
    const messagesContainer = document.getElementById('messages-container');
    const inputArea = document.getElementById('message-input-area');
    const contextPanel = document.getElementById('chat-context-panel');

    headerContainer.innerHTML = '<div class="spinner"></div>';
    messagesContainer.innerHTML = '';
    contextPanel.innerHTML = '<div class="spinner"></div>';
    inputArea.style.display = 'flex';

    try {
        const conversationData = await fetch(`${NODE_API_URL}/api/crm/conversations/${chatId}`).then(res => res.json());
        
        const displayName = conversationData.custom_name || conversationData.contact_name || 'Desconocido';
        const initials = getInitials(displayName);
        const avatarColor = getAvatarColor(displayName);

        const botControlButtonsHTML = conversationData.bot_active
            ? `<button class="btn" id="disable-bot-btn" title="Pausar Respuestas Automáticas" onclick="disableBotForChat('${chatId}')"><i class="fas fa-robot"></i></button>`
            : `<button class="btn primary" id="enable-bot-btn" title="Reactivar Respuestas Automáticas" onclick="enableBotForChat('${chatId}')"><i class="fas fa-robot"></i></button>`;

        headerContainer.innerHTML = `
            <div class="contact-info">
                <div class="chat-avatar" style="background: ${avatarColor};"><span>${initials}</span></div>
                <div>
                    <div class="contact-name">${displayName}</div>
                    <div class="contact-status">${(conversationData.status || '').replace(/_/g, ' ')}</div>
                </div>
            </div>
            <div class="header-actions">
                ${botControlButtonsHTML}
                <button class="btn" onclick="openChatContextModal('${chatId}')" title="Editar Contexto"><i class="fas fa-pencil-alt"></i></button>
            </div>
        `;

        messagesContainer.innerHTML = '';
        conversationData.messages.forEach(msg => {
            const el = document.createElement('div');
            el.className = `message-bubble ${msg.from_me ? 'sent' : 'received'}`;
            el.textContent = msg.body;
            messagesContainer.appendChild(el);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        if (conversationData.status === 'AFFILIATE_LOGGED_IN' && conversationData.known_identity) {
            const crmContext = await fetch(`${NODE_API_URL}/api/crm/chat_context/${conversationData.known_identity}`).then(res => res.json());
            const info = crmContext.info_basica;
            const postulaciones = crmContext.ultimas_postulaciones;
            
            let postulacionesHTML = postulaciones.length > 0
                ? postulaciones.map(p => `
                    <div class="postulation-item">
                        <div class="info-row"><div class="info-label">Cargo</div><div class="info-value">${p.cargo_solicitado}</div></div>
                        <div class="info-row"><div class="info-label">Estado</div><div class="info-value"><span class="status-badge" data-status="${p.estado}">${p.estado}</span></div></div>
                    </div>`).join('')
                : '<p class="info-value">No tiene postulaciones recientes.</p>';

            contextPanel.innerHTML = `
                <div class="panel-header"><div class="panel-title">Información del Afiliado</div></div>
                <div class="context-card">
                    <div class="card-header"><i class="fas fa-user-check"></i><div class="card-title">Detalles del Contacto</div></div>
                    <div class="info-row"><div class="info-label">Nombre</div><div class="info-value">${info.nombre_completo || 'N/A'}</div></div>
                    <div class="info-row"><div class="info-label">Identidad</div><div class="info-value">${info.identidad || 'N/A'}</div></div>
                    <div class="info-row"><div class="info-label">Estado</div><div class="info-value">Afiliado Verificado</div></div>
                    <div class="info-row"><div class="info-label">Teléfono</div><div class="info-value">${info.telefono || 'N/A'}</div></div>
                    <div class="info-row"><div class="info-label">Ubicación</div><div class="info-value">${info.ciudad || 'N/A'}</div></div>
                </div>
                <div class="context-card">
                    <div class="card-header"><i class="fas fa-briefcase"></i><div class="card-title">Acciones Rápidas</div></div>
                    <button class="action-button primary" onclick="openPostulacionModal(${info.id_afiliado}, '${info.nombre_completo}')"><i class="fas fa-paper-plane"></i>Postular a Vacante</button>
                    <button class="action-button" onclick="showCandidateProfile(${info.id_afiliado})"><i class="fas fa-eye"></i>Ver Perfil Completo</button>
                </div>
                <div class="context-card">
                    <div class="card-header"><i class="fas fa-file-lines"></i><div class="card-title">Postulaciones</div></div>
                    ${postulacionesHTML}
                </div>
            `;
        } else {
            contextPanel.innerHTML = `
                <div class="panel-header"><div class="panel-title">Información del Contacto</div></div>
                <div class="context-card">
                    <div class="card-header"><i class="fas fa-user-plus"></i><div class="card-title">Nuevo Contacto</div></div>
                    <p class="info-value">Este usuario aún no ha sido verificado como afiliado en el sistema.</p>
                </div>`;
        }
        setupCopilotListeners();
    } catch (error) {
        console.error("Error al cargar la conversación:", error);
        headerContainer.innerHTML = `<span>Error</span>`;
        contextPanel.innerHTML = `<p style="color:red;">Error al cargar contexto.</p>`;
    }
}

async function sendMessage() {
    const messageInput = document.getElementById('message-text-input');
    const message = messageInput.value.trim();

    if (!message || !activeChatId) {
        return; // No hacer nada si no hay mensaje o chat activo
    }

    // Desactivamos los controles para evitar envíos duplicados
    messageInput.disabled = true;
    document.getElementById('send-message-btn').disabled = true;

    try {
        // Llamamos al endpoint que acabamos de modificar en bridge.js
        const response = await fetch(`${NODE_API_URL}/api/crm/send-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chatId: activeChatId,
                message: message,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'El servidor no pudo enviar el mensaje.');
        }

        const result = await response.json();
        
        // Limpiamos el input y la sugerencia del Copilot
        messageInput.value = '';
        clearSuggestion(); 
        
        // Añadimos el mensaje enviado a la vista al instante para una UI fluida
        const messagesContainer = document.getElementById('messages-container');
        const messageElement = document.createElement('div');
        messageElement.className = 'message sent';
        messageElement.textContent = message;
        messagesContainer.appendChild(messageElement);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // ✨ LÓGICA CLAVE: Actualización instantánea de la UI del bot ✨
        // Tras el primer mensaje manual exitoso, actualizamos los botones de control.
        const disableBotBtn = document.getElementById('disable-bot-btn');
        const enableBotBtn = document.getElementById('enable-bot-btn');
        
        if (disableBotBtn && enableBotBtn) {
            disableBotBtn.style.display = 'none'; // Ocultar el botón de desactivar
            enableBotBtn.style.display = 'inline-block'; // Mostrar el botón de reactivar
        }

        // Mostramos un toast informativo al usuario
        showToast("Mensaje enviado. El bot se ha pausado para este chat.", 'info');

    } catch (error) {
        console.error("Error al enviar mensaje manual:", error);
        showToast(error.message, 'error');
    } finally {
        // Volvemos a activar los controles para el siguiente mensaje
        messageInput.disabled = false;
        document.getElementById('send-message-btn').disabled = false;
        messageInput.focus();
    }
}


/**
 * Muestra una confirmación antes de desactivar el bot.
 * @param {string} chatId - El ID del chat para el cual desactivar el bot.
 */
function confirmDisableBot(chatId) {
    if (confirm("¿Estás seguro de que deseas desactivar las respuestas automáticas para este chat? Ya no responderá por su cuenta y tendrás que manejarlo manualmente.")) {
        disableBotForChat(chatId);
    }
}

/**
 * Envía la petición a bridge.js para desactivar el bot para un chat.
 * @param {string} chatId - El ID del chat.
 */
async function disableBotForChat(chatId) {
    try {
        const response = await fetch(`${NODE_API_URL}/api/crm/chats/${chatId}/disable_bot`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('El servidor no pudo desactivar el bot.');
        
        const result = await response.json();
        showToast(result.message, 'success');
        
        // Ocultar el botón después de desactivarlo para evitar clics repetidos
        const disableBotBtn = document.getElementById('disable-bot-btn');
        if (disableBotBtn) {
            disableBotBtn.style.display = 'none';
        }
    } catch (error) {
        showToast('No se pudo desactivar el bot. Revisa la conexión con bridge.js.', 'error');
    }
}

async function enableBotForChat(chatId) {
    try {
        const response = await fetch(`${NODE_API_URL}/api/crm/chats/${chatId}/enable_bot`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('El servidor no pudo reactivar el bot.');
        
        const result = await response.json();
        showToast(result.message, 'success');
        
        // Actualizamos la UI para mostrar el botón de desactivar de nuevo
        document.getElementById('disable-bot-btn').style.display = 'inline-block';
        document.getElementById('enable-bot-btn').style.display = 'none';
    } catch (error) {
        showToast('No se pudo reactivar el bot.', 'error');
    }
}


let wsReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

function initializeWhatsAppChatLogic(isManualConnection = false) {
    const token = localStorage.getItem('crm_token');
    if (!token) {
        console.log('No token available for WebSocket connection');
        return;
    }

    if (window.waChatSocket && 
        (window.waChatSocket.readyState === WebSocket.OPEN || 
         window.waChatSocket.readyState === WebSocket.CONNECTING)) {
        if (isManualConnection) showToast('Conexión ya activa o en progreso.', 'info');
        return;
    }

    // Add token to WebSocket URL
    const wsUrl = new URL(WS_BRIDGE_URL);
    wsUrl.searchParams.append('token', token);
    
    window.waChatSocket = new WebSocket(wsUrl.toString());

    window.waChatSocket.onopen = () => {
        console.log("WebSocket connected to bridge.");
        wsReconnectAttempts = 0;
        updateChatConnectionStatus();
    };

    window.waChatSocket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            // Handle incoming WebSocket messages
            console.log("WebSocket message received:", data);
        } catch (e) {
            console.error("Error parsing WebSocket message:", e);
        }
    };

    window.waChatSocket.onclose = () => {
        console.log("WebSocket disconnected");
        updateChatConnectionStatus();
        
        // Reconnect logic
        if (wsReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 30000);
            console.log(`Reconnecting in ${delay}ms...`);
            setTimeout(() => initializeWhatsAppChatLogic(), delay);
            wsReconnectAttempts++;
        }
    };

    window.waChatSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
        updateChatConnectionStatus();
    };
}


// --- PARTE B: LÓGICA DEL PANEL DE CONTROL DEL CHATBOT ---


async function renderChatbotSettingsView() {
    const panel = document.getElementById('chatbot_settings');
    panel.innerHTML = '<div class="dashboard-list-card"><div class="spinner"></div></div>';

    try {
        const settings = await fetch(`${NODE_API_URL}/api/crm/chatbot-settings`).then(res => res.json());
        
        const model = settings.model || 'gpt-4o';
        const promptNewUser = settings.prompt_new_user || '';
        const promptAffiliate = settings.prompt_affiliate || '';

        panel.innerHTML = `
            <div class="panel-header"><h1>Ajustes del Chatbot (Sistema de 2 Prompts)</h1></div>
            <div class="dashboard-list-card" style="max-width: 900px; margin: auto;">
                <p style="color: var(--text-light); font-size: 0.9rem; margin-bottom: 20px;">
                    Controla el comportamiento de tu chatbot. El sistema usará un prompt diferente dependiendo de si el usuario ya ha sido identificado como afiliado.
                </p>

                <div class="form-group" style="margin-bottom: 20px;">
                    <label for="chatbot-model-select"><strong>Modelo de Lenguaje de IA:</strong></label>
                    <select id="chatbot-model-select" class="form-control">
                        <option value="gpt-4o" ${model === 'gpt-4o' ? 'selected' : ''}>GPT-4o (Recomendado, más inteligente)</option>
                        <option value="gpt-4o-mini" ${model === 'gpt-4o-mini' ? 'selected' : ''}>GPT-4o Mini (Más rápido y económico)</option>
                        <option value="gpt-3.5-turbo" ${model === 'gpt-3.5-turbo' ? 'selected' : ''}>GPT-3.5 Turbo (Básico)</option>
                    </select>
                </div>

                <hr style="margin: 30px 0;">

                <div class="form-group">
                    <label for="prompt-new-users-editor"><strong>🧠 Prompt para Usuarios NUEVOS:</strong></label>
                    <p style="color: var(--text-light); font-size: 0.8rem; margin-top: 5px;">
                        Este es el cerebro del bot para su primer contacto. Su objetivo es guiar al usuario a través del proceso de afiliación.
                    </p>
                    <textarea id="prompt-new-users-editor" class="obs-box" style="width: 100%; min-height: 400px; font-size: 14px;">${promptNewUser}</textarea>
                </div>
                
                <hr style="margin: 30px 0;">

                <div class="form-group">
                    <label for="prompt-affiliates-editor"><strong>🧠 Prompt para Afiliados (Verificados):</strong></label>
                    <p style="color: var(--text-light); font-size: 0.8rem; margin-top: 5px;">
                        Este es el cerebro del bot para usuarios que ya conocemos. Su objetivo es ser un asistente rápido y eficiente.
                    </p>
                    <textarea id="prompt-affiliates-editor" class="obs-box" style="width: 100%; min-height: 400px; font-size: 14px;">${promptAffiliate}</textarea>
                </div>

                <div class="actions" style="margin-top: 20px; text-align: right;">
                    <button class="primary-btn" onclick="saveChatbotSettings()">
                        <i class="fa-solid fa-save"></i> Guardar Cambios
                    </button>
                </div>
            </div>
        `;
    } catch (error) { 
        console.error("Error al cargar ajustes del chatbot:", error);
        panel.innerHTML = `<p style="color:red; padding:20px;">No se pudieron cargar los ajustes del chatbot.</p>`;
    }
}

async function loadPromptModuleForEditing(moduleId) {
    // Resaltar el botón activo en el menú
    document.querySelectorAll('#prompt-modules-menu .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`btn-module-${moduleId}`).classList.add('active');

    const editorArea = document.getElementById('prompt-module-editor-area');
    editorArea.innerHTML = '<div class="dashboard-list-card"><div class="spinner"></div></div>';
    
    // Lista de todas las herramientas posibles que el bot puede usar (debe coincidir con las de bridge.js)
    const ALL_AVAILABLE_TOOLS = [
        'search_vacancies_tool',
        'validate_registration_tool',
        'get_all_active_vacancies_tool',
        'get_vacancy_details_tool',
        'get_candidate_status_tool',
        'get_vacancies_with_details_tool'
    ];

    try {
        const moduleData = await fetch(`${NODE_API_URL}/api/crm/prompt-modules/${moduleId}`).then(res => res.json());

        // La lista de módulos para la base de conocimiento se obtiene del almacén global
        const allModulesForKB = window.crmDataStore.promptModules || [];

        const toolsCheckboxesHTML = ALL_AVAILABLE_TOOLS.map(tool => `
            <div class="checkbox-item">
                <input type="checkbox" id="tool-${tool}" name="tools_allowed" value="${tool}" ${moduleData.tools_allowed.includes(tool) ? 'checked' : ''}>
                <label for="tool-${tool}">${tool}</label>
            </div>
        `).join('');

        const kbCheckboxesHTML = allModulesForKB
            .filter(m => m.is_knowledge_base) // Solo mostrar módulos que son bases de conocimiento
            .map(kbModule => `
                <div class="checkbox-item">
                    <input type="checkbox" id="kb-${kbModule.module_id}" name="knowledge_base_access" value="${kbModule.module_id}" ${moduleData.knowledge_base_access.includes(kbModule.module_id) ? 'checked' : ''}>
                    <label for="kb-${kbModule.module_id}">${kbModule.module_name}</label>
                </div>
            `).join('');

        const editorHTML = `
            <div class="dashboard-list-card" style="padding: 25px;">
                <h3>Editando: ${moduleData.module_name}</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 20px;">
                    ID del Módulo: <strong>${moduleData.module_id}</strong>
                </p>

                <div class="form-group">
                    <label>Rol de la IA:</label>
                    <input type="text" id="edit-module-role" class="form-control" value="${moduleData.role}">
                </div>

                <div class="form-group">
                    <label>Misión del Módulo:</label>
                    <textarea id="edit-module-mission" class="obs-box" rows="3">${moduleData.mission}</textarea>
                </div>

                <div class="form-group">
                    <label>Instrucciones (Qué decir o preguntar):</label>
                    <textarea id="edit-module-instructions" class="obs-box" rows="6">${moduleData.instructions}</textarea>
                </div>

                <div class="form-group-grid">
                    <div class="form-group">
                        <label>Herramientas Permitidas:</label>
                        <div class="checkbox-group">${toolsCheckboxesHTML}</div>
                    </div>
                    <div class="form-group">
                        <label>Acceso a Base de Conocimiento:</label>
                        <div class="checkbox-group">${kbCheckboxesHTML}</div>
                    </div>
                </div>

                <div class="actions" style="margin-top: 20px; text-align: right;">
                    <button class="primary-btn" onclick="savePromptModuleChanges('${moduleId}')">
                        <i class="fa-solid fa-save"></i> Guardar Cambios en este Módulo
                    </button>
                </div>
            </div>
        `;
        editorArea.innerHTML = editorHTML;
    } catch (error) {
        console.error(`Error al cargar el módulo ${moduleId}:`, error);
        editorArea.innerHTML = `<div class="dashboard-list-card"><p style="color:red; padding:15px;">No se pudo cargar el módulo.</p></div>`;
    }
}

// =================================================================
// INSERTA ESTA NUEVA FUNCIÓN COMPLETA EN script.js
// =================================================================
async function savePromptModuleChanges(moduleId) {
    const role = document.getElementById('edit-module-role').value;
    const mission = document.getElementById('edit-module-mission').value;
    const instructions = document.getElementById('edit-module-instructions').value;

    const tools_allowed = Array.from(document.querySelectorAll('input[name="tools_allowed"]:checked')).map(el => el.value);
    const knowledge_base_access = Array.from(document.querySelectorAll('input[name="knowledge_base_access"]:checked')).map(el => el.value);

    const moduleData = {
        role,
        mission,
        instructions,
        tools_allowed,
        knowledge_base_access
    };

    showLoader(true);
    try {
        const response = await fetch(`${NODE_API_URL}/api/crm/prompt-modules/${moduleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(moduleData),
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.error || 'Error del servidor');
        }

        showToast(result.message, 'success');
    } catch (error) {
        console.error("Error al guardar el módulo:", error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showLoader(false);
    }
}


async function saveChatbotSettings() {
    const model = document.getElementById('chatbot-model-select').value;
    const prompt_new_user = document.getElementById('prompt-new-users-editor').value;
    const prompt_affiliate = document.getElementById('prompt-affiliates-editor').value;

    const settings = { model, prompt_new_user, prompt_affiliate };

    showLoader(true);
    try {
        const response = await fetch(`${NODE_API_URL}/api/crm/chatbot-settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings),
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'El servidor no pudo guardar la configuración.');
        
        showToast(result.message, 'success');
    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        showLoader(false);
    }
}


/**
 * Muestra una confirmación antes de desactivar el bot.
 * @param {string} chatId - El ID del chat para el cual desactivar el bot.
 */
function confirmDisableBot(chatId) {
    if (confirm("¿Estás seguro de que deseas desactivar las respuestas automáticas para este chat? Ya no responderá por su cuenta y tendrás que manejarlo manualmente.")) {
        disableBotForChat(chatId);
    }
}


/**
 * Envía la petición a bridge.js para desactivar el bot para un chat
 * y actualiza la UI de forma segura.
 * @param {string} chatId - El ID del chat.
 */
async function disableBotForChat(chatId) {
    try {
        const response = await fetch(`${NODE_API_URL}/api/crm/chats/${chatId}/disable_bot`, {
            method: 'POST',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'El servidor no pudo desactivar el bot.');
        }
        
        const result = await response.json();
        showToast(result.message, 'success');
        
        // --- LÓGICA DE UI DEFENSIVA ---
        // Buscamos ambos botones después de la operación exitosa.
        const disableBotBtn = document.getElementById('disable-bot-btn');
        const enableBotBtn = document.getElementById('enable-bot-btn');

        // Verificamos que existan antes de intentar modificarlos.
        if (disableBotBtn) disableBotBtn.style.display = 'none';
        if (enableBotBtn) enableBotBtn.style.display = 'inline-block'; // o 'block', dependiendo de tu CSS

    } catch (error) {
        showToast('No se pudo desactivar el bot.', 'error');
        console.error("Error en disableBotForChat:", error);
    }
}

/**
 * Envía la petición a bridge.js para reactivar el bot para un chat
 * y actualiza la UI de forma segura.
 * @param {string} chatId - El ID del chat.
 */
async function enableBotForChat(chatId) {
    try {
        const response = await fetch(`${NODE_API_URL}/api/crm/chats/${chatId}/enable_bot`, {
            method: 'POST',
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'El servidor no pudo reactivar el bot.');
        }
        
        const result = await response.json();
        showToast(result.message, 'success');

        // --- LÓGICA DE UI DEFENSIVA ---
        // Buscamos ambos botones después de la operación exitosa.
        const disableBotBtn = document.getElementById('disable-bot-btn');
        const enableBotBtn = document.getElementById('enable-bot-btn');

        // Verificamos que existan antes de intentar modificarlos.
        if (disableBotBtn) disableBotBtn.style.display = 'inline-block'; // o 'block'
        if (enableBotBtn) enableBotBtn.style.display = 'none';

    } catch (error) {
        // Esta vez, este bloque solo se ejecutará si el fetch REALMENTE falla.
        showToast('No se pudo reactivar el bot.', 'error');
// ======================================================
// --- GESTIÓN DE TEMA CLARO/OSCURO ---
// ======================================================

        existingChart.destroy();
    }

    const ctx = document.getElementById('status-pie-chart')?.getContext('2d');
    if (!ctx) return;

    // ✨ SOLUCIÓN: Si ya existe un gráfico en la variable global, lo destruimos.
    if (window.statusChart instanceof Chart) {
        window.statusChart.destroy();
    }

    // Usamos Object.keys y Object.values para manejar los datos de la API directamente.
    const labels = Object.keys(data);
    const values = Object.values(data);

    // Creamos la nueva instancia y la guardamos en la variable global.
    window.statusChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', 
                    '#9966FF', '#FF9F40', '#E7E9ED'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Importante para que se ajuste al contenedor
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function renderActivityLineChart(afiliadosData, postulacionesData) {
    // --- INICIO DEL CÓDIGO AÑADIDO ---
    const existingChart = Chart.getChart('activity-line-chart');
    if (existingChart) {
        existingChart.destroy();
    }
    const ctx = document.getElementById('activity-line-chart')?.getContext('2d');
    if (!ctx) return;

    // ✨ SOLUCIÓN: Si ya existe un gráfico en la variable global, lo destruimos.
    if (window.activityChart instanceof Chart) {
        window.activityChart.destroy();
    }

    // Creamos las etiquetas para los últimos 30 días
    const labels = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('es-HN', { month: 'short', day: 'numeric' }));
    }

    // Mapeamos los datos de la API a nuestro array de 30 días
    const mapDataToLabels = (dataArray) => {
        const dataMap = new Map(dataArray.map(item => [new Date(item.dia).toLocaleDateString('es-HN', { month: 'short', day: 'numeric' }), item.total]));
        return labels.map(label => dataMap.get(label) || 0);
    };
    
    const afiliadosChartData = mapDataToLabels(afiliadosData);
    const postulacionesChartData = mapDataToLabels(postulacionesData);

    // Creamos la nueva instancia y la guardamos en la variable global.
    window.activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Nuevos Afiliados',
                    data: afiliadosChartData,
                    borderColor: '#36A2EB',
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Nuevas Postulaciones',
                    data: postulacionesChartData,
                    borderColor: '#FF6384',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    fill: true,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
    });
}




/**
 * Carga las etiquetas disponibles y las muestra como botones de filtro.
 */
async function loadTagFilters() {
    const filterContainer = document.getElementById('chat-tag-filters');
    try {
        const tags = await fetch(`${NODE_API_URL}/api/crm/chattags`).then(res => res.json());
        window.crmDataStore.chatTags = tags; // Guardamos las etiquetas para usarlas después

        if (tags.length === 0) {
            filterContainer.innerHTML = '<p style="font-size: 12px; color: #888; text-align: center; width: 100%;">No hay etiquetas. Créalas desde un chat.</p>';
            return;
        }

        let filterHTML = '<span class="filter-tag active" onclick="filterChatListByTag(null, this)">Todos</span>';
        filterHTML += tags.map(tag => 
            `<span class="filter-tag" style="background-color: ${tag.color}; color: white;" onclick="filterChatListByTag(${tag.id}, this)">${tag.name}</span>`
        ).join('');
        
        filterContainer.innerHTML = filterHTML;

    } catch (error) {
        console.error("Error al cargar filtros de etiquetas:", error);
        filterContainer.innerHTML = '<p style="color:red; font-size:12px;">Error al cargar filtros.</p>';
    }
}

/**
 * Filtra la lista de chats para mostrar solo aquellos que tienen una etiqueta específica.
 * @param {number|null} tagId - El ID de la etiqueta a filtrar. Null para mostrar todos.
 * @param {HTMLElement} clickedElement - El elemento del botón de filtro que fue clickeado.
 */
function filterChatListByTag(tagId, clickedElement) {
    // Manejar la clase 'active' para el feedback visual
    document.querySelectorAll('#chat-tag-filters .filter-tag').forEach(el => el.classList.remove('active'));
    clickedElement.classList.add('active');

    const chatItems = document.querySelectorAll('#chat-list-container .chat-item');
    
    chatItems.forEach(item => {
        if (tagId === null) {
            item.style.display = 'flex'; // 'flex' porque los items son flexbox
            return;
        }

        const itemTagIds = JSON.parse(item.dataset.tagIds || '[]');
        if (itemTagIds.includes(tagId)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Abre el modal para gestionar (asignar/remover) las etiquetas de un chat específico.
 * @param {string} chatId - El ID del chat a gestionar.
 */
async function openTagManagerModal(chatId) {
    try {
        // Obtenemos todas las etiquetas disponibles y los datos del chat actual en paralelo
        const [allTags, conversationData] = await Promise.all([
            fetch(`${NODE_API_URL}/api/crm/chattags`).then(res => res.json()),
            fetch(`${NODE_API_URL}/api/crm/conversations/${chatId}`).then(res => res.json())
        ]);
        
        const assignedTagIds = new Set(conversationData.tags.map(t => t.id));

        let modalContent = '<h4>Asignar/Remover Etiquetas</h4>';
        modalContent += '<div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">';
        modalContent += allTags.map(tag => `
            <div>
                <input type="checkbox" id="tag-${tag.id}" data-tag-id="${tag.id}" ${assignedTagIds.has(tag.id) ? 'checked' : ''}>
                <label for="tag-${tag.id}" style="color: ${tag.color}; font-weight: bold;">${tag.name}</label>
            </div>
        `).join('');
        modalContent += '</div>';

        modalContent += `<hr style="margin: 20px 0;"><h4>Crear Nueva Etiqueta</h4>
                         <div style="display:flex; gap:10px;">
                            <input type="text" id="new-tag-name" placeholder="Nombre de etiqueta" style="flex-grow:1;">
                            <input type="color" id="new-tag-color" value="#808080">
                         </div>`;
        
        showModal('Gestionar Etiquetas de Chat', modalContent, [
            { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
            { label: 'Crear Etiqueta', class: 'secondary-btn', handler: `createNewChatTag('${chatId}')` },
            { label: 'Guardar Cambios', class: 'primary-btn', handler: `saveChatTags('${chatId}')` }
        ]);
    } catch (error) {
        showToast('Error al abrir el gestor de etiquetas.', 'error');
    }
}


async function openChatContextModal(chatId) {
    try {
        const response = await fetch(`${NODE_API_URL}/api/crm/conversations/${chatId}`);
        if (!response.ok) throw new Error('No se pudo obtener el contexto del chat.');
        const chatData = await response.json();
        
        const currentName = chatData.custom_name || chatData.contact_name || '';
        const currentType = chatData.chat_type || 'unassigned';

        const content = `
            <p>Añade contexto a este chat para una mejor organización.</p>
            <div class="form-group" style="margin-top: 15px;">
                <label for="modal-custom-name"><strong>Nombre Personalizado:</strong></label>
                <input type="text" id="modal-custom-name" value="${currentName}" placeholder="Ej: Juan Pérez (Candidato) o Empresa XYZ (Cliente)">
            </div>
            <div class="form-group" style="margin-top: 15px;">
                <label for="modal-chat-type"><strong>Tipo de Chat:</strong></label>
                <select id="modal-chat-type">
                    <option value="unassigned" ${currentType === 'unassigned' ? 'selected' : ''}>Sin Asignar</option>
                    <option value="candidate" ${currentType === 'candidate' ? 'selected' : ''}>Candidato</option>
                    <option value="client" ${currentType === 'client' ? 'selected' : ''}>Cliente</option>
                </select>
            </div>
        `;

        showModal('Editar Contexto del Chat', content, [
            { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
            { label: 'Guardar Cambios', class: 'primary-btn', handler: `submitChatContext('${chatId}')` }
        ]);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function submitChatContext(chatId) {
    const custom_name = document.getElementById('modal-custom-name').value;
    const chat_type = document.getElementById('modal-chat-type').value;

    try {
        const response = await fetch(`${NODE_API_URL}/api/crm/chats/${chatId}/context`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ custom_name, chat_type })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'No se pudo guardar el contexto.');
        }

        const result = await response.json();
        closeModal();
        showToast(result.message, 'success');
        
        loadConversation(chatId, custom_name);
        loadChatList();
    } catch (error) {
        showToast(error.message, 'error');
    }
}


/**
 * Guarda las etiquetas seleccionadas para un chat.
 * @param {string} chatId - El ID del chat.
 */
async function saveChatTags(chatId) {
    const checkboxes = document.querySelectorAll('.modal-body input[type="checkbox"]');
    const promises = [];

    checkboxes.forEach(box => {
        const tagId = box.dataset.tagId;
        if (box.checked) {
            // Asignar etiqueta
            promises.push(fetch(`${NODE_API_URL}/api/crm/chats/${chatId}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag_id: tagId })
            }));
        } else {
            // Remover etiqueta
            promises.push(fetch(`${NODE_API_URL}/api/crm/chats/${chatId}/tags/${tagId}`, {
                method: 'DELETE'
            }));
        }
    });

    try {
        await Promise.all(promises);
        closeModal();
        showToast('Etiquetas actualizadas.', 'success');
        loadConversation(chatId, document.querySelector(`.chat-item[data-chat-id="${chatId}"]`).dataset.chatName);
        loadChatList(); // Recargar la lista para mostrar los cambios
        loadTagFilters(); // Recargar los filtros en caso de que se haya creado una etiqueta
    } catch (error) {
        showToast('Error al guardar las etiquetas.', 'error');
    }
}

/**
 * Crea una nueva etiqueta de chat y la asigna inmediatamente al chat actual.
 * @param {string} chatId - El ID del chat al que se asignará la nueva etiqueta.
 */
async function createNewChatTag(chatId) {
    const name = document.getElementById('new-tag-name').value;
    const color = document.getElementById('new-tag-color').value;

    if (!name.trim()) {
        showToast('El nombre de la etiqueta no puede estar vacío.', 'error');
        return;
    }

    try {
        // Crear la nueva etiqueta
        const response = await fetch(`${NODE_API_URL}/api/crm/chattags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, color })
        });
        const newTag = await response.json();
        if (!response.ok) throw new Error(newTag.error || 'No se pudo crear la etiqueta');

        // Asignar la etiqueta recién creada al chat actual
        await fetch(`${NODE_API_URL}/api/crm/chats/${chatId}/tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag_id: newTag.id })
        });

        showToast(`Etiqueta "${name}" creada y asignada.`, 'success');
        closeModal();
        
        // Recargar todo para reflejar los cambios
        loadConversation(chatId, document.querySelector(`.chat-item[data-chat-id="${chatId}"]`).dataset.chatName);
        loadChatList();
        loadTagFilters();

    } catch (error) {
        showToast(`Error: ${error.message}`, 'error');
    }
}




// --- LÓGICA DEL COPILOT DE CHAT ---

let suggestionDebounceTimer;
let currentSuggestion = '';

/**
 * Inicializa todos los listeners para la funcionalidad de autocompletado con IA.
 * Se debe llamar cada vez que se carga una nueva conversación.
 */

function setupCopilotListeners() {
    const realInput = document.getElementById('message-text-input');
    if (!realInput) return;

    // Limpiar listeners antiguos para evitar duplicados si se llama varias veces
    realInput.replaceWith(realInput.cloneNode(true));
    const newRealInput = document.getElementById('message-text-input');

    // 1. Listener para las teclas de acción (Ctrl+Espacio para pedir, Tab para aceptar)
    newRealInput.addEventListener('keydown', (e) => {
        // Pedir sugerencia con Ctrl + Espacio
        if (e.ctrlKey && e.code === 'Space') {
            e.preventDefault();
            fetchAndShowSuggestion();
        }
        // Aceptar sugerencia con Tab o Flecha Derecha
        else if ((e.key === 'Tab' || e.key === 'ArrowRight') && currentSuggestion) {
            if (e.target.selectionStart === newRealInput.value.length) {
                e.preventDefault();
                acceptSuggestion();
            }
        }
        // Limpiar sugerencia con Escape
        else if (e.key === 'Escape') {
            clearSuggestion();
        }
    });

    // 2. Listener para la sugerencia proactiva al enfocar el input vacío
    newRealInput.addEventListener('focus', () => {
        if (newRealInput.value === '') {
            fetchAndShowSuggestion();
        }
    });

    // 3. Limpiar la sugerencia si el usuario empieza a escribir de nuevo o desenfoca
    newRealInput.addEventListener('input', clearSuggestion);
    newRealInput.addEventListener('blur', clearSuggestion);
}
/**
 * Pide una sugerencia al backend y la muestra en la UI.
 */
async function fetchAndShowSuggestion() {
    if (!activeChatId) return;

    const realInput = document.getElementById('message-text-input');
    const currentText = realInput.value;

    try {
        // Obtenemos el historial directamente desde la base de datos del puente
        const historyResponse = await fetch(`${NODE_API_URL}/api/crm/conversations/${activeChatId}`);
        const conversationData = await historyResponse.json();
        const history = conversationData.messages.slice(-5); // Últimos 5 mensajes para contexto

        const response = await fetch(`${NODE_API_URL}/api/crm/suggest_reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: history, current_text: currentText }),
        });

        if (!response.ok) return;

        const data = await response.json();
        if (data.suggestion) {
            currentSuggestion = data.suggestion;
            const suggestionInput = document.getElementById('suggestion-input');
            suggestionInput.value = currentText + currentSuggestion;
        }
    } catch (error) {
        console.error("Error al obtener sugerencia:", error);
        clearSuggestion();
    }
}

/**
 * Acepta la sugerencia actual, moviéndola al input real.
 */
function acceptSuggestion() {
    const realInput = document.getElementById('message-text-input');
    if (currentSuggestion) {
        realInput.value += currentSuggestion;
        clearSuggestion();
    }
}

/**
 * Limpia la sugerencia de la UI y de la variable de estado.
 */
function clearSuggestion() {
    const suggestionInput = document.getElementById('suggestion-input');
    if (suggestionInput) {
        suggestionInput.value = '';
    }
    currentSuggestion = '';
}

function updateFollowUpIndicators() {
    const chatItems = document.querySelectorAll('#chat-list-container .chat-item');
    const now = new Date();
    const twentyFourHoursAgo = now.getTime() - (24 * 60 * 60 * 1000); // 24 horas en milisegundos

    chatItems.forEach(item => {
        const timestamp = parseInt(item.dataset.timestamp, 10) * 1000; // Convertir segundos a milisegundos
        const lastMessageFromMe = item.dataset.lastFromMe === 'true';
        const indicator = item.querySelector('.follow-up-indicator');

        if (!indicator) return;

        // La lógica: El último mensaje es mío (del reclutador) Y
        // ha pasado más de 24 horas desde que se envió
        if (lastMessageFromMe && timestamp < twentyFourHoursAgo) {
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    });
}
/**
 * Obtiene las iniciales de un nombre.
 * @param {string} name - El nombre completo del contacto.
 * @returns {string} Las iniciales (ej. "JP" para "Juan Pérez").
 */
function getInitials(name) {
    if (!name || typeof name !== 'string') return '?';
    const words = name.split(' ').filter(Boolean);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + (words[words.length - 1][0] || '')).toUpperCase();
}

function getAvatarColor(name) {
    const colors = [
        'linear-gradient(135deg, #4e54c8, #8f94fb)',
        'linear-gradient(135deg, #ff5e62, #ff9966)',
        'linear-gradient(135deg, #11998e, #38ef7d)',
        'linear-gradient(135deg, #5433ff, #20bdff)',
        'linear-gradient(135deg, #ff0099, #493240)'
    ];
    if (!name) return colors[0];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
}


/**
 * Maneja el clic en un item de chat: lo marca como leído y carga la conversación.
 * @param {HTMLElement} chatItemElement - El elemento del chat que fue clickeado.
 */
async function handleChatClick(chatItemElement) {
    const chatId = chatItemElement.dataset.chatId;
    const chatName = chatItemElement.dataset.chatName;

    // 1. Actualizar la UI inmediatamente para una experiencia fluida
    document.querySelectorAll('#whatsapp_chat .chat-item.active').forEach(el => el.classList.remove('active'));
    chatItemElement.classList.add('active');
    
    const unreadBadge = chatItemElement.querySelector('.unread-badge');
    if (unreadBadge) {
        unreadBadge.remove(); // Eliminar el contador visualmente al instante
    }

    // 2. Cargar la conversación
    loadConversation(chatId, chatName);

    // 3. Enviar la petición al backend para marcar como leído en la base de datos
    try {
        await fetch(`${NODE_API_URL}/api/crm/chats/${chatId}/mark_read`, { method: 'POST' });
        // No es necesario hacer nada con la respuesta, es una operación de "disparar y olvidar"
    } catch (error) {
        console.error("No se pudo marcar el chat como leído en el servidor:", error);
    }
}

/**
 * Ancla o desancla un chat.
 * @param {string} chatId - El ID del chat a modificar.
 * @param {boolean} isCurrentlyPinned - El estado actual de anclado del chat.
 */
async function togglePinChat(chatId, isCurrentlyPinned) {
    const newPinState = !isCurrentlyPinned; // Invertimos el estado

    try {
        const response = await fetch(`${NODE_API_URL}/api/crm/chats/${chatId}/pin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_pinned: newPinState }),
        });

        if (!response.ok) throw new Error('No se pudo actualizar el estado de anclado.');

        showToast(`Chat ${newPinState ? 'anclado' : 'desanclado'}.`, 'success');
        // Recargamos toda la lista de chats para que se reordene correctamente
        loadChatList();
        
    } catch (error) {
        console.error("Error al anclar/desanclar chat:", error);
        showToast(error.message, 'error');
    }
}



async function renderPostsManagementView() {
    const panel = document.getElementById('posts');
    panel.innerHTML = `
        <div class="panel-header">
            <h1>Gestión de Noticias</h1>
            <button class="primary-btn" onclick="openPostModal()"><i class="fa-solid fa-plus"></i> Nuevo Post</button>
        </div>
        <div id="posts-table-container"><div class="spinner"></div></div>
    `;
    try {
        const posts = await apiCall('/posts');
        window.crmDataStore.posts = posts;
        displayPostsTable(posts);
    } catch (error) {
        document.getElementById('posts-table-container').innerHTML = `<p style="color:red;">No se pudieron cargar los posts.</p>`;
    }
}

function displayPostsTable(data) {
    const container = document.getElementById('posts-table-container');
    const headers = ['Título', 'Autor', 'Fecha', 'Estado', 'Acciones'];
    let tableHTML = '<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead><tbody>';
    if (!data || data.length === 0) {
        tableHTML += `<tr><td colspan="${headers.length}" style="text-align:center;">No has creado ningún post.</td></tr>`;
    } else {
        tableHTML += data.map(p => `
            <tr>
                <td><strong>${p.title}</strong></td>
                <td>${p.author}</td>
                <td>${new Date(p.fecha_publicacion).toLocaleDateString()}</td>
                <td><span class="status-badge" data-status="${p.estado}">${p.estado}</span></td>
                <td>
                    <div class="actions">
                        <button class="secondary-btn btn" onclick='openPostModal(${JSON.stringify(p)})'><i class="fa-solid fa-pencil"></i> Editar</button>
                        <button class="btn" style="background-color: var(--danger);" onclick="deletePost(${p.id_post})"><i class="fa-solid fa-trash-can"></i> Eliminar</button>
                    </div>
                </td>
            </tr>`).join('');
    }
    tableHTML += '</tbody></table>';
    container.innerHTML = tableHTML;
}

function openPostModal(post = null) {
    const isEditing = post !== null;
    const title = isEditing ? 'Editar Noticia' : 'Crear Nueva Noticia';
    const content = `
        <div style="display: flex; flex-direction: column; gap: 15px;">
            <input type="text" id="modal-post-title" placeholder="Título del artículo" value="${isEditing ? post.title : ''}">
            <input type="text" id="modal-post-author" placeholder="Autor" value="${isEditing ? post.author : 'Equipo Henmir'}">
            <input type="text" id="modal-post-image" placeholder="URL de la imagen de cabecera" value="${isEditing ? post.image_url : ''}">
            <textarea id="modal-post-excerpt" placeholder="Extracto o resumen corto..." rows="3">${isEditing ? post.excerpt : ''}</textarea>
            <textarea id="modal-post-content" placeholder="Contenido completo del artículo (puedes usar HTML)" rows="10">${isEditing ? post.content : ''}</textarea>
            <select id="modal-post-estado">
                <option value="publicado" ${isEditing && post.estado === 'publicado' ? 'selected' : ''}>Publicado</option>
                <option value="borrador" ${isEditing && post.estado === 'borrador' ? 'selected' : ''}>Borrador</option>
            </select>
        </div>
    `;
    const handler = isEditing ? `submitPost(${post.id_post})` : 'submitPost()';
    showModal(title, content, [
        { label: 'Cancelar', class: 'secondary-btn', handler: 'closeModal()' },
        { label: 'Guardar', class: 'primary-btn', handler: handler }
    ]);
}

async function submitPost(postId = null) {
    const data = {
        title: document.getElementById('modal-post-title').value,
        author: document.getElementById('modal-post-author').value,
        image_url: document.getElementById('modal-post-image').value,
        excerpt: document.getElementById('modal-post-excerpt').value,
        content: document.getElementById('modal-post-content').value,
        estado: document.getElementById('modal-post-estado').value
    };

    if (!data.title || !data.content) {
        showToast('El título y el contenido son obligatorios.', 'error');
        return;
    }

    try {
        const endpoint = postId ? `/posts/${postId}` : '/posts';
        const method = postId ? 'PUT' : 'POST';
        const response = await apiCall(endpoint, method, data);
        closeModal();
        showToast(response.message, 'success');
        renderPostsManagementView();
    } catch (error) {
        // apiCall ya maneja el error
    }
}

async function deletePost(postId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este post? Esta acción no se puede deshacer.')) return;
    try {
        const response = await apiCall(`/posts/${postId}`, 'DELETE');
        showToast(response.message, 'success');
        renderPostsManagementView();
    } catch (error) {
        // apiCall ya maneja el error
    }
}



// --- LÓGICA PARA GESTIONAR SOLICITUDES DE POSTULACIÓN ---

async function loadApplicationRequests() {
    const container = document.getElementById('application-requests-container');
    if (!container) return;
    
    try {
        const requests = await apiCall('/application-requests');
        if (requests.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No hay solicitudes pendientes.</p>';
            return;
        }
        container.innerHTML = requests.map(req => `
            <div class="request-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border);">
                <div>
                    <p><strong>${req.nombre_completo}</strong> (ID: ${req.id_afiliado})</p>
                    <p>quiere postular a: <em>${req.cargo_solicitado}</em></p>
                </div>
                <div class="actions">
                    <a href="${req.cv_url || '#'}" target="_blank" class="secondary-btn btn" title="Ver CV"><i class="fa-solid fa-file-lines"></i></a>
                    <button class="primary-btn btn" style="background-color: var(--danger);" title="Rechazar" onclick="processRequest(${req.id_solicitud}, 'decline')"><i class="fa-solid fa-times"></i></button>
                    <button class="primary-btn btn" style="background-color: var(--success);" title="Aprobar" onclick="processRequest(${req.id_solicitud}, 'approve')"><i class="fa-solid fa-check"></i></button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        container.innerHTML = '<p style="color:red;">Error al cargar solicitudes.</p>';
    }
}

async function processRequest(requestId, action) {
    const confirmationText = action === 'approve' 
        ? '¿Aprobar esta postulación? Se creará un registro oficial para este candidato en la vacante.'
        : '¿Estás seguro de que quieres rechazar esta solicitud?';

    if (!confirm(confirmationText)) return;

    try {
        const response = await apiCall(`/process-request/${requestId}`, 'POST', { action: action });
        showToast(response.message, 'success');
        loadApplicationRequests(); // Recargamos la lista
    } catch (error) {
        // apiCall ya maneja el error
    }
}

// --- LÓGICA PARA LA BANDEJA DE ENTRADA ---

async function renderMessagesView() {
    const panel = document.getElementById('mensajes');
    panel.innerHTML = `
        <div class="panel-header"><h1>Bandeja de Entrada</h1></div>
        <div id="messages-table-container"><div class="spinner"></div></div>
    `;
    try {
        const messages = await apiCall('/contact-messages');
        const container = document.getElementById('messages-table-container');
        
        if (messages.length === 0) {
            container.innerHTML = '<p>No hay mensajes en tu bandeja de entrada.</p>';
            return;
        }

        let tableHTML = '<table><thead><tr><th>De</th><th>Asunto</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>';
        tableHTML += messages.map(msg => `
            <tr>
                <td><strong>${msg.nombre}</strong><br><small>${msg.email}</small></td>
                <td>${msg.asunto}</td>
                <td>${new Date(msg.fecha_recepcion).toLocaleString('es-HN')}</td>
                <td><span class="status-badge" data-status="En Revisión">${msg.estado}</span></td>
                <td>
                    <div class="actions">
                        <button class="secondary-btn btn" onclick='viewMessage(${JSON.stringify(msg)})'><i class="fa-solid fa-eye"></i> Leer</button>
                    </div>
                </td>
            </tr>`).join('');
        tableHTML += '</tbody></table>';
        container.innerHTML = tableHTML;
    } catch (error) {
        document.getElementById('messages-table-container').innerHTML = `<p style="color:red;">No se pudieron cargar los mensajes.</p>`;
    }
}

function viewMessage(message) {
    const content = `
        <div style="font-size: 0.9rem; color: var(--text-secondary);">
            <p><strong>De:</strong> ${message.nombre} (${message.email})</p>
            <p><strong>Fecha:</strong> ${new Date(message.fecha_recepcion).toLocaleString('es-HN')}</p>
        </div>
        <hr>
        <div style="white-space: pre-wrap; background: #f8fafc; padding: 15px; border-radius: 6px;">${message.mensaje}</div>
    `;
    showModal(`Asunto: ${message.asunto}`, content, [
        { label: 'Cerrar', class: 'secondary-btn', handler: 'closeModal()' }
    ]);
}


async function login() {
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    const loginBtn = document.getElementById('login-btn');

    try {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Ingresando...';

        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error de credenciales');
        }

        localStorage.setItem('crm_token', data.token);
        window.location.href = 'index.html';

    } catch (error) {
        const errorMsg = document.getElementById('error-message');
        if (errorMsg) errorMsg.textContent = error.message;
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Ingresar';
    }
}

// ======================================================
// --- GESTIÓN DE TEMA CLARO/OSCURO ---
// ======================================================

/**
 * Cambia entre tema claro y oscuro
 */
function toggleTheme() {
    const html = document.documentElement;
    const themeToggleBtn = document.getElementById('theme-toggle');
    const isDark = html.getAttribute('data-theme') === 'dark';
    
    if (isDark) {
        // Cambiar a tema claro
        html.removeAttribute('data-theme');
        if (themeToggleBtn) {
            themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            themeToggleBtn.setAttribute('title', 'Cambiar a tema oscuro');
        }
        localStorage.setItem('theme', 'light');
    } else {
        // Cambiar a tema oscuro
        html.setAttribute('data-theme', 'dark');
        if (themeToggleBtn) {
            themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
            themeToggleBtn.setAttribute('title', 'Cambiar a tema claro');
        }
        localStorage.setItem('theme', 'dark');
    }
}

// ======================================================
// --- MANEJO DEL MENÚ MÓVIL Y NAVEGACIÓN ---
// ======================================================

/**
 * Alternar la visibilidad del menú móvil
 */
function toggleMobileMenu() {
    document.body.classList.toggle('menu-open');
    
    // Alternar el icono del botón de menú
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        if (document.body.classList.contains('menu-open')) {
            menuToggle.innerHTML = '<i class="fas fa-times"></i>';
            menuToggle.setAttribute('aria-expanded', 'true');
            // Bloquear el scroll del body cuando el menú está abierto
            document.body.style.overflow = 'hidden';
        } else {
            menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
            menuToggle.setAttribute('aria-expanded', 'false');
            // Restaurar el scroll del body
            document.body.style.overflow = '';
        }
    }
}

/**
 * Cerrar el menú móvil
 */
function closeMobileMenu() {
    document.body.classList.remove('menu-open');
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        menuToggle.setAttribute('aria-expanded', 'false');
    }
    // Restaurar el scroll del body
    document.body.style.overflow = '';
}

/**
 * Alternar submenú desplegable en móviles
 * @param {Event} event - Evento de clic
 */
function toggleDropdown(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const dropdown = event.currentTarget.closest('.dropdown');
    if (!dropdown) return;
    
    // Cerrar otros dropdowns abiertos
    const allDropdowns = document.querySelectorAll('.dropdown');
    allDropdowns.forEach(d => {
        if (d !== dropdown) {
            d.classList.remove('open');
        }
    });
    
    // Alternar el dropdown actual
    dropdown.classList.toggle('open');
}

/**
 * Cerrar todos los dropdowns
 */
function closeAllDropdowns() {
    document.querySelectorAll('.dropdown').forEach(dropdown => {
        dropdown.classList.remove('open');
    });
}

/**
 * Manejar clics fuera de los dropdowns para cerrarlos
 */
function handleClickOutsideDropdown(event) {
    if (!event.target.closest('.dropdown')) {
        closeAllDropdowns();
    }
}

/**
 * Inicializar la navegación táctil
 */
function initTouchNavigation() {
    // Agregar clase de soporte táctil al body
    document.body.classList.add('touch-device');
    
    // Agregar listeners para los dropdowns
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        // Eliminar listeners anteriores para evitar duplicados
        toggle.removeEventListener('click', toggleDropdown);
        toggle.removeEventListener('touchstart', toggleDropdown);
        
        // Agregar listeners para clic y toque
        toggle.addEventListener('click', toggleDropdown);
        toggle.addEventListener('touchstart', toggleDropdown);
    });
    
    // Cerrar menús al hacer clic fuera
    document.addEventListener('click', handleClickOutsideDropdown);
    
    // Cerrar menús al hacer scroll en móviles
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (window.innerWidth <= 768) {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                closeAllDropdowns();
            }, 100);
        }
    }, { passive: true });
}

// Detectar si es un dispositivo táctil
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Cargar tema guardado
    const savedTheme = localStorage.getItem('theme') || 'light';
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    // Aplicar tema guardado
    if (savedTheme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        if (themeToggleBtn) {
            themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
            themeToggleBtn.setAttribute('title', 'Cambiar a tema claro');
            themeToggleBtn.setAttribute('aria-label', 'Cambiar a tema claro');
        }
    } else if (themeToggleBtn) {
        themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
        themeToggleBtn.setAttribute('title', 'Cambiar a tema oscuro');
        themeToggleBtn.setAttribute('aria-label', 'Cambiar a tema oscuro');
    }
    
    // Configurar el evento de cambio de tema
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }
    
    // Ajustar el padding superior del main para la barra de navegación
    const mainElement = document.querySelector('main');
    if (mainElement) {
        mainElement.style.paddingTop = 'var(--header-height)';
    }
    
    // Configurar el botón de menú móvil
    const menuToggle = document.querySelector('.menu-toggle');
    if (menuToggle) {
        menuToggle.setAttribute('aria-label', 'Menú de navegación');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.setAttribute('aria-controls', 'nav-links');
        menuToggle.addEventListener('click', toggleMobileMenu);
    }
    
    // Configurar la navegación
    const navLinks = document.querySelectorAll('.nav-btn, .dropdown-item');
    const navContainer = document.querySelector('.nav-links');
    
    if (navContainer) {
        navContainer.id = 'nav-links'; // Asegurar que el contenedor tenga un ID para ARIA
        navContainer.setAttribute('role', 'navigation');
        navContainer.setAttribute('aria-label', 'Navegación principal');
    }
    
    // Configurar eventos de navegación
    navLinks.forEach(link => {
        // Mejorar accesibilidad
        if (link.classList.contains('dropdown-toggle')) {
            link.setAttribute('aria-haspopup', 'true');
            link.setAttribute('aria-expanded', 'false');
            
            // Agregar indicador visual para dispositivos táctiles
            if (isTouchDevice) {
                const chevron = document.createElement('i');
                chevron.className = 'fas fa-chevron-down dropdown-chevron';
                chevron.style.marginLeft = '4px';
                chevron.style.transition = 'transform 0.2s';
                link.appendChild(chevron);
            }
        }
        
        // Manejar clics en enlaces
        link.addEventListener('click', (e) => {
            const isDropdownToggle = link.classList.contains('dropdown-toggle');
            const isMobileView = window.innerWidth <= 768;
            
            // Si es un enlace de dropdown en móvil, manejarlo con toggleDropdown
            if (isDropdownToggle && isMobileView) {
                e.preventDefault();
                toggleDropdown(e);
                return;
            }
            
            // Si no es un dropdown o estamos en escritorio, manejar la navegación
            if (!isDropdownToggle || !isMobileView) {
                // Cerrar menú móvil si está abierto
                if (window.innerWidth <= 768) {
                    closeMobileMenu();
                }
                
                // Manejar la navegación por pestañas
                const tabId = link.getAttribute('data-tab');
                if (tabId) {
                    // Remover la clase active de todos los botones
                    navLinks.forEach(btn => btn.classList.remove('active'));
                    // Agregar la clase active al botón clickeado
                    link.classList.add('active');
                    
                    // Aquí puedes agregar la lógica para cambiar el contenido de la pestaña
                    // Por ejemplo: showTab(tabId);
                }
            }
        });
    });
    
    // Inicializar navegación táctil si es necesario
    if (isTouchDevice) {
        initTouchNavigation();
    }
    
    // Cerrar menús al hacer clic fuera de ellos
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-links') && !e.target.closest('.menu-toggle')) {
            closeMobileMenu();
        }
    });
    
    // Manejar cambios de tamaño de ventana
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            // Cerrar menú móvil al cambiar a vista de escritorio
            if (window.innerWidth > 768) {
                closeMobileMenu();
                // Cerrar todos los dropdowns
                closeAllDropdowns();
            }
            
            // Actualizar el estado de los botones de menú
            const menuToggle = document.querySelector('.menu-toggle');
            if (window.innerWidth <= 768) {
                menuToggle.style.display = 'flex';
            } else {
                menuToggle.style.display = 'none';
            }
        }, 250);
    });
    
    // Inicializar visibilidad del botón de menú
    if (window.innerWidth <= 768) {
        menuToggle.style.display = 'flex';
    } else {
        menuToggle.style.display = 'none';
    }
    
    // Mejorar accesibilidad del teclado
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMobileMenu();
            closeAllDropdowns();
        }
    });
});