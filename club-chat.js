// js/club-chat.js

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
    where,
    deleteDoc,
    getDocs // Added for deleting multiple messages
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentLoggedInUser = null;
let currentClubId = null;
let currentClubName = '';
let unsubscribeChat = null; // To unsubscribe from chat messages listener
let unsubscribeMembers = null; // To unsubscribe from members listener

const CLUB_MEMBER_LIMIT = 500; // Define the member limit

// --- DOM Elements ---
// Helper function to safely get elements and log if not found
const getElementByIdOrLog = (id) => {
    const element = document.getElementById(id);
    if (!element) {
        console.error(`Error: DOM element with ID '${id}' not found. Please ensure your HTML is correct.`);
    }
    return element;
};

// Get all necessary DOM elements
const chatPageTitle = getElementByIdOrLog('chat-page-title');
const chatClubName = getElementByIdOrLog('chat-club-name');
const chatMessagesContainer = getElementByIdOrLog('chat-messages');
const chatMessageInput = getElementByIdOrLog('chat-message-input');
const sendChatMessageBtn = getElementByIdOrLog('send-chat-message-btn');
const memberListElement = getElementByIdOrLog('member-list');
const currentMemberCountHeader = getElementByIdOrLog('current-member-count-header');
const leaveClubChatBtn = getElementByIdOrLog('leave-club-chat-btn');
const signupModal = getElementByIdOrLog('signup-modal');
const modalSignupBtn = getElementByIdOrLog('modal-signup-btn');
const modalLoginBtn = getElementByIdOrLog('modal-login-btn');
const modalCancelBtn = getElementByIdOrLog('modal-cancel-btn');
const messageBox = getElementByIdOrLog('message-box');

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
        console.warn(`Message Box element with ID 'message-box' not found. Message: ${message}`);
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

// --- INITIALIZATION ON PAGE LOAD ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentClubId = urlParams.get('clubId');
    currentClubName = urlParams.get('clubName');

    if (!currentClubId) {
        displayMessage("No club selected. Redirecting to clubs page.", "error");
        setTimeout(() => { window.location.href = 'club.html'; }, 2000);
        return;
    }

    if (chatPageTitle) {
        chatPageTitle.textContent = currentClubName ? `${decodeURIComponent(currentClubName)}` : `Club Chat`;
    }
    if (chatClubName) {
        chatClubName.textContent = currentClubName ? decodeURIComponent(currentClubName) : `Club Chat`;
    }

    // --- AUTHENTICATION CHECK ---
    onAuthStateChanged(auth, async (user) => {
        currentLoggedInUser = user;
        if (user) {
            console.log("User logged in:", user.uid, user.displayName || user.email);
            // Check if user is a member of this club
            const clubRef = doc(db, "clubs", currentClubId);
            try {
                const clubDoc = await getDoc(clubRef);
                if (clubDoc.exists()) {
                    const clubData = clubDoc.data();
                    // Ensure clubData.members is an array before using .includes()
                    const membersArray = Array.isArray(clubData.members) ? clubData.members : [];

                    if (membersArray.includes(user.uid)) {
                        // User is a member, proceed with chat
                        fetchAndDisplayChatMessages(currentClubId);
                        fetchClubMembers(currentClubId);
                    } else {
                        displayMessage("You are not a member of this club. Redirecting.", "error");
                        setTimeout(() => { window.location.href = 'club.html'; }, 2000);
                    }
                } else {
                    displayMessage("Club not found. Redirecting.", "error");
                    setTimeout(() => { window.location.href = 'club.html'; }, 2000);
                }
            } catch (error) {
                console.error("Error checking club membership:", error);
                displayMessage("Failed to verify club membership. Redirecting.", "error");
                setTimeout(() => { window.location.href = 'club.html'; }, 2000);
            }
        } else {
            console.log("No user logged in. Redirecting to login.");
            showSignupModal(); // Show login modal if not logged in
        }
    });

    // Send message on Enter key press
    if (chatMessageInput) {
        chatMessageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }

    if (sendChatMessageBtn) {
        sendChatMessageBtn.addEventListener('click', sendChatMessage);
    }

    if (leaveClubChatBtn) {
        leaveClubChatBtn.addEventListener('click', () => leaveClub(currentClubId));
    }

    // --- ATTEMPT TO DELETE USER'S MESSAGES ON PAGE UNLOAD ---
    // WARNING: This is highly unreliable for guaranteed deletion due to browser behavior
    // and asynchronous Firestore operations. The browser might terminate the page
    // before the delete operations complete, especially on mobile devices or fast navigation.
    // For robust message deletion, a backend solution (e.g., a Cloud Function triggered
    // when a user leaves a club, or a scheduled cleanup task) is strongly recommended.
    window.addEventListener('beforeunload', async (event) => {
        if (currentLoggedInUser && currentClubId) {
            console.log("Attempting to delete user's messages on page unload...");
            try {
                const userMessagesQuery = query(
                    collection(db, `clubs/${currentClubId}/chats`),
                    where("senderId", "==", currentLoggedInUser.uid)
                );
                const querySnapshot = await getDocs(userMessagesQuery);
                
                if (!querySnapshot.empty) {
                    const deletePromises = [];
                    querySnapshot.forEach((messageDoc) => {
                        // Add each delete operation to an array of promises
                        deletePromises.push(deleteDoc(doc(db, `clubs/${currentClubId}/chats`, messageDoc.id)));
                    });
                    // Wait for all delete operations to complete.
                    // Note: This 'await' might not fully resolve before the page unloads.
                    await Promise.all(deletePromises);
                    console.log(`Deleted ${deletePromises.length} messages by user ${currentLoggedInUser.uid} from club ${currentClubId}.`);
                } else {
                    console.log("No messages found to delete for this user in this club.");
                }
            } catch (error) {
                console.error("Failed to delete user's messages on unload:", error);
                // Cannot display message to user as page is unloading
            }
        }
    });
});

async function sendChatMessage() {
    if (!currentLoggedInUser || !currentClubId) {
        showSignupModal(); // Should not happen if logic is correct, but for safety
        return;
    }

    const messageContent = chatMessageInput.value.trim();
    if (!messageContent) {
        return; // Don't send empty messages
    }

    try {
        await addDoc(collection(db, `clubs/${currentClubId}/chats`), {
            senderId: currentLoggedInUser.uid,
            senderName: currentLoggedInUser.displayName || 'Anonymous User',
            content: messageContent,
            timestamp: serverTimestamp(),
        });
        chatMessageInput.value = ''; // Clear input
        // Messages will be displayed via onSnapshot, which will handle scrolling
    } catch (error) {
        console.error("Error sending message:", error);
        displayMessage("Failed to send message. Please try again.", "error");
    }
}

function fetchAndDisplayChatMessages(clubId) {
    if (!chatMessagesContainer) {
        console.error("Chat messages container not found.");
        return;
    }

    // Order by timestamp ascending for correct display (oldest at top, newest at bottom)
    const chatQuery = query(collection(db, `clubs/${clubId}/chats`), orderBy("timestamp", "asc")); 

    // Unsubscribe from previous listener if any to prevent multiple listeners
    if (unsubscribeChat) {
        unsubscribeChat();
    }

    unsubscribeChat = onSnapshot(chatQuery, (snapshot) => {
        chatMessagesContainer.innerHTML = ''; // Clear existing messages
        if (snapshot.empty) {
            chatMessagesContainer.innerHTML = '<p class="text-gray-500 text-center">No messages yet. Say hello!</p>';
            return;
        }

        snapshot.forEach((messageDoc) => {
            const message = messageDoc.data();
            const messageElement = document.createElement('div');
            // Check if currentLoggedInUser is not null before accessing its properties
            const isSelf = currentLoggedInUser && message.senderId === currentLoggedInUser.uid; 
            messageElement.classList.add('chat-message-item', isSelf ? 'self' : 'other');

            const senderName = message.senderName || 'Anonymous User';
            const timeAgo = message.timestamp ? formatTimeAgo(message.timestamp) : 'Just now';

            // Create avatar element (only for 'other' messages)
            if (!isSelf) {
                const avatarElement = document.createElement('div');
                avatarElement.classList.add('message-avatar');
                avatarElement.textContent = getInitials(senderName);
                messageElement.appendChild(avatarElement);
            }

            // Create content wrapper for message and info (name, bubble, time)
            const contentWrapper = document.createElement('div');
            contentWrapper.classList.add('message-content-wrapper');

            // Add sender name for 'other' messages (above the bubble)
            if (!isSelf) {
                const senderNameElement = document.createElement('div');
                senderNameElement.classList.add('message-sender-name');
                senderNameElement.textContent = senderName;
                contentWrapper.appendChild(senderNameElement);
            }

            // Add message bubble
            const messageBubble = document.createElement('div');
            messageBubble.classList.add('chat-message-bubble', isSelf ? 'self' : 'other');
            messageBubble.textContent = message.content;
            contentWrapper.appendChild(messageBubble);

            // Add timestamp
            const timeElement = document.createElement('div');
            timeElement.classList.add('chat-message-time', isSelf ? 'self' : 'other');
            timeElement.textContent = timeAgo;
            contentWrapper.appendChild(timeElement);
            
            messageElement.appendChild(contentWrapper);
            chatMessagesContainer.appendChild(messageElement);
        });

        // Scroll to the bottom of the chat to show recent messages
        // Use a slight delay to ensure DOM has rendered
        setTimeout(() => {
            chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
        }, 100);
    }, (error) => {
        console.error("Error fetching chat messages:", error);
        if (chatMessagesContainer) {
            chatMessagesContainer.innerHTML = '<p class="text-red-500 text-center">Failed to load messages.</p>';
        }
    });
}

async function fetchClubMembers(clubId) {
    if (!memberListElement || !currentMemberCountHeader) {
        console.error("Member list or member count header element not found.");
        return;
    }

    memberListElement.innerHTML = ''; // Clear existing members
    currentMemberCountHeader.textContent = `0/${CLUB_MEMBER_LIMIT} Members`;

    // Unsubscribe from previous listener if any
    if (unsubscribeMembers) {
        unsubscribeMembers();
    }

    const clubRef = doc(db, "clubs", clubId);
    unsubscribeMembers = onSnapshot(clubRef, (clubDoc) => {
        if (!clubDoc.exists()) {
            memberListElement.innerHTML = '<p class="text-gray-500 text-sm">Club not found.</p>';
            currentMemberCountHeader.textContent = `0/${CLUB_MEMBER_LIMIT} Members`;
            return;
        }
        const clubData = clubDoc.data();
        const members = Array.isArray(clubData.members) ? clubData.members : []; // Ensure it's an array
        currentMemberCountHeader.textContent = `${members.length}/${CLUB_MEMBER_LIMIT} Members`;
        memberListElement.innerHTML = ''; // Clear for fresh render

        if (members.length === 0) {
            memberListElement.innerHTML = '<p class="text-gray-500 text-sm">No members yet.</p>';
            return;
        }

        members.forEach(memberId => {
            const memberItem = document.createElement('li');
            memberItem.classList.add('member-item');
            
            let memberDisplayName = 'Anonymous User'; // Default display name
            let isAdmin = false;

            if (currentLoggedInUser && currentLoggedInUser.uid === memberId) {
                memberDisplayName = currentLoggedInUser.displayName || 'You';
            } else if (memberId === clubData.createdBy) { // Check if this member is the creator
                memberDisplayName = clubData.createdByName || 'Admin'; // Use creator's name if available
                isAdmin = true;
            } else {
                // For other members, fetch their display name from the 'users' collection
                // This is an asynchronous operation, so we'll update the list item once data is fetched.
                // For simplicity, initially display "Loading..." or a generic name.
                // A more robust solution would involve a map of UIDs to display names.
                const userDocRef = doc(db, "users", memberId);
                getDoc(userDocRef).then(userDocSnap => {
                    if (userDocSnap.exists()) {
                        memberDisplayName = userDocSnap.data().name || 'Anonymous User';
                    }
                    // Update the innerHTML after fetching the name
                    memberItem.querySelector('.member-name').textContent = memberDisplayName;
                    memberItem.querySelector('.member-avatar-small').textContent = getInitials(memberDisplayName);
                }).catch(error => {
                    console.error("Error fetching member display name:", error);
                });
            }

            const memberInitials = getInitials(memberDisplayName);

            memberItem.innerHTML = `
                <div class="member-avatar-small">${memberInitials}</div>
                <span class="member-name">${memberDisplayName}</span>
                ${isAdmin ? '<span class="member-role">(Admin)</span>' : ''}
            `;
            memberListElement.appendChild(memberItem);
        });
    }, (error) => {
        console.error("Error fetching club members:", error);
        if (memberListElement) {
            memberListElement.innerHTML = '<p class="text-red-500 text-sm">Failed to load members.</p>';
        }
        if (currentMemberCountHeader) {
            currentMemberCountHeader.textContent = `Error loading members`;
        }
    });
}

// --- LEAVE CLUB LOGIC (re-implemented for club-chat.js) ---
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
        displayMessage("You have left the club. Redirecting to clubs list.", "info");
        console.log("Left club:", clubId);
        // Redirect to the clubs list page after leaving
        setTimeout(() => {
            window.location.href = 'club.html';
        }, 1500);
    } catch (error) {
        console.error("Error leaving club:", error);
        displayMessage(`Failed to leave club: ${error.message}`, "error");
    }
}
