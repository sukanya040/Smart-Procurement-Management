const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// Get all orders (Admin sees all, Customer sees their own, Seller sees their own)
router.get('/', verifyToken, async (req, res) => {
    try {
        let query = `
            SELECT o.*, r.Item_Name, q.Price, u.Name as CustomerName, s.Name as SellerName
            FROM Orders o
            JOIN Requests r ON o.Request_ID = r.Request_ID
            JOIN Quotations q ON o.Quote_ID = q.Quote_ID
            JOIN Users u ON r.User_ID = u.User_ID
            JOIN Users s ON o.Seller_ID = s.User_ID
        `;
        let params = [];

        if (req.user.role === 'Customer') {
            query += ' WHERE r.User_ID = ?';
            params.push(req.user.userId);
        } else if (req.user.role === 'Seller') {
            query += ' WHERE o.Seller_ID = ?';
            params.push(req.user.userId);
        }

        query += ' ORDER BY o.Created_At DESC';

        const [orders] = await db.execute(query, params);
        res.json(orders);
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Update order status (Seller or Admin)
router.put('/:id/status', verifyToken, requireRole(['Seller', 'Admin']), async (req, res) => {
    try {
        const { status } = req.body;

        if (!['Pending', 'In Progress', 'Completed'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const [orders] = await db.execute('SELECT * FROM Orders WHERE Order_ID = ?', [req.params.id]);
        if (orders.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const order = orders[0];
        if (req.user.role === 'Seller' && order.Seller_ID !== req.user.userId) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await db.execute(
            'UPDATE Orders SET Order_Status = ? WHERE Order_ID = ?',
            [status, req.params.id]
        );

        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;
