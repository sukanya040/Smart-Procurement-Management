const API_URL = 'http://localhost:3000';

async function apiCall(endpoint, method = 'GET', body = null) {
    const token = localStorage.getItem('spms_token');
    const headers = {
        'Content-Type': 'application/json'
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong');
        }

        return data;
    } catch (error) {
        showNotification(error.message, 'error');
        if (error.message === 'Invalid or expired token' || error.message === 'No token provided, authorization denied') {
            logout();
        }
        throw error;
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-area');
    if (!container) return;

    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `
        <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(notif);

    // Trigger reflow for animation
    setTimeout(() => {
        notif.style.opacity = '1';
        notif.style.transform = 'translateY(0)';
    }, 10);

    setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.transform = 'translateY(-20px)';
        setTimeout(() => notif.remove(), 300);
    }, 3000);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function checkAuth(requiredRole = null) {
    const token = localStorage.getItem('spms_token');
    const userStr = localStorage.getItem('spms_user');

    if (!token || !userStr) {
        window.location.href = '/index.html';
        return null;
    }

    try {
        const user = JSON.parse(userStr);
        if (requiredRole && user.role !== requiredRole) {
            showNotification('Unauthorized access', 'error');
            setTimeout(() => {
                if (user.role === 'Customer') window.location.href = '/customer.html';
                else if (user.role === 'Seller') window.location.href = '/seller.html';
                else if (user.role === 'Admin') window.location.href = '/admin.html';
            }, 1000);
            return null;
        }

        // Set user info in UI if available
        const nameEl = document.getElementById('user-name');
        const roleEl = document.getElementById('user-role');
        const avatarEl = document.getElementById('user-avatar');
        
        if (nameEl) nameEl.textContent = user.name;
        if (roleEl) roleEl.textContent = user.role;
        if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();

        return user;
    } catch (e) {
        logout();
        return null;
    }
}

function logout() {
    localStorage.removeItem('spms_token');
    localStorage.removeItem('spms_user');
    window.location.href = '/index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
});
