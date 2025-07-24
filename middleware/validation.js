import { body, validationResult } from 'express-validator';

// Validation rules for signup
export const validateSignup = [
  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be 3-20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores')
    .trim(),
  
  body('email')
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 100 })
    .withMessage('Email too long'),
  
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('Password must be 6-100 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  
  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }
    next();
  }
];

// Validation rules for login
export const validateLogin = [
  body('email')
    .notEmpty()
    .withMessage('Username or email is required')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Username/email too long'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 100 })
    .withMessage('Password too long'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array()
      });
    }
    next();
  }
];