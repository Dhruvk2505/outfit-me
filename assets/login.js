document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const toggleAuthText = document.getElementById('toggle-auth-text');
    const toggleAuthLink = document.getElementById('toggle-auth-link');

    let isLoginForm = true;

    const toggleForms = (e) => {
        if (e) e.preventDefault(); 

        if (isLoginForm) {
            // Switch to Signup
            loginForm.classList.add('hidden');
            signupForm.classList.remove('hidden');
            authTitle.textContent = 'Sign Up';
            authSubtitle.textContent = 'Welcome to Style AI! Create an account to get started.';
            toggleAuthText.textContent = 'Already have an account?';
            toggleAuthLink.textContent = 'Log In';
        } else {
            // Switch to Login
            signupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
            authTitle.textContent = 'Log In';
            authSubtitle.textContent = 'Welcome back! Please log in to your account.';
            toggleAuthText.textContent = 'Don\'t have an account?';
            toggleAuthLink.textContent = 'Sign Up';
        }
        isLoginForm = !isLoginForm;
    };

    toggleAuthLink.addEventListener('click', toggleForms);

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Login attempt simulated. Needs a backend to succeed.');
    });

    signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Signup attempt simulated. Needs a backend to succeed.');
    });
});