// js/business-login.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements for Forms and Buttons
    const formTitle = document.getElementById('form-title');

    const businessLoginForm = document.getElementById('business-login-form');
    const emailLoginInput = document.getElementById('business-email-login');
    const passwordLoginInput = document.getElementById('business-password-login');
    const loginButton = document.getElementById('business-login-btn');
    const loginStatusMessage = document.getElementById('login-status-message');
    const showSignupLink = document.getElementById('show-signup');

    const businessSignupForm = document.getElementById('business-signup-form');
    const emailSignupInput = document.getElementById('business-email-signup');
    const passwordSignupInput = document.getElementById('business-password-signup');
    const confirmPasswordSignupInput = document.getElementById('business-confirm-password-signup');
    const signupButton = document.getElementById('business-signup-btn');
    const signupStatusMessage = document.getElementById('signup-status-message');
    const showLoginLink = document.getElementById('show-login');

    // --- Form Toggle Logic ---
    function showLoginForm() {
        businessLoginForm.classList.remove('hidden');
        businessSignupForm.classList.add('hidden');
        formTitle.textContent = 'Owner Login';
        loginStatusMessage.textContent = ''; // Clear status messages
        signupStatusMessage.textContent = '';
        businessLoginForm.reset(); // Clear form fields
    }

    function showSignupForm() {
        businessLoginForm.classList.add('hidden');
        businessSignupForm.classList.remove('hidden');
        formTitle.textContent = 'Owner Signup';
        loginStatusMessage.textContent = ''; // Clear status messages
        signupStatusMessage.textContent = '';
        businessSignupForm.reset(); // Clear form fields
    }

    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            showSignupForm();
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginForm();
        });
    }

    // --- Login Form Submission ---
    if (businessLoginForm) {
        businessLoginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            loginButton.disabled = true;
            loginButton.textContent = 'Logging in...';
            loginStatusMessage.textContent = ''; // Clear previous messages
            loginStatusMessage.classList.remove('text-red-500', 'text-emerald-400'); // Reset color

            const email = emailLoginInput.value.trim();
            const password = passwordLoginInput.value.trim();

            if (!email || !password) {
                loginStatusMessage.textContent = "Please enter both email and password.";
                loginStatusMessage.classList.add('text-red-500');
                loginButton.disabled = false;
                loginButton.textContent = 'Login to Dashboard';
                return;
            }

            try {
                // Sign in with email and password
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                console.log("Business owner logged in:", userCredential.user.uid);
                loginStatusMessage.textContent = "Login successful! Redirecting...";
                loginStatusMessage.classList.add('text-emerald-400');

                // Redirect to the business dashboard
                setTimeout(() => {
                    window.location.href = 'business-dashboard.html';
                }, 1500); // Redirect after a short delay

            } catch (error) {
                console.error("Business Login Error:", error.code, error.message);
                let errorMessage = "Login failed. Please check your email and password.";
                if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                    errorMessage = "Invalid email or password.";
                } else if (error.code === 'auth/too-many-requests') {
                    errorMessage = "Too many login attempts. Please try again later.";
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = "Invalid email format.";
                }
                loginStatusMessage.textContent = errorMessage;
                loginStatusMessage.classList.add('text-red-500');
            } finally {
                loginButton.disabled = false;
                loginButton.textContent = 'Login to Dashboard';
            }
        });
    }

    // --- Signup Form Submission ---
    if (businessSignupForm) {
        businessSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            signupButton.disabled = true;
            signupButton.textContent = 'Creating Account...';
            signupStatusMessage.textContent = ''; // Clear previous messages
            signupStatusMessage.classList.remove('text-red-500', 'text-emerald-400'); // Reset color

            const email = emailSignupInput.value.trim();
            const password = passwordSignupInput.value.trim();
            const confirmPassword = confirmPasswordSignupInput.value.trim();

            if (!email || !password || !confirmPassword) {
                signupStatusMessage.textContent = "Please fill in all fields.";
                signupStatusMessage.classList.add('text-red-500');
                signupButton.disabled = false;
                signupButton.textContent = 'Create Account';
                return;
            }

            if (password.length < 6) {
                signupStatusMessage.textContent = "Password must be at least 6 characters long.";
                signupStatusMessage.classList.add('text-red-500');
                signupButton.disabled = false;
                signupButton.textContent = 'Create Account';
                return;
            }

            if (password !== confirmPassword) {
                signupStatusMessage.textContent = "Passwords do not match.";
                signupStatusMessage.classList.add('text-red-500');
                signupButton.disabled = false;
                signupButton.textContent = 'Create Account';
                return;
            }

            try {
                // Create user with email and password
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                console.log("New business owner signed up:", userCredential.user.uid);
                signupStatusMessage.textContent = "Account created successfully! Redirecting to dashboard...";
                signupStatusMessage.classList.add('text-emerald-400');

                // Redirect to the business dashboard after signup
                setTimeout(() => {
                    window.location.href = 'business-dashboard.html';
                }, 1500); // Redirect after a short delay

            } catch (error) {
                console.error("Business Signup Error:", error.code, error.message);
                let errorMessage = "Account creation failed. Please try again.";
                if (error.code === 'auth/email-already-in-use') {
                    errorMessage = "This email is already registered. Please login or use a different email.";
                } else if (error.code === 'auth/invalid-email') {
                    errorMessage = "Invalid email format.";
                } else if (error.code === 'auth/weak-password') {
                    errorMessage = "Password is too weak. Please choose a stronger password.";
                }
                signupStatusMessage.textContent = errorMessage;
                signupStatusMessage.classList.add('text-red-500');
            } finally {
                signupButton.disabled = false;
                signupButton.textContent = 'Create Account';
            }
        });
    }
});