const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// Get all requests
router.get('/', verifyToken, async (req, res) => {
    try {
        let query = `
            SELECT r.*, u.Name as CustomerName 
            FROM Requests r
            JOIN Users u ON r.User_ID = u.User_ID
        `;
        let params = [];

        if (req.user.role === 'Customer') {
            query += ' WHERE r.User_ID = ?';
            params.push(req.user.userId);
        } else if (req.user.role === 'Seller') {
            // Sellers see approved requests that are not yet completely fulfilled
            query += " WHERE r.Status IN ('Pending', 'Approved')";
        }
        
        query += ' ORDER BY r.Created_At DESC';

        const [requests] = await db.execute(query, params);
        res.json(requests);
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Get single request
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const [requests] = await db.execute(`
            SELECT r.*, u.Name as CustomerName 
            FROM Requests r
            JOIN Users u ON r.User_ID = u.User_ID
            WHERE r.Request_ID = ?
        `, [req.params.id]);

        if (requests.length === 0) {
            return res.status(404).json({ message: 'Request not found' });
        }

        res.json(requests[0]);
    } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Create new request (Customer only)
router.post('/', verifyToken, requireRole(['Customer']), async (req, res) => {
    try {
        const { item_name, quantity, budget, description } = req.body;

        if (!item_name || !quantity || !budget) {
            return res.status(400).json({ message: 'Item name, quantity, and budget are required' });
        }

        const [result] = await db.execute(
            'INSERT INTO Requests (User_ID, Item_Name, Quantity, Budget, Description, Status) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.userId, item_name, quantity, budget, description || '', 'Pending']
        );

        res.status(201).json({ message: 'Request created successfully', requestId: result.insertId });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update request status (Admin)
router.put('/:id/status', verifyToken, requireRole(['Admin']), async (req, res) => {
    try {
        const { status } = req.body;

        if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const [requests] = await db.execute('SELECT * FROM Requests WHERE Request_ID = ?', [req.params.id]);
        if (requests.length === 0) {
            return res.status(404).json({ message: 'Request not found' });
        }

        await db.execute(
            'UPDATE Requests SET Status = ? WHERE Request_ID = ?',
            [status, req.params.id]
        );

        res.json({ message: 'Request status updated successfully' });
    } catch (error) {
        console.error('Error updating request status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
