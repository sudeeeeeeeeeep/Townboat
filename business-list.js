// js/business-list.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore, collection, query, where, onSnapshot, orderBy,
    doc, updateDoc, arrayUnion, arrayRemove, increment,
    getDocs, getDoc // Added getDoc for fetching user profile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let allBusinesses = []; // Store all fetched businesses here
let currentCategory = ''; // Store the current category from URL
let currentLoggedInUser = null; // Store current user globally
let currentTownFilter = ''; // Store current town filter selection (from dropdown)
let userHometown = ''; // New: To store the user's hometown from their profile

// --- DOM Elements (declared globally, initialized in DOMContentLoaded) ---
let businessListContainer;
let categoryHeading;
let pageTitle;
let searchInput;
let townFilterSelect;
let noBusinessesMessage;
let logoutButton;


// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, async (user) => { // Made async to await Firestore calls
    currentLoggedInUser = user; // Store the user object

    if (user) {
        console.log("User logged in:", user.uid);

        // --- FETCH USER'S HOMETOWN ---
        const userDocRef = doc(db, "users", user.uid);
        try {
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists() && userDocSnap.data().hometown) {
                userHometown = userDocSnap.data().hometown;
                console.log("User's hometown:", userHometown);
                
                // Set the initial value of the town filter dropdown to user's hometown
                // This will be handled in DOMContentLoaded after elements are available
            } else {
                console.log("User has no hometown set. Redirecting to set-hometown page.");
                // Redirect new users or users without a hometown to the setup page
                window.location.href = 'set-hometown.html'; 
                return; // Stop further execution on this page until hometown is set
            }
        } catch (error) {
            console.error("Error fetching user hometown:", error);
            // Even if there's an error fetching hometown, proceed, but without a default filter
            // You might want a more robust error handling here, e.g., show a message.
        }
    } else {
        console.log("No user logged in. Displaying public content.");
    }

    // --- PROCEED WITH PAGE-SPECIFIC LOGIC ---
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('category');
    if (category) {
        currentCategory = category; // Set current category
        // Initialize DOM elements here if not already, then set values
        if (categoryHeading) categoryHeading.textContent = `Businesses in ${currentCategory}`;
        if (pageTitle) pageTitle.textContent = `${currentCategory} - TownBoat`;

        populateTownsForFilter(); // Populate towns for the filter dropdown
        fetchAndFilterBusinesses(); // Fetch businesses based on initial category (and later, town)
    } else {
        if (businessListContainer) {
            businessListContainer.innerHTML = `<p class="text-center text-gray-500">Please select a category from the <a href="discover.html" class="text-white hover:underline">Discover page</a>.</p>`;
        }
        // Hide search and town filter if no category is selected
        if (searchInput && searchInput.parentElement) searchInput.parentElement.style.display = 'none';
        if (townFilterSelect && townFilterSelect.parentElement) townFilterSelect.parentElement.style.display = 'none';
    }
});

// --- FETCH TOWNS FOR FILTER DROPDOWN ---
async function populateTownsForFilter() {
    if (!townFilterSelect) { // Ensure element exists
        console.error("town-filter select element not found.");
        return;
    }

    try {
        const townsQuery = query(collection(db, "towns"), orderBy("name", "asc"));
        const townsSnapshot = await getDocs(townsQuery);
        
        // Clear existing options except the first "All Towns"
        townFilterSelect.innerHTML = '<option value="">All Towns</option>'; // Reset to default

        townsSnapshot.forEach(doc => {
            const townName = doc.data().name;
            if (townName) {
                const option = document.createElement('option');
                option.value = townName;
                option.textContent = townName;
                townFilterSelect.appendChild(option);
            }
        });

        // After populating, set the dropdown to the user's hometown if available
        if (userHometown && Array.from(townFilterSelect.options).some(opt => opt.value === userHometown)) {
            townFilterSelect.value = userHometown;
            currentTownFilter = userHometown; // Also update the current filter state
        }
    } catch (error) {
        console.error("Error fetching towns for filter:", error);
    }
}


// --- RENDER BUSINESSES TO UI ---
function renderBusinesses(businessesToDisplay) {
    if (!businessListContainer || !noBusinessesMessage) { // Added checks for robustness
        console.error("Required DOM elements for rendering businesses are missing.");
        return;
    }

    businessListContainer.innerHTML = ''; // Clear previous listings

    if (businessesToDisplay.length === 0) {
        noBusinessesMessage.style.display = 'block';
    } else {
        noBusinessesMessage.style.display = 'none';
        businessesToDisplay.forEach((business) => {
            const businessId = business.id;
            const currentUpvotes = business.upvoteCount || 0; 
            const upvotedBy = business.upvotedBy || [];
            const hasUpvoted = currentLoggedInUser ? upvotedBy.includes(currentLoggedInUser.uid) : false;
            // Use a local placeholder image if imageUrl is empty
            const imageUrl = business.imageUrl || 'images/placeholder1.jpeg'; // Updated placeholder

            const businessElement = document.createElement('div');
            businessElement.className = 'business-card p-4 rounded-lg mb-4 flex items-start';
            businessElement.innerHTML = `
                ${imageUrl ? `<img src="${imageUrl}" alt="${business.name} Logo" class="business-image">` : ''}
                <div class="flex-1"> 
                    <h3 class="text-xl font-semibold mb-1">${business.name}</h3>
                    <p class="text-sm mb-2">${business.category} ${business.town ? `(${business.town})` : ''}</p>
                    <p class="text-sm mb-3">${business.description}</p>
                    <div class="flex items-center text-sm mb-3">
                        <button
                            data-business-id="${businessId}"
                            class="upvote-btn flex items-center transition duration-300 px-3 py-1 rounded-full
                                ${hasUpvoted ? 'text-red-500 bg-red-900/20' : 'hover:bg-gray-200/50'}"
                        >
                            <span class="text-xl mr-2">${hasUpvoted ? '❤️' : '🤍'}</span>
                            <span class="text-sm font-medium">${currentUpvotes}</span>
                        </button>
                        <span class="ml-4">⭐ Not Rated Yet</span>
                    </div>
                    <a href="business-detail.html?id=${businessId}" class="inline-block px-4 py-2 rounded-lg text-sm transition duration-300 view-details-btn">View Details</a>
                </div>
            `;
            businessListContainer.appendChild(businessElement);

            const upvoteButton = businessElement.querySelector('.upvote-btn');
            if (upvoteButton) {
                upvoteButton.addEventListener('click', async () => {
                    if (!currentLoggedInUser) {
                        alert("You must be logged in to upvote.");
                        window.location.href = 'login.html'; // Redirect to login
                        return;
                    }

                    const businessRef = doc(db, "businesses", businessId);
                    
                    try {
                        // Check if user has already upvoted
                        const businessDoc = await getDoc(businessRef);
                        const currentUpvotedBy = businessDoc.data().upvotedBy || [];

                        if (currentUpvotedBy.includes(currentLoggedInUser.uid)) {
                            console.log("User already upvoted this business.");
                            // Optionally, allow un-upvoting
                            // await updateDoc(businessRef, {
                            //     upvoteCount: increment(-1),
                            //     upvotedBy: arrayRemove(currentLoggedInUser.uid)
                            // });
                            return;
                        }

                        await updateDoc(businessRef, {
                            upvoteCount: increment(1),
                            upvotedBy: arrayUnion(currentLoggedInUser.uid)
                        });
                        console.log("Business upvoted successfully!");
                    } catch (error) {
                        console.error("Error upvoting business:", error);
                        alert("Failed to upvote. Please try again. Check console for details.");
                    }
                });
            }
        });
    }
}

// --- FETCH AND LISTEN FOR BUSINESSES ---
function fetchAndFilterBusinesses() {
    // This function can now be called even if !currentLoggedInUser
    if (!currentCategory) {
        console.log("Category not set, deferring business fetch.");
        return;
    }

    let q = query(
        collection(db, "businesses"),
        where("category", "==", currentCategory),
        where("status", "==", "approved"),
        orderBy("upvoteCount", "desc")
    );

    // Determine the active town filter: manual selection overrides user's hometown
    // Only apply userHometown if user is logged in
    const activeTownForQuery = currentTownFilter || (currentLoggedInUser ? userHometown : ''); 
    
    if (activeTownForQuery) {
        q = query(q, where("town", "==", activeTownForQuery));
    }

    onSnapshot(q, (snapshot) => {
        allBusinesses = [];
        snapshot.forEach((docSnapshot) => {
            allBusinesses.push({ id: docSnapshot.id, ...docSnapshot.data() });
        });
        performSearch(); // Apply search filter on the fetched data
    }, (error) => {
        console.error("Error fetching businesses:", error);
        if (businessListContainer) {
            businessListContainer.innerHTML = `<p class="text-red-500 text-center py-8">Error loading businesses. Please check console for index errors or try again later.</p>`;
        }
    });
}

// --- PERFORM SEARCH FILTERING (in-memory) ---
function performSearch() {
    if (!searchInput) { // Added check for robustness
        console.error("Business search input element not found.");
        return;
    }
    const searchQuery = searchInput.value.toLowerCase();
    let filteredBusinesses = [];

    if (searchQuery === '') {
        filteredBusinesses = allBusinesses;
    } else {
        filteredBusinesses = allBusinesses.filter(business =>
            business.name.toLowerCase().includes(searchQuery) ||
            business.description.toLowerCase().includes(searchQuery) ||
            (business.town && business.town.toLowerCase().includes(searchQuery))
        );
    }
    renderBusinesses(filteredBusinesses);
}


// --- RUN WHEN PAGE IS LOADED ---
document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM elements
    logoutButton = document.getElementById('logout-btn');
    businessListContainer = document.getElementById('business-list-container');
    categoryHeading = document.getElementById('category-heading');
    pageTitle = document.getElementById('page-title');
    searchInput = document.getElementById('business-search');
    townFilterSelect = document.getElementById('town-filter');
    noBusinessesMessage = document.getElementById('no-businesses-message'); // Ensure this is correctly referenced

    if (logoutButton) {
        logoutButton.addEventListener('click', () => signOut(auth));
    }

    // Event listener for search input
    if (searchInput) {
        searchInput.addEventListener('input', performSearch);
    }
    
    // Event listener for town filter
    if (townFilterSelect) {
        townFilterSelect.addEventListener('change', (e) => {
            currentTownFilter = e.target.value;
            fetchAndFilterBusinesses(); // Re-fetch businesses with new town filter
        });
    }

    // The onAuthStateChanged listener will now handle the initial category and hometown logic
    // No need to duplicate category parsing here.
});
