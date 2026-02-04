// Main routes file
import express from 'express';

const router = express.Router();

// Import route modules here
// import authRoutes from './auth.js';
// import userRoutes from './users.js';

// Mount routes
// router.use('/auth', authRoutes);
// router.use('/users', userRoutes);

router.get('/', (req, res) => {
  res.json({ message: 'API routes' });
});

export default router;
