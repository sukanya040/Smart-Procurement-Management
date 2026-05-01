document.addEventListener('DOMContentLoaded', () => {
    // Verify auth
    const user = checkAuth('Customer');
    if (!user) return;

    // Navigation logic
    const views = {
        'nav-dashboard': 'view-dashboard',
        'nav-new-request': 'view-new-request',
        'nav-orders': 'view-orders'
    };

    Object.keys(views).forEach(navId => {
        const navEl = document.getElementById(navId);
        if (navEl) {
            navEl.addEventListener('click', () => {
                // Update active state
                document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
                navEl.classList.add('active');

                // Hide all views
                Object.values(views).forEach(viewId => {
                    document.getElementById(viewId).classList.add('hidden');
                });
                
                // Show target view
                document.getElementById(views[navId]).classList.remove('hidden');

                // Reload data if needed
                if (navId === 'nav-dashboard') loadCustomerRequests();
                if (navId === 'nav-orders') loadCustomerOrders();
            });
        }
    });

    // Form submission
    const reqForm = document.getElementById('form-create-request');
    if (reqForm) {
        reqForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = reqForm.querySelector('button');
            const originalText = btn.innerHTML;
            
            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                
                const item_name = document.getElementById('req-item').value;
                const quantity = document.getElementById('req-qty').value;
                const budget = document.getElementById('req-budget').value;
                const description = document.getElementById('req-desc').value;

                await apiCall('/requests', 'POST', { item_name, quantity, budget, description });
                
                showNotification('Purchase request submitted successfully!', 'success');
                reqForm.reset();
                
                // Go back to dashboard
                document.getElementById('nav-dashboard').click();
            } catch (error) {
                // error handled by apiCall
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }

    // Initial load
    loadCustomerRequests();
    loadCustomerOrders();
});

async function loadCustomerRequests() {
    const tbody = document.getElementById('requests-body');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading requests...</td></tr>';

    try {
        const requests = await apiCall('/requests');
        
        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-secondary">No requests found. Create a new request to get started.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        requests.forEach(req => {
            const statusClass = req.Status.toLowerCase();
            const dateStr = new Date(req.Created_At).toLocaleDateString();
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${req.Item_Name}</strong></td>
                <td>${req.Quantity}</td>
                <td>${formatCurrency(req.Budget)}</td>
                <td>${dateStr}</td>
                <td><span class="status ${statusClass}">${req.Status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="viewQuotes(${req.Request_ID}, '${req.Status}')"><i class="fas fa-eye"></i> View Quotes</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load requests</td></tr>';
    }
}

let currentQuoteToPay = null;

window.viewQuotes = async function(requestId, status) {
    if (status !== 'Approved') {
        showNotification('Quotes are only available for Approved requests.', 'error');
        return;
    }
    
    const tbody = document.getElementById('quotes-body');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
    document.getElementById('modal-quotes').classList.add('active');

    try {
        const quotes = await apiCall(`/quotations/request/${requestId}`);
        if (quotes.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary">No quotations received yet.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        quotes.forEach(quote => {
            const tr = document.createElement('tr');
            let actionBtn = '';
            
            if (quote.Status === 'Pending') {
                actionBtn = `<button class="btn btn-sm btn-primary" onclick="acceptQuote(${quote.Quote_ID}, ${quote.Price}, '${quote.SellerName}', ${requestId})">Accept</button>`;
            } else if (quote.Status === 'Accepted') {
                actionBtn = `<button class="btn btn-sm btn-success" disabled>Accepted</button>`;
            } else {
                actionBtn = `<button class="btn btn-sm btn-outline" disabled>Rejected</button>`;
            }

            tr.innerHTML = `
                <td>${quote.SellerName}</td>
                <td>${formatCurrency(quote.Price)}</td>
                <td>${quote.Delivery_Time || 'N/A'}</td>
                <td>${quote.Proposal || 'N/A'}</td>
                <td>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Failed to load quotations</td></tr>';
    }
};

window.acceptQuote = async function(quoteId, price, sellerName, requestId) {
    try {
        await apiCall(`/quotations/${quoteId}/accept`, 'PUT');
        closeModal('modal-quotes');
        showNotification('Quotation accepted! Redirecting to payment...', 'success');
        
        currentQuoteToPay = { quoteId, price, sellerName, requestId };
        
        setTimeout(() => {
            document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.glass-panel').forEach(el => el.classList.add('hidden'));
            document.getElementById('view-payment').classList.remove('hidden');
            
            // Populate payment summary
            const tax = price * 0.05; // 5% tax
            const total = price + tax;
            document.getElementById('payment-summary').innerHTML = `
                <div class="flex" style="justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Seller:</span> <strong>${sellerName}</strong>
                </div>
                <div class="flex" style="justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Quoted Price:</span> <strong>${formatCurrency(price)}</strong>
                </div>
                <div class="flex" style="justify-content: space-between; margin-bottom: 0.5rem; color: var(--text-secondary);">
                    <span>Taxes (5%):</span> <strong>${formatCurrency(tax)}</strong>
                </div>
                <hr style="margin: 1rem 0; border: 0; border-top: 1px solid rgba(0,0,0,0.1);">
                <div class="flex" style="justify-content: space-between; font-size: 1.2rem; font-weight: bold; color: var(--primary);">
                    <span>Total Amount:</span> <span>${formatCurrency(total)}</span>
                </div>
            `;
        }, 1000);
    } catch (error) {
        // error handled
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const payForm = document.getElementById('form-payment');
    if (payForm) {
        payForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!currentQuoteToPay) return;

            const btn = payForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            
            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

                await apiCall('/payments', 'POST', {
                    quote_id: currentQuoteToPay.quoteId,
                    card_number: document.getElementById('pay-card').value,
                    expiry: document.getElementById('pay-expiry').value,
                    cvv: document.getElementById('pay-cvv').value
                });

                showNotification('Payment successful! Order has been placed.', 'success');
                payForm.reset();
                currentQuoteToPay = null;
                document.getElementById('nav-orders').click();
            } catch (error) {
                // error handled by apiCall
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        });
    }
});

async function loadCustomerOrders() {
    const tbody = document.getElementById('orders-body');
    if (!tbody) return;
    
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
            const actionBtn = `<button class="btn btn-sm btn-outline" onclick="trackOrder(${order.Order_ID}, '${order.Order_Status}')">Track</button>`;

            tr.innerHTML = `
                <td><strong>${order.Item_Name}</strong></td>
                <td>${order.SellerName}</td>
                <td>${formatCurrency(order.Price)}</td>
                <td><span class="status ${statusClass}">${order.Order_Status}</span></td>
                <td>${actionBtn}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Failed to load orders</td></tr>';
    }
}

window.trackOrder = function(orderId, status) {
    const modal = document.getElementById('modal-track');
    const progBar = document.getElementById('track-progress');
    
    document.getElementById('track-step-1').style.background = '#e2e8f0';
    document.getElementById('track-step-2').style.background = '#e2e8f0';
    document.getElementById('track-step-3').style.background = '#e2e8f0';
    progBar.style.width = '0%';

    setTimeout(() => {
        document.getElementById('track-step-1').style.background = 'var(--success)';
        if (status === 'Pending') {
            progBar.style.width = '10%';
        } else if (status === 'In Progress') {
            document.getElementById('track-step-2').style.background = 'var(--success)';
            progBar.style.width = '50%';
        } else if (status === 'Completed') {
            document.getElementById('track-step-2').style.background = 'var(--success)';
            document.getElementById('track-step-3').style.background = 'var(--success)';
            progBar.style.width = '100%';
        }
    }, 100);

    document.getElementById('track-details').innerHTML = `<p>Tracking information for Order #${orderId} is displayed below.</p>`;
    modal.classList.add('active');
};

window.closeModal = function(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
};
