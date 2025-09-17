// auth-bridge.js
window.handleLandingLogin = async (email, password) => {
  try {
    const response = await fetch('https://34-136-149-39.sslip.io/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Error en la autenticación');
    }
    
    const data = await response.json();
    localStorage.setItem('crm_token', data.token);
    localStorage.setItem('crm_refresh_token', data.refreshToken);
    localStorage.setItem('crm_token_expiry', 
      (Date.now() + (data.expiresIn * 1000)).toString()
    );
    
    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
};

window.checkAuthStatus = () => {
  const token = localStorage.getItem('crm_token');
  const expiry = localStorage.getItem('crm_token_expiry');
  return { 
    isAuthenticated: !!token && (!expiry || parseInt(expiry) > Date.now())
  };
};
