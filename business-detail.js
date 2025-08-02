// js/business-detail.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const businessDetailContainer = document.getElementById('business-detail-container');
const pageTitle = document.getElementById('page-title');
const businessDealsList = document.getElementById('business-deals-list');
const noBusinessDealsMessage = document.getElementById('no-business-deals-message');
const logoutButton = document.getElementById('logout-btn'); // Ensure this is correctly referenced

let currentBusinessId = null;
let userHometown = ''; // To store the user's hometown from their profile
let currentLoggedInUser = null; // To store the current authenticated user

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, async (user) => {
    currentLoggedInUser = user; // Set currentLoggedInUser regardless of login status

    if (user) {
        console.log("User logged in:", user.uid);

        // Fetch user's hometown to ensure they have one set
        const userDocRef = doc(db, "users", user.uid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists() && userDocSnap.data().hometown) {
                userHometown = userDocSnap.data().hometown;
                console.log("User's hometown:", userHometown);
                // Proceed with fetching business details and deals
                initBusinessDetailsPage();
            } else {
                console.log("User has no hometown set. Redirecting to set-hometown page.");
                window.location.href = 'set-hometown.html'; 
                return;
            }
        } catch (error) {
            console.error("Error fetching user hometown:", error);
            // If there's an error, assume no hometown and redirect to setup
            window.location.href = 'set-hometown.html'; 
            return;
        }
    } else {
        console.log("No user logged in. Displaying public content.");
        initBusinessDetailsPage(); // Still initialize page for public viewing
    }
});

// --- INITIALIZE BUSINESS DETAILS PAGE ---
async function initBusinessDetailsPage() {
    // Get business ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentBusinessId = urlParams.get('id');

    if (!currentBusinessId) {
        businessDetailContainer.innerHTML = '<p class="text-red-500 text-center py-8">Business ID not found in URL.</p>';
        noBusinessDealsMessage.textContent = 'No business selected.';
        return;
    }

    await fetchBusinessDetails(currentBusinessId);
    fetchBusinessDeals(currentBusinessId); // Start listening for deals
}

// --- FETCH AND DISPLAY BUSINESS DETAILS ---
async function fetchBusinessDetails(businessId) {
    businessDetailContainer.innerHTML = '<p class="text-gray-400 text-center py-8">Loading business details...</p>';
    try {
        const businessDocRef = doc(db, "businesses", businessId);
        const businessDocSnap = await getDoc(businessDocRef);

        if (businessDocSnap.exists() && businessDocSnap.data().status === 'approved') {
            const business = businessDocSnap.data();
            pageTitle.textContent = `${business.name} - TownBoat`; // Update page title

            // Increment view count (optional, can be done once per session or on page load)
            // Note: This simple increment might lead to rapid updates if many users visit.
            // For production, consider debouncing or server-side increments.
            // Only increment if a user is logged in to avoid anonymous view count inflation
            if (currentLoggedInUser) {
                await updateDoc(businessDocRef, {
                    views: (business.views || 0) + 1
                });
            }

            const imageUrl = business.imageUrl || 'images/placeholder.jpeg'; // Placeholder for business image
            const displayImage = `<img src="${imageUrl}" alt="${business.name} Image" class="large-business-image mx-auto">`;

            businessDetailContainer.innerHTML = `
                ${displayImage}
                <div class="business-info-card">
                    <h1 class="text-3xl font-bold text-black mb-4 text-center">${business.name}</h1>
                    <div class="space-y-3 text-black">
                        <p><strong>Category:</strong> ${business.category}</p>
                        <p><strong>Town:</strong> ${business.town || 'N/A'}</p>
                        <p><strong>Description:</strong> ${business.description}</p>
                        <p><strong>Address:</strong> ${business.address}</p>
                        <p><strong>Upvotes:</strong> ${business.upvoteCount || 0}</p>
                        
                    </div>
                    ${business.phone ? `
                    <div class="mt-6">
                        <a href="tel:${business.phone}" class="w-full block text-center bg-black text-white font-bold py-3 px-6 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-700 transition duration-300 call-button-text-white">
                            Call Now
                        </a>
                    </div>
                    ` : ''}
                    
                </div>
            `;

            const bookmarkBtn = document.getElementById('bookmark-btn');
            if (bookmarkBtn) {
                // Check if already bookmarked and set initial text
                if (currentLoggedInUser) { // Only check if user is logged in
                    let bookmarks = JSON.parse(localStorage.getItem(`bookmarks_${currentLoggedInUser.uid}`)) || [];
                    if (bookmarks.includes(businessId)) {
                        bookmarkBtn.textContent = '⭐ Bookmarked';
                    }
                }
                bookmarkBtn.addEventListener('click', () => toggleBookmark(businessId, bookmarkBtn));
            }

        } else {
            businessDetailContainer.innerHTML = '<p class="text-red-500 text-center py-8">Business not found or not approved.</p>';
            noBusinessDealsMessage.textContent = 'No deals available for this business.';
        }
    } catch (error) {
        console.error("Error fetching business details:", error);
        businessDetailContainer.innerHTML = `<p class="text-red-500 text-center py-8">Failed to load business details: ${error.message}</p>`;
        noBusinessDealsMessage.textContent = 'Failed to load deals.';
    }
}

// --- BOOKMARK TOGGLE LOGIC ---
function toggleBookmark(businessId, buttonElement) {
    if (!currentLoggedInUser) {
        alert("You must be logged in to bookmark businesses."); // Using alert for simplicity, consider a custom modal
        window.location.href = 'login.html'; // Redirect to login
        return;
    }

    let bookmarks = JSON.parse(localStorage.getItem(`bookmarks_${currentLoggedInUser.uid}`)) || [];
    const isBookmarked = bookmarks.includes(businessId);

    if (isBookmarked) {
        // Remove from bookmarks
        bookmarks = bookmarks.filter(id => id !== businessId);
        buttonElement.textContent = '⭐ Bookmark';
        alert("Business removed from bookmarks!");
    } else {
        // Add to bookmarks
        bookmarks.push(businessId);
        buttonElement.textContent = '⭐ Bookmarked';
        alert("Business bookmarked successfully!");
    }
    localStorage.setItem(`bookmarks_${currentLoggedInUser.uid}`, JSON.stringify(bookmarks));
    // Note: Bookmarks are stored locally for MVP. For persistent bookmarks across devices,
    // you'd save them in Firestore under a user's document or a dedicated 'bookmarks' collection.
}

// --- FETCH AND DISPLAY BUSINESS DEALS ---
function fetchBusinessDeals(businessId) {
    if (!businessDealsList || !noBusinessDealsMessage) {
        console.error("Business deals list or message element not found.");
        return;
    }

    const dealsQuery = query(
        collection(db, "deals"),
        where("businessId", "==", businessId),
        where("isActive", "==", true),
        where("expiryDate", ">", new Date()), // Only active and unexpired deals
        orderBy("expiryDate", "asc") // Order by soonest expiring
    );

    // Use onSnapshot for real-time updates
    onSnapshot(dealsQuery, (snapshot) => {
        businessDealsList.innerHTML = ''; // Clear previous deals
        if (snapshot.empty) {
            noBusinessDealsMessage.textContent = 'No active deals available for this business.';
            noBusinessDealsMessage.style.display = 'block';
        } else {
            noBusinessDealsMessage.style.display = 'none';
            snapshot.forEach((doc) => {
                const deal = doc.data();
                const expiryDate = deal.expiryDate ? deal.expiryDate.toDate() : null;
                const expiryText = expiryDate ? `Expires: ${expiryDate.toLocaleDateString()} ${expiryDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No expiry date';

                const dealCard = document.createElement('div');
                dealCard.className = 'deal-card p-4 rounded-lg flex flex-col shadow-md';
                dealCard.innerHTML = `
                    ${deal.imageUrl ? `<img src="${deal.imageUrl}" alt="${deal.title}" class="deal-image">` : ''}
                    <h3 class="text-xl font-bold mb-2">${deal.title}</h3>
                    <p class="text-gray-600 mb-2">${deal.description}</p>
                    <p class="text-sm font-semibold text-red-500 mt-auto">${expiryText}</p>
                    <button class="mt-4 bg-blue-600 text-white text-center py-2 px-4 rounded-lg hover:bg-emerald-700 transition duration-300">View Deal</button>
                `;
                businessDealsList.appendChild(dealCard);
            });
        }
    }, (error) => {
        console.error("Error fetching business deals:", error);
        noBusinessDealsMessage.textContent = 'Failed to load deals for this business.';
        noBusinessDealsMessage.style.display = 'block';
    });
}

// --- LOGOUT BUTTON ---
document.addEventListener('DOMContentLoaded', () => {
    // Ensure logoutButton is correctly assigned here after DOM is loaded
    const logoutBtn = document.getElementById('logout-btn'); 
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                console.log("User signed out.");
                window.location.href = 'login.html'; // Redirect to the main login page
            }).catch((error) => {
                console.error("Error signing out:", error);
                alert("Failed to log out. Please try again."); // Using alert for simplicity
            });
        });
    }
});
