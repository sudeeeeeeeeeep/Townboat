// js/data-panel.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ELEMENTS ---
const adminDashboardContent = document.getElementById('admin-dashboard-content');
const logoutButton = document.getElementById('logout-btn');
const totalUsersCountEl = document.getElementById('total-users-count');
const totalAffiliatesCountEl = document.getElementById('total-affiliates-count');
const affiliateLeaderboardList = document.getElementById('affiliate-leaderboard-list');
const noAffiliatesMsg = document.getElementById('no-affiliates-msg');
const totalBusinessesCountEl = document.getElementById('total-businesses-count');
const approvedBusinessesCountEl = document.getElementById('approved-businesses-count');
const pendingBusinessesCountEl = document.getElementById('pending-businesses-count');
const userCountEl = document.getElementById('user-count');

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // For simplicity, we're assuming anyone accessing this page should be an admin.
        // For higher security, you would re-check admin status here.
        adminDashboardContent.classList.remove('hidden');
        await fetchAnalyticsAndAffiliates();
    } else {
        // If no user is logged in, redirect to the admin login page
        window.location.href = 'admin-login.html';
    }
});

/**
 * Fetches general platform analytics and affiliate data.
 */
async function fetchAnalyticsAndAffiliates() {
    try {
        // Fetch all users for counts and affiliate leaderboard
        const usersSnapshot = await getDocs(collection(db, "users"));
        const allUsers = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 1. Update User and Affiliate Counts
        totalUsersCountEl.textContent = allUsers.length;
        const affiliates = allUsers.filter(user => user.isAffiliate === true);
        totalAffiliatesCountEl.textContent = affiliates.length;

        // 2. Fetch business analytics
        const businessSnapshot = await getDocs(collection(db, "businesses"));
        const allBusinessesData = businessSnapshot.docs.map(doc => doc.data());
        totalBusinessesCountEl.textContent = allBusinessesData.length;
        approvedBusinessesCountEl.textContent = allBusinessesData.filter(b => b.status === 'approved').length;
        pendingBusinessesCountEl.textContent = allBusinessesData.filter(b => b.status === 'pending').length;
        userCountEl.textContent = new Set(allBusinessesData.map(b => b.ownerEmail).filter(Boolean)).size;
        
        // 3. Populate Affiliate Leaderboard
        if (affiliates.length > 0) {
            noAffiliatesMsg.classList.add('hidden');
            affiliateLeaderboardList.innerHTML = ''; // Clear previous entries

            // Sort affiliates by referral points, descending
            affiliates.sort((a, b) => (b.referralPoints || 0) - (a.referralPoints || 0));

            affiliates.forEach(affiliate => {
                const affiliateItem = createAffiliateItem(affiliate);
                affiliateLeaderboardList.appendChild(affiliateItem);
            });
        } else {
            noAffiliatesMsg.classList.remove('hidden');
            affiliateLeaderboardList.innerHTML = '';
        }

    } catch (error) {
        console.error("Error fetching analytics and affiliates:", error);
    }
}

/**
 * Creates an HTML element for a single affiliate in the leaderboard.
 * @param {object} affiliateData - The data for a single affiliate user.
 * @returns {HTMLElement} The created div element.
 */
function createAffiliateItem(affiliateData) {
    const div = document.createElement('div');
    div.className = 'affiliate-item bg-gray-800 p-3 rounded-lg text-sm';
    
    div.innerHTML = `
        <div>
            <p class="font-semibold text-white">${affiliateData.name || 'Unnamed Affiliate'}</p>
            <p class="text-gray-400 text-xs">${affiliateData.email}</p>
        </div>
        <div>
            <p class="text-gray-400 text-xs">Points</p>
            <p class="font-bold text-xl text-pink-400">${affiliateData.referralPoints || 0}</p>
        </div>
        <div>
            <button data-uid="${affiliateData.id}" class="toggle-affiliate-btn bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 text-xs">
                Manage
            </button>
        </div>
    `;
    return div;
}

// --- EVENT LISTENERS ---
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Logout Error:", error));
    });
}