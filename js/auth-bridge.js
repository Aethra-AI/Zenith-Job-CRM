// auth-bridge.js
// Este script permite la comunicación entre la landing page y la aplicación React

// Función para manejar el inicio de sesión desde la landing page
window.handleLandingLogin = async (email, password) => {
  try {
    console.log('Iniciando proceso de login para:', email);
    
    const response = await fetch(`https://34.136.149.39.sslip.io/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    });

    const responseData = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      console.error('Error en la respuesta del servidor:', response.status, responseData);
      throw new Error(responseData.message || 'Error en el inicio de sesión. Por favor, verifica tus credenciales.');
    }

    if (!responseData.accessToken) {
      console.error('Token de acceso no recibido en la respuesta');
      throw new Error('No se pudo completar el inicio de sesión. Inténtalo de nuevo.');
    }
    
    console.log('Inicio de sesión exitoso');
    
    // Almacenar los tokens
    localStorage.setItem('crm_token', responseData.accessToken);
    localStorage.setItem('crm_refresh_token', responseData.refreshToken || '');
    localStorage.setItem('crm_token_expiry', (Date.now() + ((responseData.expiresIn || 3600) * 1000)).toString());
    localStorage.setItem('crm_user', JSON.stringify(responseData.user || {}));
    
    return { 
      success: true,
      user: responseData.user
    };
    
  } catch (error) {
    console.error('Error en el inicio de sesión:', error);
    return { 
      success: false, 
      error: error.message || 'Error al conectar con el servidor. Por favor, verifica tu conexión.'
    };
  }
};

// Verificar si el usuario ya está autenticado
window.checkAuthStatus = () => {
  const token = localStorage.getItem('crm_token');
  const expiry = localStorage.getItem('crm_token_expiry');
  
  if (!token || !expiry) return { isAuthenticated: false };
  
  const isExpired = Date.now() > parseInt(expiry, 10);
  return {
    isAuthenticated: !isExpired,
    isExpired
  };
};

// Cerrar sesión
window.handleLogout = () => {
  localStorage.removeItem('crm_token');
  localStorage.removeItem('crm_refresh_token');
  localStorage.removeItem('crm_token_expiry');
  window.location.href = `${window.location.origin}/cardboard-master`;
};
