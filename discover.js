// js/discover.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    // This block previously contained:
    // if (!user) {
    //     window.location.href = 'index.html'; // Redirect if not logged in
    // }
    // This line has been removed.
    // Now, the page will simply load for all users, regardless of their login status.
    if (user) {
        console.log("User logged in:", user.uid);
    } else {
        console.log("No user logged in. Allowing public view of Discover page.");
    }
});

// --- LOGOUT BUTTON ---
document.addEventListener('DOMContentLoaded', () => {
    const logoutButton = document.getElementById('logout-btn');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => signOut(auth));
    }

    // You can dynamically generate categories here if they were stored in Firestore
    // For now, we are using static HTML links for simplicity, as per MVP.
});