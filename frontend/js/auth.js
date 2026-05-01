document.addEventListener('DOMContentLoaded', () => {
    const loginFormEl = document.getElementById('form-login');
    const registerFormEl = document.getElementById('form-register');
    
    const loginDiv = document.getElementById('login-form');
    const registerDiv = document.getElementById('register-form');

    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');

    // Toggle forms
    if (showRegisterLink && showLoginLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginDiv.classList.add('hidden');
            registerDiv.classList.remove('hidden');
        });

        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            registerDiv.classList.add('hidden');
            loginDiv.classList.remove('hidden');
        });
    }

    // Redirect if already logged in
    const token = localStorage.getItem('spms_token');
    const userStr = localStorage.getItem('spms_user');
    if (token && userStr) {
        try {
            const user = JSON.parse(userStr);
            redirectToDashboard(user.role);
        } catch (e) {
            localStorage.clear();
        }
    }

    // Login Submission
    if (loginFormEl) {
        loginFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const btn = loginFormEl.querySelector('button[type="submit"]');

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

                const data = await apiCall('/auth/login', 'POST', { email, password });
                
                localStorage.setItem('spms_token', data.token);
                localStorage.setItem('spms_user', JSON.stringify(data.user));
                
                showNotification('Login successful!', 'success');
                setTimeout(() => redirectToDashboard(data.user.role), 1000);
            } catch (error) {
                // error handled by apiCall
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            }
        });
    }

    // Registration Submission
    if (registerFormEl) {
        registerFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const role = document.getElementById('reg-role').value;
            const password = document.getElementById('reg-password').value;
            const btn = registerFormEl.querySelector('button[type="submit"]');

            try {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

                await apiCall('/auth/register', 'POST', { name, email, role, password });
                
                showNotification('Registration successful! Please log in.', 'success');
                setTimeout(() => {
                    registerDiv.classList.add('hidden');
                    loginDiv.classList.remove('hidden');
                    document.getElementById('login-email').value = email;
                    document.getElementById('login-password').value = '';
                }, 1500);
            } catch (error) {
                // error handled by apiCall
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Register';
            }
        });
    }

    function redirectToDashboard(role) {
        if (role === 'Customer') window.location.href = '/customer.html';
        else if (role === 'Seller') window.location.href = '/seller.html';
        else if (role === 'Admin') window.location.href = '/admin.html';
    }
});
