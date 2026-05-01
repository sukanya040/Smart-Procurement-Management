document.addEventListener('DOMContentLoaded', () => {
    // Verify auth
    const user = checkAuth('Admin');
    if (!user) return;

    // Navigation
    const views = {
        'nav-dashboard': 'view-dashboard',
        'nav-requests': 'view-requests',
        'nav-orders': 'view-orders',
        'nav-payments': 'view-payments'
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
                if (navId === 'nav-requests') loadRequests();
                if (navId === 'nav-orders') loadOrders();
                if (navId === 'nav-payments') loadPayments();
            });
        }
    });

    // Initial load
    loadDashboardStats();
    loadRequests();
    loadOrders();
    loadPayments();
});

async function loadDashboardStats() {
    try {
        const [requests, orders] = await Promise.all([
            apiCall('/requests'),
            apiCall('/orders')
        ]);

        let active = 0;
        orders.forEach(order => {
            if (order.Order_Status !== 'Completed') {
                active++;
            }
        });

        document.getElementById('stat-requests').textContent = requests.length;
        document.getElementById('stat-orders').textContent = orders.length;
        document.getElementById('stat-active').textContent = active;
    } catch (error) {
        console.error(error);
    }
}

async function loadRequests() {
    const tbody = document.getElementById('requests-body');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading requests...</td></tr>';

    try {
        const requests = await apiCall('/requests');
        
        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary">No requests found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        requests.forEach(req => {
            const statusClass = req.Status.toLowerCase();
            let actionBtn = '';
            
            if (req.Status === 'Pending') {
                const encItem = encodeURIComponent(req.Item_Name || '');
                const encCustomer = encodeURIComponent(req.CustomerName || '');
                const encDesc = encodeURIComponent(req.Description || 'None');
                actionBtn = `<button class="btn btn-sm btn-outline" onclick="openReviewModal(${req.Request_ID}, '${encItem}', '${encCustomer}', ${req.Quantity}, ${req.Budget}, '${encDesc}')">Review</button>`;
            }

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${req.Item_Name}</strong></td>
                <td>${req.Quantity}</td>
                <td>${formatCurrency(req.Budget)}</td>
                <td>${req.CustomerName}</td>
                <td><span class="status ${statusClass}">${req.Status}</span></td>
                <td>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load requests</td></tr>';
    }
}

async function loadOrders() {
    const tbody = document.getElementById('orders-body');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading orders...</td></tr>';

    try {
        const orders = await apiCall('/orders');
        
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary">No orders found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        orders.forEach(order => {
            const statusClass = order.Order_Status.toLowerCase().replace(' ', '-');
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${order.Item_Name}</strong></td>
                <td>${order.CustomerName}</td>
                <td>${order.SellerName}</td>
                <td>${formatCurrency(order.Price)}</td>
                <td><span class="status ${statusClass}">${order.Order_Status}</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load orders</td></tr>';
    }
}

async function loadPayments() {
    const tbody = document.getElementById('payments-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading payments...</td></tr>';

    try {
        const payments = await apiCall('/payments');
        
        if (payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary">No payments recorded.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        payments.forEach(payment => {
            const statusClass = payment.Payment_Status === 'Success' ? 'completed' : 'rejected';
            const dateStr = new Date(payment.Payment_Date).toLocaleString();
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${payment.Item_Name}</strong></td>
                <td>${payment.CustomerName}</td>
                <td>${payment.SellerName}</td>
                <td>${formatCurrency(payment.Amount)}</td>
                <td><span class="status ${statusClass}">${payment.Payment_Status}</span></td>
                <td>${dateStr}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load payments</td></tr>';
    }
}

window.openReviewModal = function(id, item, customer, qty, budget, desc) {
    document.getElementById('review-req-id').value = id;
    
    document.getElementById('review-details').innerHTML = `
        <p><strong>Customer:</strong> ${decodeURIComponent(customer)}</p>
        <p><strong>Item:</strong> ${decodeURIComponent(item)}</p>
        <p><strong>Quantity:</strong> ${qty}</p>
        <p><strong>Budget:</strong> <span style="color: var(--warning);">${formatCurrency(budget)}</span></p>
        <hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">
        <p><strong>Description/Requirements:</strong><br>${decodeURIComponent(desc)}</p>
    `;
    
    document.getElementById('modal-review').classList.add('active');
};

window.updateRequestStatus = async function(status) {
    const id = document.getElementById('review-req-id').value;
    
    try {
        await apiCall(`/requests/${id}/status`, 'PUT', { status });
        showNotification(`Request ${status} successfully`, 'success');
        closeModal('modal-review');
        loadRequests();
        loadDashboardStats();
    } catch (error) {
        // error handled
    }
};

window.closeModal = function(id) {
    document.getElementById(id).classList.remove('active');
};
