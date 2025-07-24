// Redirect to dashboard if already logged in (for login/signup pages)
export const redirectIfAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies.authToken;
    
    if (token) {
      // User has token, they might be logged in
      return res.redirect('/dashboard');
    }
    
    next();
  } catch (error) {
    // Token invalid, continue to login/signup
    next();
  }
};

// Require authentication (for protected pages like dashboard)
export const requireAuth = async (req, res, next) => {
  try {
    const token = req.cookies.authToken;
    
    if (!token) {
      return res.redirect('/auth/login');
    }
    
    // Token exists, let them through
    next();
  } catch (error) {
    return res.redirect('/auth/login');
  }
};