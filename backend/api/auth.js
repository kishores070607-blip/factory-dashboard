const express = require('express');
const bcrypt = require('bcrypt');
const userRepository = require('../persistence/repositories/userRepository');
 const auditRepository = require('../persistence/repositories/auditRepository');
const { requireAuth, requireRole } = require('../security/auth');

const router = express.Router();

/**
 * Handles user login.
 */
router.post('/login', async (req, res) => {
    try {
        const username = (req.body.username || '').trim();
        const password = (req.body.password || '').trim();
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = userRepository.findByUsername(username);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.user = {
            userId: user.user_id,
            username: user.username,
            role: user.role
        };

        auditRepository.insert({
            actor: username,
            action: 'login',
            objectType: 'user',
            objectId: String(user.user_id)
        });

        return res.status(200).json({ username: user.username, role: user.role });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Handles user logout.
 */
router.post('/logout', (req, res) => {
    if (req.session) {
        req.session.destroy();
    }
    return res.status(200).json({ status: 'logged_out' });
});

/**
 * Returns info about the currently authenticated user.
 */
router.get('/me', requireAuth, (req, res) => {
    return res.json({ user: req.session.user, ...req.session.user });
});

/**
 * Admin: List users.
 */
router.get('/users', requireAuth, requireRole('administrator'), (req, res) => {
    try {
        const users = userRepository.findAll();
        return res.json(users);
    } catch (error) {
        console.error('Error listing users:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * Admin: Create user.
 */
router.post('/users', requireAuth, requireRole('administrator'), async (req, res) => {
    try {
        const { username, password, role } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const existing = userRepository.findByUsername(username);
        if (existing) {
            return res.status(409).json({ error: 'Username already exists' });
        }

        const validRoles = ['operator', 'administrator'];
        const assignedRole = validRoles.includes(role) ? role : 'operator';

        const password_hash = await bcrypt.hash(password, 10);
        const newUser = userRepository.insert({
            username,
            password_hash,
            role: assignedRole
        });

        auditRepository.insert({
            actor: req.session.user.username,
            action: 'create_user',
            objectType: 'user',
            objectId: String(newUser.user_id),
            detail: { username, role: assignedRole }
        });

        return res.status(201).json({
            user_id: newUser.user_id,
            username: newUser.username,
            role: newUser.role
        });
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
