// js/polls.js

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
    getDoc,
    updateDoc,
    arrayUnion, // Keep arrayUnion for other potential uses, but not directly used for nested array here
    arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentLoggedInUser = null;
let isAdmin = false; // Flag to check if the user is an admin

// --- DOM Elements ---
const logoutButton = document.getElementById('logout-btn');
const adminPollCreationSection = document.getElementById('admin-poll-creation');
const createPollForm = document.getElementById('create-poll-form');
const pollQuestionInput = document.getElementById('poll-question');
const pollOptionsInputsContainer = document.getElementById('poll-options-inputs');
const addOptionBtn = document.getElementById('add-option-btn');
const pollsList = document.getElementById('polls-list');
const pollStatusMessage = document.getElementById('poll-status-message');

// Modal Elements
const signupModal = document.getElementById('signup-modal');
const modalSignupBtn = document.getElementById('modal-signup-btn');
const modalLoginBtn = document.getElementById('modal-login-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');


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

// --- MODAL FUNCTIONS ---
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

// --- MODAL EVENT LISTENERS ---
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
onAuthStateChanged(auth, async (user) => {
    currentLoggedInUser = user;
    if (user) {
        console.log("User logged in:", user.uid);
        // Check if the user is an admin by looking in the 'adminUsers' collection
        const adminDocRef = doc(db, "adminUsers", user.uid); // Changed from "users" to "adminUsers"
        try {
            const adminDocSnap = await getDoc(adminDocRef);
            if (adminDocSnap.exists()) { // Check if the admin document exists
                isAdmin = true;
                adminPollCreationSection.classList.remove('hidden'); // Show admin section
            }
        } catch (error) {
            console.error("Error checking user role in adminUsers collection:", error);
        }
        fetchAndDisplayPolls();
    } else {
        console.log("No user logged in. Displaying public polls.");
        adminPollCreationSection.classList.add('hidden'); // Hide admin section if not logged in
        fetchAndDisplayPolls(); // Still fetch and display polls for public users
    }
});

// --- ADMIN POLL CREATION LOGIC ---
let optionCounter = 2; // Start with A and B

addOptionBtn.addEventListener('click', () => {
    if (optionCounter >= 10) { // Limit to 10 options for now
        pollStatusMessage.textContent = 'Maximum 10 options allowed.';
        pollStatusMessage.classList.add('text-red-500');
        return;
    }
    const newOptionChar = String.fromCharCode(65 + optionCounter); // A=65, B=66, etc.
    const optionGroup = document.createElement('div');
    optionGroup.classList.add('option-input-group');
    optionGroup.innerHTML = `
        <label class="poll-option-label">${newOptionChar})</label>
        <input type="text" class="poll-option-input" placeholder="Option ${newOptionChar}" required>
        <button type="button" class="remove-option-btn bg-red-500 text-white px-2 py-1 rounded-md ml-2">X</button>
    `;
    pollOptionsInputsContainer.appendChild(optionGroup);
    optionCounter++;

    // Add event listener for the new remove button
    optionGroup.querySelector('.remove-option-btn').addEventListener('click', (e) => {
        e.target.closest('.option-input-group').remove();
        optionCounter--;
        // Re-label options if needed (optional, for simplicity we won't re-label dynamically)
    });
});

createPollForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isAdmin) {
        pollStatusMessage.textContent = 'You must be an admin to create polls.';
        pollStatusMessage.classList.add('text-red-500');
        return;
    }

    const question = pollQuestionInput.value.trim();
    const optionInputs = pollOptionsInputsContainer.querySelectorAll('.poll-option-input');
    const options = [];
    optionInputs.forEach(input => {
        const value = input.value.trim();
        if (value) {
            options.push({ text: value, votes: 0, votedBy: [] });
        }
    });

    if (!question) {
        pollStatusMessage.textContent = 'Poll question cannot be empty.';
        pollStatusMessage.classList.add('text-red-500');
        return;
    }
    if (options.length < 2) {
        pollStatusMessage.textContent = 'Please add at least two options.';
        pollStatusMessage.classList.add('text-red-500');
        return;
    }

    try {
        await addDoc(collection(db, "polls"), {
            question: question,
            options: options,
            totalVotes: 0,
            createdBy: currentLoggedInUser.uid,
            // Modified to prioritize displayName, then fallback to a generic 'Admin'
            createdByName: currentLoggedInUser.displayName || 'Admin', 
            createdAt: serverTimestamp(),
            isActive: true // Polls are active by default
        });

        pollStatusMessage.textContent = 'Poll created successfully!';
        pollStatusMessage.classList.remove('text-red-500');
        pollStatusMessage.classList.add('text-green-500');
        createPollForm.reset();
        // Reset options to initial two
        pollOptionsInputsContainer.innerHTML = `
            <div class="option-input-group">
                <label class="poll-option-label">A)</label>
                <input type="text" class="poll-option-input" placeholder="Option A" required>
            </div>
            <div class="option-input-group">
                <label class="poll-option-label">B)</label>
                <input type="text" class="poll-option-input" placeholder="Option B" required>
            </div>
        `;
        optionCounter = 2; // Reset counter
    } catch (error) {
        console.error("Error creating poll:", error);
        pollStatusMessage.textContent = `Failed to create poll: ${error.message}`;
        pollStatusMessage.classList.add('text-red-500');
        pollStatusMessage.classList.remove('text-green-500');
    }
});

// --- FETCH AND DISPLAY POLLS ---
function fetchAndDisplayPolls() {
    const pollsQuery = query(collection(db, "polls"), orderBy("createdAt", "desc"));

    onSnapshot(pollsQuery, (snapshot) => {
        pollsList.innerHTML = ''; // Clear existing polls
        if (snapshot.empty) {
            pollsList.innerHTML = '<p class="text-gray-500 text-center">No active polls at the moment.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const poll = docSnap.data();
            const pollId = docSnap.id;
            
            const timeAgo = poll.createdAt ? formatTimeAgo(poll.createdAt) : 'Just now';
            const authorName = poll.createdByName || 'Admin'; // Still use this for display
            const authorInitials = getInitials(authorName);

            const pollElement = document.createElement('div');
            pollElement.classList.add('poll-card');

            let optionsHtml = '';
            let userHasVoted = false;
            let userVotedOptionIndex = -1;

            if (currentLoggedInUser) {
                for (let i = 0; i < poll.options.length; i++) {
                    if (poll.options[i].votedBy && poll.options[i].votedBy.includes(currentLoggedInUser.uid)) {
                        userHasVoted = true;
                        userVotedOptionIndex = i;
                        break;
                    }
                }
            }

            poll.options.forEach((option, index) => {
                const optionLabel = String.fromCharCode(65 + index);
                const percentage = poll.totalVotes > 0 ? ((option.votes / poll.totalVotes) * 100).toFixed(1) : 0;
                const votedClass = (userHasVoted && userVotedOptionIndex === index) ? 'voted' : '';
                const disabledClass = userHasVoted ? 'disabled' : '';

                optionsHtml += `
                    <div class="poll-option ${votedClass} ${disabledClass}" data-poll-id="${pollId}" data-option-index="${index}">
                        <div class="poll-percentage-bar" style="width: ${userHasVoted ? percentage : 0}%;"></div>
                        <div class="poll-option-content">
                            <span class="poll-option-label">${optionLabel})</span>
                            <span class="poll-option-text">${option.text}</span>
                            ${userHasVoted ? `<span class="poll-option-percentage">${percentage}%</span>` : ''}
                        </div>
                    </div>
                `;
            });

            pollElement.innerHTML = `
                <div class="poll-header">
                    <div class="poll-author-avatar">
                        ${authorInitials}
                    </div>
                    <div class="poll-author-info">
                        <p class="poll-author-name">${authorName}</p>
                        <p class="poll-time-ago">${timeAgo}</p>
                    </div>
                </div>

                <div class="poll-question">
                    ${poll.question}
                </div>

                <div class="poll-options-container">
                    ${optionsHtml}
                </div>

                <div class="total-votes">
                    ${poll.totalVotes} Total Votes
                </div>
            `;
            pollsList.appendChild(pollElement);

            // Add event listeners for voting
            pollElement.querySelectorAll('.poll-option').forEach(optionElement => {
                optionElement.addEventListener('click', () => {
                    const optionIndex = parseInt(optionElement.dataset.optionIndex);
                    // Check if user is logged in BEFORE calling handleVote
                    if (!currentLoggedInUser) {
                        showSignupModal(); // Show modal if not logged in
                    } else if (!userHasVoted) { // Only allow voting if logged in and not already voted
                        handleVote(pollId, optionIndex);
                    }
                });
            });
        });
    }, (error) => {
        console.error("Error fetching polls:", error);
        pollsList.innerHTML = '<p class="text-red-500 text-center">Failed to load polls. Please try again.</p>';
    });
}

// --- HANDLE VOTE ---
async function handleVote(pollId, optionIndex) {
    // This check is now also done in fetchAndDisplayPolls, but kept here for robustness
    if (!currentLoggedInUser) {
        showSignupModal(); // Show modal if not logged in
        return;
    }

    const pollRef = doc(db, "polls", pollId);

    try {
        const pollDoc = await getDoc(pollRef);
        if (!pollDoc.exists()) {
            console.error("Poll not found!");
            return;
        }
        const pollData = pollDoc.data();
        let options = pollData.options;
        let totalVotes = pollData.totalVotes || 0;

        // Check if user has already voted in this poll
        let alreadyVoted = false;
        for (const option of options) {
            if (option.votedBy && option.votedBy.includes(currentLoggedInUser.uid)) {
                alreadyVoted = true;
                break;
            }
        }

        if (alreadyVoted) {
            alert("You have already voted in this poll."); // Using alert here as it's a specific user action feedback
            return;
        }

        // Create a mutable copy of the options array to modify
        let updatedOptions = [...options]; 
        
        // Increment vote for the selected option
        updatedOptions[optionIndex].votes = (updatedOptions[optionIndex].votes || 0) + 1;
        
        // Ensure votedBy array exists before pushing
        if (!updatedOptions[optionIndex].votedBy) {
            updatedOptions[optionIndex].votedBy = [];
        }
        updatedOptions[optionIndex].votedBy.push(currentLoggedInUser.uid); // Use push for local array modification
        
        totalVotes++;

        await updateDoc(pollRef, {
            options: updatedOptions, // Send the entire modified array back
            totalVotes: totalVotes
        });
        console.log("Vote recorded successfully!");
        // UI will update automatically via onSnapshot listener
    } catch (error) {
        console.error("Error voting:", error);
        alert("Failed to cast vote. Please try again.");
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
            alert("Failed to log out. Please try again.");
        });
    });
}
