// js/deals.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    onSnapshot,
    getDocs,
    doc, 
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Elements ---
let logoutButton;
let dealsListContainer;
let dealTownFilter;
let dealCategoryFilter;
let noDealsMessage;
let loadingDealsMessage; // New loading message element

let currentFilters = {
    town: 'all',
    category: 'all'
};
let userHometown = ''; // To store the user's hometown from their profile
let currentLoggedInUser = null; // To store the current authenticated user

// --- DOM CONTENT LOADED ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    logoutButton = document.getElementById('logout-btn');
    dealsListContainer = document.getElementById('deals-list-container');
    dealTownFilter = document.getElementById('deal-location');
    dealCategoryFilter = document.getElementById('deal-category');
    noDealsMessage = document.getElementById('no-deals-message');
    loadingDealsMessage = document.getElementById('loading-deals-message');
    
    // --- AUTHENTICATION CHECK ---
    onAuthStateChanged(auth, async (user) => {
        currentLoggedInUser = user; // Set currentLoggedInUser regardless of login status

        if (user) {
            console.log("User logged in:", user.uid);
            // Fetch user's hometown
            const userDocRef = doc(db, "users", user.uid);
            try {
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists() && userDocSnap.data().hometown) {
                    userHometown = userDocSnap.data().hometown;
                    console.log("User's hometown:", userHometown);
                    // Populate the dropdown with hometown and then fetch deals
                    populateTownDropdown(userHometown);
                } else {
                    console.log("User hometown not found, populating with default.");
                    populateTownDropdown('');
                }
            } catch (error) {
                console.error("Error fetching user hometown:", error);
                populateTownDropdown('');
            }
        } else {
            console.log("User not logged in.");
            // Populate dropdown with default if not logged in
            populateTownDropdown('');
            // Start listening for deals for all locations
            listenForDeals();
        }
    });

    // --- EVENT LISTENERS ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = 'index.html'; // Redirect to login page after logout
            } catch (error) {
                console.error('Error logging out:', error);
            }
        });
    }

    if (dealTownFilter) {
        dealTownFilter.addEventListener('change', (e) => {
            currentFilters.town = e.target.value;
            listenForDeals();
        });
    }

    if (dealCategoryFilter) {
        dealCategoryFilter.addEventListener('change', (e) => {
            currentFilters.category = e.target.value;
            listenForDeals();
        });
    }
});


// --- FIREBASE FUNCTIONS ---

// Populates the town filter dropdown and sets the user's hometown if available.
function populateTownDropdown(hometown) {
    // Only proceed if the dropdown exists
    if (!dealTownFilter) return;

    // Clear existing options
    dealTownFilter.innerHTML = '<option value="all">All Locations</option>';

    // Add user's hometown if available and not already in the list
    if (hometown && hometown !== 'all') {
        const hometownOption = document.createElement('option');
        hometownOption.value = hometown;
        hometownOption.textContent = hometown;
        dealTownFilter.appendChild(hometownOption);
        dealTownFilter.value = hometown; // Select the hometown
        currentFilters.town = hometown; // Set the current filter
    }
    
    // Fetch all unique towns from the deals collection
    const dealsRef = collection(db, "deals");
    getDocs(dealsRef).then(snapshot => {
        const towns = new Set();
        snapshot.forEach(doc => {
            const dealData = doc.data();
            if (dealData.town) {
                towns.add(dealData.town);
            }
        });

        // Add other unique towns to the dropdown
        towns.forEach(town => {
            if (town !== hometown) { // Avoid adding hometown twice
                const option = document.createElement('option');
                option.value = town;
                option.textContent = town;
                dealTownFilter.appendChild(option);
            }
        });

        // Now that the dropdown is populated, start listening for deals
        listenForDeals();
    }).catch(error => {
        console.error("Error fetching towns:", error);
    });
}

/**
 * Listens for real-time updates to the deals collection based on current filters.
 */
function listenForDeals() {
    console.log("Listening for deals with filters:", currentFilters);

    if (!dealsListContainer || !noDealsMessage) {
        console.error("DOM elements not found for deals list.");
        return;
    }

    // Show loading message, hide "no deals" message and clear the list
    loadingDealsMessage.classList.remove('hidden');
    noDealsMessage.classList.add('hidden');
    dealsListContainer.innerHTML = '';
    
    // Build the query
    let dealsQuery = collection(db, "deals");
    
    if (currentFilters.town !== 'all') {
        dealsQuery = query(dealsQuery, where('town', '==', currentFilters.town));
    }
    if (currentFilters.category !== 'all') {
        dealsQuery = query(dealsQuery, where('category', '==', currentFilters.category));
    }
    
    // onSnapshot provides real-time updates
    const unsubscribe = onSnapshot(dealsQuery, async (querySnapshot) => {
        const deals = [];
        const businessIds = new Set();

        // Collect all deals and unique business IDs
        querySnapshot.forEach(doc => {
            const dealData = doc.data();
            dealData.id = doc.id;
            deals.push(dealData);
            if (dealData.businessId) {
                businessIds.add(dealData.businessId);
            }
        });
        
        // Hide loading message
        loadingDealsMessage.classList.add('hidden');

        if (deals.length === 0) {
            noDealsMessage.classList.remove('hidden');
            dealsListContainer.innerHTML = '';
        } else {
            noDealsMessage.classList.add('hidden');
            // Fetch business data for all unique businesses
            const businessDataMap = new Map();
            for (const businessId of businessIds) {
                const businessDocRef = doc(db, "businesses", businessId);
                const businessDocSnap = await getDoc(businessDocRef);
                if (businessDocSnap.exists()) {
                    businessDataMap.set(businessId, businessDocSnap.data());
                }
            }

            // Clear the container before rendering
            dealsListContainer.innerHTML = '';

            // Render all deals with their business data
            deals.forEach(deal => {
                const businessData = businessDataMap.get(deal.businessId);
                if (businessData) {
                    renderDealCard(deal, businessData);
                }
            });
        }
    }, (error) => {
        console.error("Error fetching deals:", error);
        loadingDealsMessage.classList.add('hidden');
        noDealsMessage.textContent = 'Failed to load deals. Please try again.';
        noDealsMessage.classList.remove('hidden');
    });

    // You might want to store this unsubscribe function if you need to stop listening later
    // e.g., unsubscribe();
}

/**
 * Renders a single deal card with the new design.
 * @param {object} deal - The deal document data.
 * @param {object} businessData - The business document data.
 */
function renderDealCard(deal, businessData) {
    const dealCard = document.createElement('div');
    dealCard.className = 'deal-card bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300';
    dealCard.dataset.dealId = deal.id;

    const expiryDate = deal.expiryDate ? new Date(deal.expiryDate.seconds * 1000) : null;
    const expiryText = expiryDate ? `Expires on: ${expiryDate.toLocaleDateString()}` : 'No expiry date';
    const imageUrl = deal.imageUrl || 'https://placehold.co/600x400/94a3b8/ffffff?text=No+Image';
    const businessLogoUrl = businessData.imageUrl || 'https://placehold.co/50x50/333/ffffff?text=logo';

    dealCard.innerHTML = `
        <div class="relative">
            <img src="${imageUrl}" alt="${deal.title}" class="w-full h-48 object-cover">
            <span class="deal-badge bg-red-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-md">DEAL</span>
        </div>
        <div class="p-6">
            <h3 class="text-xl font-bold text-gray-900 mb-2">${deal.title}</h3>
            <p class="text-gray-600 text-sm mb-4">${deal.description}</p>
            <div class="flex items-center mb-4">
                <img src="${businessLogoUrl}" alt="Business Logo" class="w-10 h-10 rounded-full border-2 border-blue-600 shadow-md">
                <div class="ml-3">
                    <p class="font-semibold text-gray-800">${businessData.name}</p>
                    <p class="text-xs text-gray-500">${expiryText}</p>
                </div>
            </div>
            <a href="business-detail.html?id=${deal.businessId}" class="w-full bg-blue-600 text-white text-center font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center justify-center">
                <i class="fas fa-store mr-2"></i>
                View Business
            </a>
        </div>
    `;

    dealsListContainer.appendChild(dealCard);
}


// --- CUSTOM MESSAGE BOX (instead of alert) ---
function displayMessage(message, type = "info") {
    const messageBox = document.createElement('div');
    const baseClasses = 'fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white z-[1000] transform transition-transform duration-300 ease-in-out';
    const typeClasses = {
        info: 'bg-blue-500',
        error: 'bg-red-500',
        success: 'bg-green-500'
    };

    messageBox.className = `${baseClasses} ${typeClasses[type]} translate-x-full`;
    messageBox.textContent = message;
    document.body.appendChild(messageBox);

    // Animate in
    setTimeout(() => {
        messageBox.style.transform = 'translateX(0)';
    }, 100);

    // Animate out and remove after 5 seconds
    setTimeout(() => {
        messageBox.style.transform = 'translateX(150%)';
        messageBox.addEventListener('transitionend', () => {
            messageBox.remove();
        });
    }, 5000);
}
