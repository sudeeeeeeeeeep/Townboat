// js/deals.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    getDocs,
    doc, getDoc
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

let currentFilters = {
    town: '',
    category: ''
};
let userHometown = ''; // To store the user's hometown from their profile
let currentLoggedInUser = null; // To store the current authenticated user

// --- DOM CONTENT LOADED ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    logoutButton = document.getElementById('logout-btn');
    dealsListContainer = document.getElementById('deals-list-container');
    dealTownFilter = document.getElementById('deal-town-filter');
    dealCategoryFilter = document.getElementById('deal-category-filter');
    noDealsMessage = document.getElementById('no-deals-message');

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
                    
                    // Populate the dropdown first, then set its value
                    await populateTownFilter(); 
                    if (dealTownFilter && Array.from(dealTownFilter.options).some(opt => opt.value === userHometown)) {
                        dealTownFilter.value = userHometown;
                        currentFilters.town = userHometown; // Update the current filter state
                    }
                } else {
                    console.log("User has no hometown set. Redirecting to set-hometown page.");
                    window.location.href = 'set-hometown.html'; 
                    return;
                }
            } catch (error) {
                console.error("Error fetching user hometown:", error);
                await populateTownFilter(); // Populate anyway
            }
        } else {
            console.log("No user logged in. Displaying public content.");
            populateTownFilter(); // Populate filter for public users
        }
        fetchDeals(); // Always fetch deals, regardless of login status
    });

    // --- EVENT LISTENERS FOR FILTERS ---
    if (dealTownFilter) {
        dealTownFilter.addEventListener('change', (e) => {
            currentFilters.town = e.target.value;
            fetchDeals();
        });
    }

    if (dealCategoryFilter) {
        dealCategoryFilter.addEventListener('change', (e) => {
            currentFilters.category = e.target.value;
            fetchDeals();
        });
    }

    // --- LOGOUT BUTTON ---
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).then(() => {
                console.log("User signed out.");
                window.location.href = 'login.html';
            }).catch((error) => {
                console.error("Error signing out:", error);
                alert("Failed to log out. Please try again.");
            });
        });
    }
});

// --- POPULATE TOWN FILTER ---
async function populateTownFilter() {
    if (!dealTownFilter) return;

    dealTownFilter.innerHTML = '<option value="">All Towns</option>';
    try {
        const townsCollectionRef = collection(db, "towns");
        const q = query(townsCollectionRef, orderBy("name"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn("No towns found in the 'towns' collection.");
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No Towns Available';
            option.disabled = true;
            dealTownFilter.appendChild(option);
        } else {
            querySnapshot.forEach((doc) => {
                const townData = doc.data();
                const option = document.createElement('option');
                option.value = townData.name; 
                option.textContent = townData.name;
                dealTownFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error fetching towns for deal filter:", error);
    }
}

// --- FETCH AND RENDER DEALS ---
function fetchDeals() {
    if (!dealsListContainer || !noDealsMessage) {
        console.error("Deals list container or message element not found.");
        return;
    }

    // Deals should be active and not expired
    let dealsQuery = query(
        collection(db, "deals"),
        where("isActive", "==", true),
        where("expiryDate", ">", new Date()), // Only show deals not yet expired
        orderBy("expiryDate", "asc") // Order by soonest expiring first
    );

    // Apply filters
    if (currentFilters.town) {
        dealsQuery = query(dealsQuery, where("town", "==", currentFilters.town));
    }
    if (currentFilters.category) {
        dealsQuery = query(dealsQuery, where("category", "==", currentFilters.category));
    }

    onSnapshot(dealsQuery, async (snapshot) => {
        dealsListContainer.innerHTML = ''; // Clear previous deals
        if (snapshot.empty) {
            noDealsMessage.textContent = 'No active deals found matching the criteria.';
            noDealsMessage.style.display = 'block';
        } else {
            noDealsMessage.style.display = 'none';
            for (const docSnapshot of snapshot.docs) {
                const deal = docSnapshot.data();
                const dealId = docSnapshot.id;

                // Fetch business details for the deal
                let businessName = 'Unknown Business';
                let businessPhone = '';
                let businessCategory = deal.category; // Use deal's category as fallback
                if (deal.businessId) {
                    try {
                        const businessDoc = await getDoc(doc(db, "businesses", deal.businessId));
                        if (businessDoc.exists()) {
                            const businessData = businessDoc.data();
                            businessName = businessData.name || businessName;
                            businessPhone = businessData.phone || '';
                            businessCategory = businessData.category || businessCategory;
                        }
                    } catch (error) {
                        console.error("Error fetching business for deal:", deal.businessId, error);
                    }
                }

                const expiryDate = deal.expiryDate ? deal.expiryDate.toDate() : null;
                const now = new Date();
                const isExpired = expiryDate && expiryDate < now;
                const expiryText = isExpired ? '<span class="text-red-500">Expired</span>' : 
                                    (expiryDate ? `Expires: ${expiryDate.toLocaleDateString()} ${expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No expiry');

                const dealCard = document.createElement('div');
                dealCard.className = 'deal-card p-6 rounded-lg shadow-md flex flex-col deal-card-background';
                dealCard.innerHTML = `
                    <div class="deal-card-overlay"></div>
                    <a href="business-detail.html?id=${deal.businessId}" class="deal-card-content flex-grow no-underline text-current">
                        ${deal.imageUrl ? `<img src="${deal.imageUrl}" alt="${deal.title}" class="deal-image">` : ''}
                        <h3 class="text-2xl font-bold mb-2">${deal.title}</h3>
                        <p class="text-gray-600 mb-2">${deal.description}</p>
                        <p class="text-sm text-gray-600 mb-2"><strong>Business:</strong> ${businessName}</p>
                        <p class="text-sm text-gray-600 mb-2"><strong>Category:</strong> ${businessCategory}</p>
                        <p class="text-sm text-gray-600 mb-3"><strong>Town:</strong> ${deal.town}</p>
                        <p class="text-sm font-semibold mb-4">${expiryText}</p>
                        <!-- The call button is outside this anchor to allow separate click action -->
                    </a>
                    ${businessPhone ? `<a href="tel:${businessPhone}" class="mt-auto bg-emerald-600 text-white text-center py-2 px-4 rounded-lg hover:bg-emerald-700 transition duration-300 relative z-20">Call Business</a>` : ''}
                `;
                dealsListContainer.appendChild(dealCard);
            }
        }
    }, (error) => {
        console.error("Error fetching deals:", error);
        noDealsMessage.textContent = 'Failed to load deals. Please try again later.';
        noDealsMessage.style.display = 'block';
    });
}