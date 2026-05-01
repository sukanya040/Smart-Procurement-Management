document.addEventListener('DOMContentLoaded', () => {
    // Verify auth
    const user = checkAuth('Seller');
    if (!user) return;

    // Navigation logic
    const views = {
        'nav-dashboard': 'view-dashboard',
        'nav-bids': 'view-bids',
        'nav-orders': 'view-orders'
    };

    Object.keys(views).forEach(navId => {
        const navEl = document.getElementById(navId);
        if (navEl) {
            navEl.addEventListener('click', () => {
                document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
                navEl.classList.add('active');

                Object.values(views).forEach(viewId => {
                    document.getElementById(viewId).classList.add('hidden');
                });
                document.getElementById(views[navId]).classList.remove('hidden');

                if (navId === 'nav-dashboard') loadDashboardStats();
                if (navId === 'nav-bids') loadAvailableRequests();
                if (navId === 'nav-orders') loadSellerOrders();
            });
        }
    });

    // Initial load
    loadDashboardStats();
    loadAvailableRequests();
    loadSellerOrders();
});

async function loadDashboardStats() {
    try {
        const [requests, orders] = await Promise.all([
            apiCall('/requests'),
            apiCall('/orders')
        ]);

        let activeOrders = orders.filter(o => o.Order_Status !== 'Completed').length;

        const reqStat = document.getElementById('stat-requests');
        const ordStat = document.getElementById('stat-orders');
        
        if (reqStat) reqStat.textContent = requests.length;
        if (ordStat) ordStat.textContent = activeOrders;
    } catch (error) {
        console.error(error);
    }
}

async function loadAvailableRequests() {
    const tbody = document.getElementById('requests-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading requests...</td></tr>';

    try {
        const requests = await apiCall('/requests');
        
        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary">No requests available for bidding at the moment.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        requests.forEach(req => {
            const statusClass = req.Status.toLowerCase();
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${req.Item_Name}</strong></td>
                <td>${req.Quantity}</td>
                <td>${formatCurrency(req.Budget)}</td>
                <td><span class="status ${statusClass}">${req.Status}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="openQuoteModal(${req.Request_ID})">Submit Quote</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load requests</td></tr>';
    }
}

async function loadSellerOrders() {
    const tbody = document.getElementById('orders-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading orders...</td></tr>';

    try {
        const orders = await apiCall('/orders');
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary">No active orders found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        orders.forEach(order => {
            const statusClass = order.Order_Status.toLowerCase().replace(' ', '-');
            
            let statusSelect = `
                <select class="form-control" style="padding: 0.3rem; font-size: 0.85rem;" onchange="updateOrderStatus(${order.Order_ID}, this.value)" ${order.Order_Status === 'Completed' ? 'disabled' : ''}>
                    <option value="Pending" ${order.Order_Status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="In Progress" ${order.Order_Status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Completed" ${order.Order_Status === 'Completed' ? 'selected' : ''}>Completed</option>
                </select>
            `;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${order.Item_Name}</strong></td>
                <td>${order.CustomerName}</td>
                <td>${formatCurrency(order.Price)}</td>
                <td><span class="status ${statusClass}">${order.Order_Status}</span></td>
                <td>${statusSelect}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load orders</td></tr>';
    }
}

window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        await apiCall(`/orders/${orderId}/status`, 'PUT', { status: newStatus });
        showNotification(`Order status updated to ${newStatus}`, 'success');
        loadSellerOrders();
        loadDashboardStats();
    } catch (error) {
        // error handled
    }
};

window.openQuoteModal = function(id) {
    document.getElementById('quote-req-id').value = id;
    const modal = document.getElementById('modal-quote');
    if (modal) modal.classList.add('active');
};

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
};

document.addEventListener('DOMContentLoaded', () => {
    const quoteForm = document.getElementById('form-submit-quote');
    if (quoteForm) {
        quoteForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = quoteForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

                await apiCall('/quotations', 'POST', {
                    request_id: document.getElementById('quote-req-id').value,
                    price: document.getElementById('quote-price').value,
                    delivery_time: document.getElementById('quote-delivery').value,
                    proposal: document.getElementById('quote-proposal').value
                });

                showNotification('Quotation submitted successfully!', 'success');
                quoteForm.reset();
                closeModal('modal-quote');
            } catch (error) {
                // error handled by apiCall
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }
});
