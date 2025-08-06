// js/people.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loadingState = document.getElementById('loading-state');
const noUsersMessage = document.getElementById('no-users-message');
const peopleListContainer = document.getElementById('people-list-container');
const searchInput = document.getElementById('people-search');
const searchBtn = document.getElementById('search-btn');
const searchContainer = document.getElementById('search-container');
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenuDropdown = document.getElementById('mobile-menu-dropdown');
const logoutButtonMobile = document.getElementById('logout-btn-mobile');

let currentUser = null;
let userHometown = null;
let allUsersInTown = []; // To store all fetched users for searching
let authReady = false; // Flag to check if initial auth state is resolved

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in or session is restored.
        currentUser = user;
        if (!authReady) {
            authReady = true; // Mark auth as ready
            initializePage(user);
        }
    } else {
        // This block will now only run if the user is genuinely not logged in
        // after the initial check, or if they manually log out.
        if (authReady) {
            window.location.href = 'index.html';
        }
        // If auth is not ready yet, we wait for the next check.
    }
});

/**
 * Initializes the page content after a user is confirmed.
 * @param {object} user - The authenticated user object.
 */
async function initializePage(user) {
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists() && userDocSnap.data().hometown) {
            userHometown = userDocSnap.data().hometown;
            await fetchPeopleInTown(userHometown, user.uid);
        } else {
            // If user is logged in but has no hometown, redirect.
            window.location.href = 'set-hometown.html';
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
        loadingState.textContent = "Could not load your information.";
    }
}


/**
 * Fetches all users from the same town and stores them for searching.
 * @param {string} hometown - The town to search for.
 * @param {string} currentUserId - The UID of the current user.
 */
async function fetchPeopleInTown(hometown, currentUserId) {
    try {
        const q = query(collection(db, "users"), where("hometown", "==", hometown));
        const querySnapshot = await getDocs(q);

        allUsersInTown = querySnapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(user => user.id !== currentUserId);

        loadingState.classList.add('hidden');
        displayPeople(allUsersInTown);

    } catch (error) {
        console.error("Error fetching people in town:", error);
        loadingState.textContent = "Error finding people in your town.";
    }
}

/**
 * Renders a list of user profiles to the page.
 * @param {Array} usersToDisplay - An array of user objects to display.
 */
function displayPeople(usersToDisplay) {
    peopleListContainer.innerHTML = '';

    if (usersToDisplay.length === 0) {
        noUsersMessage.classList.remove('hidden');
    } else {
        noUsersMessage.classList.add('hidden');
        usersToDisplay.forEach(user => {
            const profileCard = createProfileCard(user);
            peopleListContainer.appendChild(profileCard);
        });
    }
}

/**
 * Creates an HTML element for a single user profile card.
 * @param {object} userData - The data for a single user from Firestore.
 * @returns {HTMLElement} The created div element for the profile card.
 */
function createProfileCard(userData) {
    const item = document.createElement('div');
    item.className = 'user-list-item p-4 flex items-center space-x-4 cursor-pointer';

    const profileImageUrl = userData.profileImageUrl || `https://api.dicebear.com/8.x/bottts/svg?seed=${userData.name || userData.uid}`;

    item.innerHTML = `
        <img src="${profileImageUrl}" alt="${userData.name}" class="w-12 h-12 rounded-full object-cover">
        <div class="flex-grow">
            <h3 class="font-semibold text-gray-900">${userData.name || 'Unnamed User'}</h3>
            <p class="text-sm text-gray-500 truncate">${userData.bio || 'No bio yet.'}</p>
        </div>
        <button data-userid="${userData.id}" class="connect-btn bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition text-sm">
            Connect
        </button>
    `;

    const connectBtn = item.querySelector('.connect-btn');
    connectBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent the item click from firing
        handleConnectClick(e);
    });

    item.addEventListener('click', () => {
        console.log("Clicked on user:", userData.name);
    });

    return item;
}


/**
 * Handles the click event for the "Connect" button.
 * @param {Event} e - The click event object.
 */
async function handleConnectClick(e) {
    const connectBtn = e.currentTarget;
    const receiverId = connectBtn.dataset.userid;
    const senderId = currentUser.uid;

    if (!senderId || !receiverId) return;

    connectBtn.disabled = true;
    connectBtn.textContent = 'Sent';
    connectBtn.classList.replace('bg-blue-500', 'bg-gray-400');

    try {
        await addDoc(collection(db, "connections"), {
            participants: [senderId, receiverId],
            senderId: senderId,
            receiverId: receiverId,
            status: 'pending',
            createdAt: serverTimestamp()
        });
    } catch (error) {
        console.error("Error sending connection request:", error);
        connectBtn.disabled = false;
        connectBtn.textContent = 'Connect';
        connectBtn.classList.replace('bg-gray-400', 'bg-blue-500');
        alert("Failed to send connection request.");
    }
}

/**
 * Filters the displayed people based on the search input.
 */
function performSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredUsers = allUsersInTown.filter(user => {
        // BUG FIX: Check if user.name and user.bio exist before calling toLowerCase()
        const nameMatch = (user.name ? user.name.toLowerCase() : '').includes(searchTerm);
        const bioMatch = (user.bio ? user.bio.toLowerCase() : '').includes(searchTerm);
        return nameMatch || bioMatch;
    });
    displayPeople(filteredUsers);
}

// --- EVENT LISTENERS ---
if (searchInput) {
    searchInput.addEventListener('input', performSearch);
}

if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        searchContainer.classList.toggle('hidden');
        if (!searchContainer.classList.contains('hidden')) {
            searchInput.focus();
        }
    });
}

if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', () => {
        mobileMenuDropdown.classList.toggle('hidden');
    });
}

if(logoutButtonMobile) {
    logoutButtonMobile.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Logout Error:", error));
    });
}

// A fallback to ensure the page doesn't get stuck on loading
setTimeout(() => {
    if (!authReady) {
        authReady = true;
        if (!auth.currentUser) {
            window.location.href = 'index.html';
        }
    }
}, 2500);
