// js/about.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- DOM Elements ---
const getElementByIdOrLog = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: DOM element with ID '${id}' not found.`);
    }
    return element;
};

const mobileMenuButton = getElementByIdOrLog('mobile-menu-button');
const mobileMenuDropdown = getElementByIdOrLog('mobile-menu-dropdown');
const logoutButtonDesktop = getElementByIdOrLog('logout-btn-desktop');
const logoutButtonMobile = getElementByIdOrLog('logout-btn-mobile');
const authButtonsDesktopContainer = getElementByIdOrLog('auth-buttons-desktop');
const authButtonsMobileContainer = getElementByIdOrLog('auth-buttons-mobile');

// --- Helper Functions ---
function renderAuthButtons(isAuthenticated) {
    // Clear existing buttons
    if (authButtonsDesktopContainer) authButtonsDesktopContainer.innerHTML = '';
    if (authButtonsMobileContainer) authButtonsMobileContainer.innerHTML = '';
    
    if (isAuthenticated) {
        if (logoutButtonDesktop) logoutButtonDesktop.classList.remove('hidden');
        if (logoutButtonMobile) logoutButtonMobile.classList.remove('hidden');
    } else {
        if (logoutButtonDesktop) logoutButtonDesktop.classList.add('hidden');
        if (logoutButtonMobile) logoutButtonMobile.classList.add('hidden');

        const loginBtn = `<a href="index.html" class="bg-gray-200 text-gray-800 px-4 py-2 rounded-full font-bold hover:bg-gray-300 transition">Log In</a>`;
        const signupBtn = `<a href="index.html" class="bg-blue-500 text-white px-4 py-2 rounded-full font-bold hover:bg-blue-600 transition">Sign Up</a>`;
        
        if (authButtonsDesktopContainer) {
            authButtonsDesktopContainer.innerHTML = `${loginBtn}${signupBtn}`;
        }
        if (authButtonsMobileContainer) {
            authButtonsMobileContainer.innerHTML = `<a href="index.html" class="bg-gray-200 text-gray-800 px-4 py-2 rounded-full font-bold hover:bg-gray-300 transition block text-center">Log In</a>
                                                <a href="index.html" class="bg-blue-500 text-white px-4 py-2 rounded-full font-bold hover:bg-blue-600 transition block text-center">Sign Up</a>`;
        }
    }
}

// --- Event Listeners ---
if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', () => {
        if (mobileMenuDropdown) {
            mobileMenuDropdown.classList.toggle('hidden');
        }
    });
}

if (logoutButtonDesktop) {
    logoutButtonDesktop.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("User signed out.");
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error("Error signing out:", error);
            // In a real app, you'd show a user-facing message here.
        });
    });
}

if (logoutButtonMobile) {
    logoutButtonMobile.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("User signed out.");
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error("Error signing out:", error);
            // In a real app, you'd show a user-facing message here.
        });
    });
}

// --- AUTHENTICATION STATE OBSERVER ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        console.log("User is logged in:", user.uid);
        renderAuthButtons(true);
    } else {
        // User is signed out
        console.log("User is logged out.");
        renderAuthButtons(false);
    }
});
