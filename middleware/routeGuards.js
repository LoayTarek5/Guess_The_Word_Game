// Redirect to dashboard if already logged in (for login/signup pages)
export const redirectIfAuthenticated = async (req, res, next) => {
  try {
    const token = req.cookies.authToken;
    
    if (token) {
      return res.redirect('/dashboard');
    }
    
    next();
  } catch (error) {
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
    
    next();
  } catch (error) {
    return res.redirect('/auth/login');
  }
};