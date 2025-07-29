// js/home.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentLoggedInUser = null; // Store the current authenticated user

// --- DOM Elements ---
const postContentInput = document.getElementById('post-content');
const createPostForm = document.getElementById('create-post-form');
const feedContainer = document.getElementById('feed-container');
const logoutButton = document.getElementById('logout-btn');

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
onAuthStateChanged(auth, (user) => {
    currentLoggedInUser = user; // Set currentLoggedInUser regardless of login status
    if (user) {
        console.log("User logged in:", user.uid, user.displayName || user.email);
        // Only fetch and display posts if user is logged in, otherwise public view is handled by fetchAndDisplayPosts
        fetchAndDisplayPosts(); 
    } else {
        console.log("No user logged in. Displaying public feed.");
        // Still fetch and display posts for public users, but interactive features will be disabled/modal prompted
        fetchAndDisplayPosts();
    }
});

// --- HANDLE POST CREATION ---
if (createPostForm) {
    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const content = postContentInput.value.trim();

        if (!currentLoggedInUser) {
            showSignupModal(); // Show modal if not logged in
            return;
        }

        if (content === "") {
            alert("Post content cannot be empty."); // Keep alert for empty content
            return;
        }

        try {
            await addDoc(collection(db, "posts"), {
                content: content,
                authorId: currentLoggedInUser.uid,
                authorName: currentLoggedInUser.displayName || 'Anonymous User', 
                createdAt: serverTimestamp(),
                upvotes: 0, 
                upvotedBy: [] 
            });

            postContentInput.value = ""; 
            console.log("Post created successfully!");
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Failed to create post. Please try again.");
        }
    });
}

// --- UPVOTE LOGIC ---
async function toggleUpvote(postId, upvotedByArray, upvoteButton) {
    if (!currentLoggedInUser) {
        showSignupModal(); // Show modal if not logged in
        return;
    }

    const postRef = doc(db, "posts", postId);
    const userId = currentLoggedInUser.uid;

    try {
        if (upvotedByArray.includes(userId)) {
            await updateDoc(postRef, {
                upvotes: increment(-1), 
                upvotedBy: arrayRemove(userId)
            });
            upvoteButton.classList.remove('active'); 
        } else {
            await updateDoc(postRef, {
                upvotes: increment(1), 
                upvotedBy: arrayUnion(userId)
            });
            upvoteButton.classList.add('active'); 
        }
    } catch (error) {
        console.error("Error toggling upvote: ", error);
        alert("Failed to upvote/un-upvote. Please try again.");
    }
}

// --- FETCH AND DISPLAY POSTS ---
function fetchAndDisplayPosts() {
    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    onSnapshot(postsQuery, (snapshot) => {
        feedContainer.innerHTML = ''; 
        if (snapshot.empty) {
            feedContainer.innerHTML = '<p class="text-gray-500 text-center text-lg mt-12">No posts yet. Be the first to share your town\'s vibe!</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const postId = docSnap.id;
            
            const timeAgo = post.createdAt ? formatTimeAgo(post.createdAt) : 'Just now';
            const authorName = post.authorName || 'Anonymous User';
            const authorInitials = getInitials(authorName);
            const upvotedBy = post.upvotedBy || [];
            const isUpvotedByCurrentUser = currentLoggedInUser && upvotedBy.includes(currentLoggedInUser.uid);

            const postElement = document.createElement('div');
            postElement.classList.add('post-card', 'mb-6'); 
            
            const upvoteButtonClass = isUpvotedByCurrentUser ? 'active' : '';

            postElement.innerHTML = `
                <div class="post-header">
                    <div class="author-avatar">
                        ${authorInitials}
                    </div>
                    <div class="post-author-info">
                        <p class="post-author-name">${authorName}</p>
                        <p class="post-time-ago">${timeAgo}</p>
                    </div>
                </div>

                <div class="post-body">
                    <p class="post-text">${post.content || ''}</p>
                    ${post.imageUrl ? `<img src="${post.imageUrl}" alt="Post Image" class="post-image">` : ''}
                </div>

                <div class="post-actions">
                    <button class="upvote-btn action-button ${upvoteButtonClass}" data-post-id="${postId}">
                        <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>
                        <span class="upvote-count font-semibold">${upvotedBy.length}</span>
                    </button>
                    
                    <button class="comment-toggle-btn action-button" data-post-id="${postId}">
                        <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h8v4H5V6zm4 11v-3h2v3h-2z"></path></svg>
                        Comments (<span class="comment-count">0</span>)
                    </button>
                </div>

                <div class="comments-section hidden">
                    <div class="comments-list mb-4">
                        </div>
                    <form class="add-comment-form flex items-center" data-post-id="${postId}">
                        <input type="text" placeholder="Add a comment..." class="comment-input flex-grow p-2 border rounded-lg mr-2 bg-gray-100 border-gray-200 text-gray-900">
                        <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">Post</button>
                    </form>
                </div>
            `;
            feedContainer.appendChild(postElement);

            // Add event listeners for upvote and comment buttons
            const upvoteButton = postElement.querySelector('.upvote-btn');
            upvoteButton.addEventListener('click', () => {
                toggleUpvote(postId, upvotedBy, upvoteButton);
            });

            const commentToggleBtn = postElement.querySelector('.comment-toggle-btn');
            const commentsSection = postElement.querySelector('.comments-section');
            const commentsList = postElement.querySelector('.comments-list');
            const commentCountSpan = postElement.querySelector('.comment-count');
            const addCommentForm = postElement.querySelector('.add-comment-form');
            const commentInput = postElement.querySelector('.comment-input');

            // Toggle comments section visibility
            commentToggleBtn.addEventListener('click', () => {
                commentsSection.classList.toggle('hidden');
                if (!commentsSection.classList.contains('hidden')) {
                    fetchAndDisplayComments(postId, commentsList, commentCountSpan);
                }
            });

            // Handle adding new comments
            addCommentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const commentContent = commentInput.value.trim();

                if (!currentLoggedInUser) {
                    showSignupModal(); // Show modal if not logged in
                    return;
                }
                if (commentContent === "") {
                    alert("Comment cannot be empty.");
                    return;
                }

                try {
                    await addDoc(collection(db, `posts/${postId}/comments`), {
                        content: commentContent,
                        authorId: currentLoggedInUser.uid,
                        authorName: currentLoggedInUser.displayName || 'Anonymous User', 
                        createdAt: serverTimestamp()
                    });
                    commentInput.value = ''; 
                } catch (error) {
                    console.error("Error adding comment: ", error);
                    alert("Failed to add comment. Please try again.");
                }
            });

            fetchAndDisplayComments(postId, commentsList, commentCountSpan);
        });
    }, (error) => {
        console.error("Error fetching posts: ", error);
        feedContainer.innerHTML = '<p class="text-gray-500 text-center text-lg mt-12">Failed to load posts. Please try again.</p>';
    });
}

// --- FETCH AND DISPLAY COMMENTS (and their replies) ---
function fetchAndDisplayComments(postId, commentsListElement, commentCountSpanElement) {
    const commentsQuery = query(collection(db, `posts/${postId}/comments`), orderBy("createdAt", "asc"));

    onSnapshot(commentsQuery, (snapshot) => {
        commentsListElement.innerHTML = ''; 
        commentCountSpanElement.textContent = snapshot.size; 

        if (snapshot.empty) {
            commentsListElement.innerHTML = '<p class="text-gray-500 text-sm text-center mt-1">No comments yet.</p>';
            return;
        }

        snapshot.forEach((commentDoc) => {
            const comment = commentDoc.data();
            const commentId = commentDoc.id;
            const commentElement = document.createElement('div');
            commentElement.classList.add('comment-item'); 

            const commentAuthorName = comment.authorName || 'Anonymous User';
            const commentTimeAgo = comment.createdAt ? formatTimeAgo(comment.createdAt) : 'Just now';

            commentElement.innerHTML = `
                <div class="comment-author-info">
                    <span class="comment-author-name">${commentAuthorName}</span>
                    <span class="comment-time-ago">${commentTimeAgo}</span>
                </div>
                <p class="comment-text">${comment.content || ''}</p>
                <button class="reply-toggle-btn" data-comment-id="${commentId}">Reply</button>
                <div class="replies-section hidden">
                    <div class="replies-list">
                        </div>
                    <form class="add-reply-form flex items-center mt-2" data-comment-id="${commentId}">
                        <input type="text" placeholder="Write a reply..." class="reply-input flex-grow p-1 border rounded-lg mr-2 bg-gray-100 border-gray-200 text-gray-900">
                        <button type="submit" class="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs">Reply</button>
                    </form>
                </div>
            `;
            commentsListElement.appendChild(commentElement);

            const replyToggleBtn = commentElement.querySelector('.reply-toggle-btn');
            const repliesSection = commentElement.querySelector('.replies-section');
            const repliesList = commentElement.querySelector('.replies-list');
            const addReplyForm = commentElement.querySelector('.add-reply-form');
            const replyInput = commentElement.querySelector('.reply-input');

            // Toggle replies section visibility
            replyToggleBtn.addEventListener('click', () => {
                repliesSection.classList.toggle('hidden');
                if (!repliesSection.classList.contains('hidden')) {
                    fetchAndDisplayReplies(postId, commentId, repliesList);
                }
            });

            // Handle adding new replies
            addReplyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const replyContent = replyInput.value.trim();

                if (!currentLoggedInUser) {
                    showSignupModal(); // Show modal if not logged in
                    return;
                }
                if (replyContent === "") {
                    alert("Reply cannot be empty.");
                    return;
                }

                try {
                    await addDoc(collection(db, `posts/${postId}/comments/${commentId}/replies`), {
                        content: replyContent,
                        authorId: currentLoggedInUser.uid,
                        authorName: currentLoggedInUser.displayName || 'Anonymous User', 
                        createdAt: serverTimestamp()
                    });
                    replyInput.value = ''; 
                } catch (error) {
                    console.error("Error adding reply: ", error);
                    alert("Failed to add reply. Please try again.");
                }
            });

            // Initially fetch replies if the section is not hidden (though it is by default)
            // If you want replies to load immediately, remove the 'hidden' class from replies-section and call this directly.
            // For now, it loads when the "Reply" button is clicked.
        });
    }, (error) => {
        console.error("Error fetching comments: ", error);
        commentsListElement.innerHTML = '<p class="text-gray-500 text-xs mt-1">Failed to load replies.</p>';
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
