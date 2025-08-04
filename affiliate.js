// js/affiliate.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loadingState = document.getElementById('loading-state');
const affiliateView = document.getElementById('affiliate-view');
const nonAffiliateView = document.getElementById('non-affiliate-view');
const userNameEl = document.getElementById('user-name');
const pointsDisplayEl = document.getElementById('points-display');
const referralLinkInput = document.getElementById('referral-link');
const copyLinkBtn = document.getElementById('copy-link-btn');
const logoutButton = document.getElementById('logout-btn');

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is logged in, load their affiliate data
        loadAffiliateData(user);
    } else {
        // No user is signed in, redirect to the login page
        window.location.href = 'index.html';
    }
});

/**
 * Fetches the user's data from Firestore and displays the correct view.
 * @param {object} user - The authenticated user object from Firebase Auth.
 */
async function loadAffiliateData(user) {
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        loadingState.classList.add('hidden');

        if (userDocSnap.exists() && userDocSnap.data().isAffiliate === true) {
            // User is an approved affiliate
            const userData = userDocSnap.data();
            displayAffiliateDashboard(user, userData);
        } else {
            // User is not an affiliate
            displayNonAffiliateView();
        }
    } catch (error) {
        console.error("Error loading user data:", error);
        loadingState.textContent = "Error loading your data. Please try again.";
    }
}

/**
 * Displays the affiliate dashboard and populates it with data.
 * @param {object} user - The authenticated user object.
 * @param {object} userData - The user's data from Firestore.
 */
function displayAffiliateDashboard(user, userData) {
    nonAffiliateView.classList.add('hidden');
    affiliateView.classList.remove('hidden');

    userNameEl.textContent = user.displayName || 'Affiliate';
    pointsDisplayEl.textContent = userData.referralPoints || 0;

    // Generate and display the unique referral link
    const referralLink = `${window.location.origin}/index.html?ref=${user.uid}`;
    referralLinkInput.value = referralLink;
}

/**
 * Displays the view for users who are not part of the affiliate program.
 */
function displayNonAffiliateView() {
    affiliateView.classList.add('hidden');
    nonAffiliateView.classList.remove('hidden');
}

// --- EVENT LISTENERS ---
if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
        referralLinkInput.select();
        document.execCommand('copy');

        // Provide user feedback
        const originalIcon = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = `<i class="fas fa-check"></i>`;
        copyLinkBtn.classList.add('bg-green-500');

        setTimeout(() => {
            copyLinkBtn.innerHTML = originalIcon;
            copyLinkBtn.classList.remove('bg-green-500');
        }, 2000);
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Logout Error:", error));
    });
}