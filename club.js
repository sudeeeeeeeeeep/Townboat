// js/club.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    orderBy, 
    onSnapshot,
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove,
    getDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentLoggedInUser = null;
const CLUB_MEMBER_LIMIT = 500; // Define the member limit

// --- DOM Elements ---
// Using a helper function to safely get elements and log if not found
const getElementByIdOrLog = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: DOM element with ID '${id}' not found. Please ensure your HTML is correct.`);
    }
    return element;
};

const logoutButton = getElementByIdOrLog('logout-btn');
const createClubSection = getElementByIdOrLog('create-club-section');
const createClubForm = getElementByIdOrLog('create-club-form');
const clubNameInput = getElementByIdOrLog('club-name');
const clubDescriptionInput = getElementByIdOrLog('club-description');
const clubCategorySelect = getElementByIdOrLog('club-category');
const createClubStatusMessage = getElementByIdOrLog('create-club-status-message');
const clubsList = getElementByIdOrLog('clubs-list');

// Signup/Login Modal Elements (reused from other pages)
const signupModal = getElementByIdOrLog('signup-modal');
const modalSignupBtn = getElementByIdOrLog('modal-signup-btn');
const modalLoginBtn = getElementByIdOrLog('modal-login-btn');
const modalCancelBtn = getElementByIdOrLog('modal-cancel-btn');
const messageBox = getElementByIdOrLog('message-box'); // Get the message box element

// --- Helper Functions ---

// Function to format timestamp to "X [unit] ago"
function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) {
        return `${seconds}s ago`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    if (days < 7) {
        return `${days}d ago`;
    }
    // Fallback for older posts: Month Day, Year
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Function to get initials from a name for an avatar placeholder
function getInitials(name) {
    if (!name) return '??';
    const parts = name.split(' ').filter(Boolean); // Split by space and remove empty strings
    if (parts.length === 1) {
        return parts[0][0].toUpperCase();
    }
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return '??';
}

// --- CUSTOM MESSAGE BOX (instead of alert) ---
function displayMessage(message, type = "info") {
    if (messageBox) {
        messageBox.textContent = message;
        messageBox.className = `message-box show ${type}`; // Add type class for styling
        setTimeout(() => {
            messageBox.classList.remove('show');
        }, 3000); // Hide after 3 seconds
    } else {
        console.warn(`Message Box element not found. Message: ${message}`);
    }
}

// --- MODAL FUNCTIONS (reused from other pages) ---
function showSignupModal() {
    if (signupModal) {
        signupModal.classList.remove('hidden');
    }
}

function hideSignupModal() {
    if (signupModal) {
        signupModal.classList.add('hidden');
    }
}

// --- MODAL EVENT LISTENERS (reused from other pages) ---
if (modalSignupBtn) {
    modalSignupBtn.addEventListener('click', () => {
        window.location.href = 'index.html'; // Redirect to signup/login page
    });
}

if (modalLoginBtn) {
    modalLoginBtn.addEventListener('click', () => {
        window.location.href = 'index.html'; // Redirect to signup/login page
    });
}

if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', hideSignupModal);
}

// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    currentLoggedInUser = user;
    if (user) {
        console.log("User logged in:", user.uid, user.displayName || user.email);
        if (createClubSection) createClubSection.classList.remove('hidden'); // Show create club section
        fetchAndDisplayClubs();
    } else {
        console.log("No user logged in. Displaying clubs (interaction disabled).");
        if (createClubSection) createClubSection.classList.add('hidden'); // Hide create club section
        fetchAndDisplayClubs(); // Still fetch and display clubs for public users
    }
});

// --- CREATE CLUB LOGIC ---
if (createClubForm && clubNameInput && clubDescriptionInput && clubCategorySelect) {
    createClubForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!currentLoggedInUser) {
            showSignupModal();
            return;
        }

        const clubName = clubNameInput.value.trim();
        const clubDescription = clubDescriptionInput.value.trim();
        const clubCategory = clubCategorySelect.value;

        if (!clubName || !clubDescription || !clubCategory) {
            displayMessage("Please fill in all club details.", "error");
            return;
        }

        try {
            const newClubRef = await addDoc(collection(db, "clubs"), {
                name: clubName,
                description: clubDescription,
                category: clubCategory,
                createdBy: currentLoggedInUser.uid,
                createdByName: currentLoggedInUser.displayName || 'Anonymous User',
                createdAt: serverTimestamp(),
                members: [currentLoggedInUser.uid], // Creator is the first member
                memberCount: 1,
            });

            displayMessage(`Club "${clubName}" created successfully!`, "success");
            createClubForm.reset();
            console.log("New club created with ID:", newClubRef.id);
            // UI will update via onSnapshot
        } catch (error) {
            console.error("Error creating club:", error);
            displayMessage(`Failed to create club: ${error.message}`, "error");
        }
    });
}

// --- FETCH AND DISPLAY CLUBS ---
function fetchAndDisplayClubs() {
    if (!clubsList) {
        console.error("Clubs list element not found.");
        return;
    }

    const clubsQuery = query(collection(db, "clubs"), orderBy("createdAt", "desc"));

    onSnapshot(clubsQuery, (snapshot) => {
        clubsList.innerHTML = ''; // Clear existing clubs
        if (snapshot.empty) {
            clubsList.innerHTML = '<p class="text-gray-500 text-center col-span-full">No clubs found. Be the first to create one!</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const club = docSnap.data();
            const clubId = docSnap.id;
            // Ensure club.members is an array before using .includes()
            const membersArray = Array.isArray(club.members) ? club.members : [];
            const isMember = currentLoggedInUser && membersArray.includes(currentLoggedInUser.uid);
            const isFull = club.memberCount >= CLUB_MEMBER_LIMIT;

            const clubCard = document.createElement('div');
            clubCard.classList.add('club-card');
            clubCard.innerHTML = `
                <h3>${club.name}</h3>
                <p>${club.description}</p>
                <p><strong>Category:</strong> ${club.category}</p>
                <p class="member-count">
                    Members: ${club.memberCount || 0}/${CLUB_MEMBER_LIMIT}
                    ${isFull ? '<span class="full-badge">FULL</span>' : ''}
                </p>
                <div class="club-actions">
                    ${currentLoggedInUser ? 
                        (isMember ? 
                            `<button class="view-chat-btn btn-primary" data-club-id="${clubId}" data-club-name="${encodeURIComponent(club.name)}">View Chat</button>
                             <button class="leave-btn btn-secondary" data-club-id="${clubId}">Leave Club</button>` 
                            : 
                            `<button class="join-btn btn-primary ${isFull ? 'opacity-50 cursor-not-allowed' : ''}" data-club-id="${clubId}" ${isFull ? 'disabled' : ''}>Join Club</button>`
                        ) 
                        : 
                        // MODIFIED: Removed 'disabled' attribute to make the button clickable when logged out
                        `<button class="join-btn btn-primary">Login to Join</button>` 
                    }
                </div>
            `;
            clubsList.appendChild(clubCard);

            // Add event listeners for buttons
            if (currentLoggedInUser) {
                if (isMember) {
                    const viewChatBtn = clubCard.querySelector('.view-chat-btn');
                    if (viewChatBtn) {
                        viewChatBtn.addEventListener('click', () => {
                            window.location.href = `club-chat.html?clubId=${clubId}&clubName=${encodeURIComponent(club.name)}`;
                        });
                    }
                    const leaveBtn = clubCard.querySelector('.leave-btn');
                    if (leaveBtn) {
                        leaveBtn.addEventListener('click', () => leaveClub(clubId));
                    }
                } else if (!isFull) {
                    const joinBtn = clubCard.querySelector('.join-btn');
                    if (joinBtn) {
                        joinBtn.addEventListener('click', () => joinClub(clubId));
                    }
                }
            } else {
                // For non-logged-in users, attach a click listener to the "Login to Join" button
                const loginToJoinBtn = clubCard.querySelector('.join-btn');
                if (loginToJoinBtn) {
                    loginToJoinBtn.addEventListener('click', showSignupModal);
                }
            }
        });
    }, (error) => {
        console.error("Error fetching clubs:", error);
        if (clubsList) {
            clubsList.innerHTML = '<p class="text-red-500 text-center col-span-full">Failed to load clubs. Please try again.</p>';
        }
    });
}

// --- JOIN CLUB LOGIC ---
async function joinClub(clubId) {
    if (!currentLoggedInUser) {
        showSignupModal();
        return;
    }

    const clubRef = doc(db, "clubs", clubId);
    try {
        const clubDoc = await getDoc(clubRef);
        if (!clubDoc.exists()) {
            displayMessage("Club not found.", "error");
            return;
        }
        const clubData = clubDoc.data();
        if (clubData.memberCount >= CLUB_MEMBER_LIMIT) {
            displayMessage("This club is full. Cannot join.", "error");
            return;
        }
        // Ensure club.members is an array before using .includes()
        const membersArray = Array.isArray(clubData.members) ? clubData.members : [];
        if (membersArray.includes(currentLoggedInUser.uid)) {
            displayMessage("You are already a member of this club.", "info");
            return;
        }

        await updateDoc(clubRef, {
            members: arrayUnion(currentLoggedInUser.uid),
            memberCount: (clubData.memberCount || 0) + 1,
        });
        displayMessage("You have joined the club!", "success");
        console.log("Joined club:", clubId);
        // UI will update via onSnapshot
    } catch (error) {
        console.error("Error joining club:", error);
        displayMessage(`Failed to join club: ${error.message}`, "error");
    }
}

// --- LEAVE CLUB LOGIC ---
async function leaveClub(clubId) {
    if (!currentLoggedInUser) {
        showSignupModal();
        return;
    }

    const clubRef = doc(db, "clubs", clubId);
    try {
        const clubDoc = await getDoc(clubRef);
        if (!clubDoc.exists()) {
            displayMessage("Club not found.", "error");
            return;
        }
        const clubData = clubDoc.data();
        // Ensure club.members is an array before using .includes()
        const membersArray = Array.isArray(clubData.members) ? clubData.members : [];
        if (!membersArray.includes(currentLoggedInUser.uid)) {
            displayMessage("You are not a member of this club.", "info");
            return;
        }

        await updateDoc(clubRef, {
            members: arrayRemove(currentLoggedInUser.uid),
            memberCount: Math.max(0, (clubData.memberCount || 0) - 1), // Ensure count doesn't go negative
        });
        displayMessage("You have left the club.", "info");
        console.log("Left club:", clubId);
        // If the user leaves the currently open chat, close the chat modal
        // No modal to close here, but if they are on club-chat.html, they should be redirected
        if (window.location.pathname.includes('club-chat.html')) {
             // If on the chat page and they leave the club, redirect them back to the clubs list
            window.location.href = 'club.html';
        }
        // UI will update via onSnapshot
    } catch (error) {
        console.error("Error leaving club:", error);
        displayMessage(`Failed to leave club: ${error.message}`, "error");
    }
}

// --- LOGOUT BUTTON ---
if (logoutButton) {
    logoutButton.addEventListener('click', () => {
        signOut(auth).then(() => {
            console.log("User signed out.");
            window.location.href = 'index.html'; // Redirect to the main login page
        }).catch((error) => {
            console.error("Error signing out:", error);
            displayMessage("Failed to log out. Please try again.", "error");
        });
    });
}
