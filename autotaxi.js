// js/autotaxi-list.js

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
let autotaxiListingsContainer;
let listingTownFilter;
let vehicleTypeFilter;
let noListingsMessage;

let currentFilters = {
    town: '',
    vehicleType: ''
};
let userHometown = ''; // To store the user's hometown from their profile

// --- DOM CONTENT LOADED ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    logoutButton = document.getElementById('logout-btn');
    autotaxiListingsContainer = document.getElementById('autotaxi-listings-container');
    listingTownFilter = document.getElementById('listing-town-filter');
    vehicleTypeFilter = document.getElementById('vehicle-type-filter');
    noListingsMessage = document.getElementById('no-listings-message');

    // --- AUTHENTICATION CHECK ---
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log("No user logged in, redirecting to index.html");
            window.location.href = 'index.html';
        } else {
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
                    if (listingTownFilter && Array.from(listingTownFilter.options).some(opt => opt.value === userHometown)) {
                        listingTownFilter.value = userHometown;
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
            fetchAutoTaxiListings(); // Fetch listings based on filters
        }
    });

    // --- EVENT LISTENERS FOR FILTERS ---
    if (listingTownFilter) {
        listingTownFilter.addEventListener('change', (e) => {
            currentFilters.town = e.target.value;
            fetchAutoTaxiListings();
        });
    }

    if (vehicleTypeFilter) {
        vehicleTypeFilter.addEventListener('change', (e) => {
            currentFilters.vehicleType = e.target.value;
            fetchAutoTaxiListings();
        });
    }

    // --- LOGOUT BUTTON ---
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            signOut(auth).then(() => {
                console.log("User signed out.");
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error("Error signing out:", error);
                alert("Failed to log out. Please try again.");
            });
        });
    }
});

// --- POPULATE TOWN FILTER ---
async function populateTownFilter() {
    if (!listingTownFilter) return;

    listingTownFilter.innerHTML = '<option value="">All Towns</option>';
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
            listingTownFilter.appendChild(option);
        } else {
            querySnapshot.forEach((doc) => {
                const townData = doc.data();
                const option = document.createElement('option');
                option.value = townData.name; 
                option.textContent = townData.name;
                listingTownFilter.appendChild(option);
            });
        }
    } catch (error) {
        console.error("Error fetching towns for filter:", error);
    }
}

// --- FETCH AND RENDER AUTO/TAXI LISTINGS ---
function fetchAutoTaxiListings() {
    if (!autotaxiListingsContainer || !noListingsMessage) {
        console.error("Auto/Taxi listings container or message element not found.");
        return;
    }

    // Query for approved auto/taxi listings
    let listingsQuery = query(
        collection(db, "autotaxiListings"),
        where("status", "==", "approved"), // Only show approved listings
        orderBy("createdAt", "desc") // Order by most recent first
    );

    // Apply filters
    if (currentFilters.town) {
        listingsQuery = query(listingsQuery, where("serviceTown", "==", currentFilters.town));
    }
    if (currentFilters.vehicleType) {
        listingsQuery = query(listingsQuery, where("vehicleType", "==", currentFilters.vehicleType));
    }

    onSnapshot(listingsQuery, (snapshot) => {
        autotaxiListingsContainer.innerHTML = ''; // Clear previous listings
        if (snapshot.empty) {
            noListingsMessage.textContent = 'No auto/taxi listings found matching the criteria.';
            noListingsMessage.style.display = 'block';
        } else {
            noListingsMessage.style.display = 'none';
            snapshot.forEach((docSnapshot) => {
                const listing = docSnapshot.data();
                const listingCard = createListingCard(listing);
                autotaxiListingsContainer.appendChild(listingCard);
            });
        }
    }, (error) => {
        console.error("Error fetching auto/taxi listings:", error);
        noListingsMessage.textContent = 'Failed to load auto/taxi listings. Please try again later.';
        noListingsMessage.style.display = 'block';
    });
}

// --- CREATE LISTING CARD ---
function createListingCard(listing) {
    const card = document.createElement('div');
    card.className = 'listing-card p-6 rounded-lg shadow-md flex flex-col';
    
   

    card.innerHTML = `
        
        <h3 class="text-xl font-bold mb-2">${listing.vehicleType} - ${listing.licensePlate}</h3>
        <p class="text-gray-600 mb-2">Driver: ${listing.driverName}</p>
        ${listing.vehicleModel ? `<p class="text-sm text-gray-600 mb-2">Model: ${listing.vehicleModel}</p>` : ''}
        <p class="text-sm text-gray-600 mb-3">Town: ${listing.serviceTown}</p>
        <p class="text-gray-700 text-sm mb-4 flex-grow">${listing.serviceDescription}</p>
        <a href="tel:${listing.contactPhone}" class="mt-auto bg-emerald-600 text-white text-center py-2 px-4 rounded-lg hover:bg-emerald-700 transition duration-300">Call ${listing.driverName}</a>
    `;
    return card;
}
