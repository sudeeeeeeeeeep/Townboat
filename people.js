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
const townNameDisplay = document.getElementById('town-name-display');
const logoutButton = document.getElementById('logout-btn-mobile'); // Mobile logout
const searchInput = document.getElementById('people-search');

let currentUser = null;
let userHometown = null;
let allUsersInTown = []; // To store all fetched users for searching

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists() && userDocSnap.data().hometown) {
                userHometown = userDocSnap.data().hometown;
                townNameDisplay.textContent = `Discover and connect with people from ${userHometown}.`;
                updateSEOTags(userHometown); // NEW: Update SEO tags with the town name
                await fetchPeopleInTown(userHometown, user.uid);
            } else {
                window.location.href = 'set-hometown.html';
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            loadingState.textContent = "Could not load your information.";
        }
    } else {
        window.location.href = 'index.html';
    }
});

/**
 * NEW: Updates the page's SEO meta tags dynamically with the town name.
 * @param {string} town - The name of the user's town.
 */
function updateSEOTags(town) {
    document.title = `Find People & Friends in ${town} | TownBoat`;
    
    const description = `Connect with people in ${town} on TownBoat. Find friends, view profiles, and join your local community. Sign up to see who's in your neighbourhood.`;
    document.querySelector('meta[name="description"]').setAttribute('content', description);
    document.querySelector('meta[property="og:title"]').setAttribute('content', `Find People in ${town} | TownBoat`);
    document.querySelector('meta[property="og:description"]').setAttribute('content', description);
    document.querySelector('meta[property="twitter:title"]').setAttribute('content', `Find People in ${town} | TownBoat`);
    document.querySelector('meta[property="twitter:description"]').setAttribute('content', description);

    const keywords = `find people ${town}, ${town} community, friends in ${town}, ${town} social network, people in ${town} Kerala, TownBoat ${town}`;
    document.querySelector('meta[name="keywords"]').setAttribute('content', keywords);
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
    const card = document.createElement('div');
    card.className = 'profile-card bg-white p-4 rounded-lg shadow-md flex flex-col items-center text-center';

    const profileImageUrl = userData.profileImageUrl || 'https://placehold.co/128x128/E5E7EB/000000?text=:)';
    const isVerifiedBadge = userData.isVerified ? 
        `<span class="absolute top-0 right-0 bg-blue-500 text-white text-xs rounded-full px-2 py-1" title="Verified Resident">
            <i class="fas fa-check"></i>
        </span>` : '';

    card.innerHTML = `
        <div class="relative mb-4">
            <img src="${profileImageUrl}" alt="${userData.name}" class="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg">
            ${isVerifiedBadge}
        </div>
        <h3 class="text-lg font-bold">${userData.name || 'Unnamed User'}</h3>
        <p class="text-gray-600 text-sm h-10 overflow-hidden">${userData.bio || 'No bio yet.'}</p>
        <button data-userid="${userData.id}" class="connect-btn mt-4 w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition">
            Connect
        </button>
    `;

    const connectBtn = card.querySelector('.connect-btn');
    connectBtn.addEventListener('click', handleConnectClick);

    return card;
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
    connectBtn.textContent = 'Request Sent';
    connectBtn.classList.replace('bg-blue-600', 'bg-gray-400');

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
        connectBtn.classList.replace('bg-gray-400', 'bg-blue-600');
        alert("Failed to send connection request.");
    }
}

/**
 * Filters the displayed people based on the search input.
 */
function performSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredUsers = allUsersInTown.filter(user => {
        const nameMatch = (user.name ? user.name.toLowerCase() : '').includes(searchTerm);
        const bioMatch = (user.bio ? user.bio.toLowerCase() : '').includes(searchTerm);
        return nameMatch || bioMatch;
    });
    displayPeople(filteredUsers);
}

// --- EVENT LISTENERS ---
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        signOut(auth).catch(error => console.error("Logout Error:", error));
    });
}

if (searchInput) {
    searchInput.addEventListener('input', performSearch);
}