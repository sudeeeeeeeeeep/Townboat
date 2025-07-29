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


// --- AUTHENTICATION CHECK ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        currentLoggedInUser = user;
        console.log("User logged in:", user.uid, user.displayName || user.email);
        fetchAndDisplayPosts(); // Fetch posts only if user is logged in
    } else {
        // No user is signed in, redirect to login page
        console.log("No user logged in, redirecting to index.html");
        window.location.href = 'index.html';
    }
});

// --- DOM ELEMENTS ---
const postContentInput = document.getElementById('post-content');
const createPostForm = document.getElementById('create-post-form');
const feedContainer = document.getElementById('feed-container');
const logoutButton = document.getElementById('logout-btn');


// --- HANDLE POST CREATION ---
if (createPostForm) {
    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const content = postContentInput.value.trim();

        if (!currentLoggedInUser) {
            alert("You must be logged in to create a post.");
            return;
        }

        if (content === "") {
            alert("Post content cannot be empty.");
            return;
        }

        try {
            await addDoc(collection(db, "posts"), {
                content: content,
                authorId: currentLoggedInUser.uid,
                authorName: currentLoggedInUser.displayName || currentLoggedInUser.email || 'Anonymous User', // Robust fallback
                createdAt: serverTimestamp(),
                upvotes: 0, // Initialize upvotes
                upvotedBy: [] // Initialize empty array for users who upvoted
            });

            postContentInput.value = ""; // Clear the textarea
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
        alert("You must be logged in to upvote posts.");
        return;
    }

    const postRef = doc(db, "posts", postId);
    const userId = currentLoggedInUser.uid;

    try {
        if (upvotedByArray.includes(userId)) {
            // User has already upvoted, so un-upvote
            await updateDoc(postRef, {
                upvotes: increment(-1), 
                upvotedBy: arrayRemove(userId)
            });
            upvoteButton.classList.remove('text-black'); // Change to black for active
            upvoteButton.classList.add('text-black', 'opacity-75'); // Back to normal for inactive
        } else {
            // User has not upvoted, so upvote
            await updateDoc(postRef, {
                upvotes: increment(1), 
                upvotedBy: arrayUnion(userId)
            });
            upvoteButton.classList.remove('opacity-75');
            upvoteButton.classList.add('text-black'); // Indicate active upvote with pure black
        }
    } catch (error) {
        console.error("Error toggling upvote: ", error);
        alert("Failed to upvote/un-upvote. Please try again.");
    }
}

// --- FETCH AND DISPLAY POSTS ---
function fetchAndDisplayPosts() {
    const postsQuery = query(collection(db, "posts"), orderBy("createdAt", "desc"));

    // Use onSnapshot to get real-time updates for posts
    onSnapshot(postsQuery, (snapshot) => {
        feedContainer.innerHTML = ''; // Clear existing posts
        if (snapshot.empty) {
            feedContainer.innerHTML = '<p class="text-black opacity-75 text-center text-lg mt-12">No posts yet. Be the first to share your town\'s vibe!</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const post = docSnap.data();
            const postId = docSnap.id;
            
            // Ensure data integrity before rendering
            const timeAgo = post.createdAt ? formatTimeAgo(post.createdAt) : 'Just now';
            const authorName = post.authorName || 'Anonymous User';
            const authorInitials = getInitials(authorName);
            const upvotedBy = post.upvotedBy || [];
            const isUpvotedByCurrentUser = currentLoggedInUser && upvotedBy.includes(currentLoggedInUser.uid);

            const postElement = document.createElement('div');
            postElement.classList.add('bg-white', 'rounded-xl', 'shadow-lg', 'border', 'border-black', 'mb-6', 'overflow-hidden');
            
            // Initial classes for upvote button based on current user's state
            const upvoteButtonClass = isUpvotedByCurrentUser ? 'text-black' : 'text-black opacity-75';

            postElement.innerHTML = `
                <div class="flex items-center p-4 border-b border-black">
                    <div class="w-10 h-10 bg-black rounded-full mr-3 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        ${authorInitials}
                    </div>
                    <div>
                        <p class="font-bold text-black">${authorName}</p>
                        <p class="text-black opacity-60 text-xs">${timeAgo}</p>
                    </div>
                </div>

                <div class="p-4">
                    <p class="text-black whitespace-pre-wrap">${post.content || ''}</p>
                </div>

                <div class="flex items-center px-4 py-3 border-t border-black text-black opacity-75">
                    <button class="upvote-btn flex items-center mr-4 text-sm hover:opacity-100 transition duration-200 ${upvoteButtonClass}" data-post-id="${postId}">
                        <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path></svg>
                        <span class="upvote-count font-semibold">${upvotedBy.length}</span>
                    </button>
                    
                    <button class="comment-toggle-btn flex items-center text-sm hover:opacity-100 transition duration-200" data-post-id="${postId}">
                        <svg class="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3 1h8v4H5V6zm4 11v-3h2v3h-2z"></path></svg>
                        Comments (<span class="comment-count">0</span>)
                    </button>
                </div>

                <div class="comments-section p-4 border-t border-black hidden">
                    <div class="comments-list mb-4">
                        <p class="text-black opacity-60 text-sm text-center">No comments yet.</p>
                    </div>
                    <form class="add-comment-form flex items-center" data-post-id="${postId}">
                        <input type="text" placeholder="Add a comment..." class="comment-input w-full p-2 bg-white border border-black rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-black text-sm placeholder-black/50 mr-2">
                        <button type="submit" class="bg-black text-white px-4 py-2 rounded-lg text-sm hover:opacity-80 transition duration-200">Post</button>
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
                    // Fetch and display comments when section is opened
                    fetchAndDisplayComments(postId, commentsList, commentCountSpan);
                }
            });

            // Handle adding new comments
            addCommentForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const commentContent = commentInput.value.trim();

                if (!currentLoggedInUser) {
                    alert("You must be logged in to comment.");
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
                        authorName: currentLoggedInUser.displayName || currentLoggedInUser.email || 'Anonymous User',
                        createdAt: serverTimestamp()
                    });
                    commentInput.value = ''; // Clear input
                } catch (error) {
                    console.error("Error adding comment: ", error);
                    alert("Failed to add comment. Please try again.");
                }
            });

            // Initial fetch of comments count
            // We'll use a snapshot listener to keep comment count and list real-time
            fetchAndDisplayComments(postId, commentsList, commentCountSpan);
        });
    }, (error) => {
        console.error("Error fetching posts: ", error);
        feedContainer.innerHTML = '<p class="text-black opacity-75 text-center text-lg mt-12">Failed to load posts. Please try again.</p>';
    });
}

// --- FETCH AND DISPLAY COMMENTS (and their replies) ---
function fetchAndDisplayComments(postId, commentsListElement, commentCountSpanElement) {
    const commentsQuery = query(collection(db, `posts/${postId}/comments`), orderBy("createdAt", "asc"));

    onSnapshot(commentsQuery, (snapshot) => {
        commentsListElement.innerHTML = ''; // Clear existing comments
        commentCountSpanElement.textContent = snapshot.size; // Update comment count

        if (snapshot.empty) {
            commentsListElement.innerHTML = '<p class="text-black opacity-60 text-sm text-center">No comments yet.</p>';
            return;
        }

        snapshot.forEach((commentDoc) => {
            const comment = commentDoc.data();
            const commentId = commentDoc.id;
            const commentElement = document.createElement('div');
            commentElement.classList.add('mb-2', 'pb-2', 'border-b', 'border-black', 'border-opacity-10', 'last:border-b-0', 'last:pb-0', 'ml-0'); 

            const commentAuthorName = comment.authorName || 'Anonymous User';
            const commentTimeAgo = comment.createdAt ? formatTimeAgo(comment.createdAt) : 'Just now';

            commentElement.innerHTML = `
                <div class="flex items-center text-xs text-black opacity-80 mb-1">
                    <span class="font-bold">${commentAuthorName}</span>
                    <span class="ml-2 opacity-60">${commentTimeAgo}</span>
                </div>
                <p class="text-black text-sm">${comment.content || ''}</p>
                <button class="reply-toggle-btn text-xs text-black opacity-75 hover:opacity-100 mt-1" data-comment-id="${commentId}">Reply</button>
                <div class="replies-section mt-2 pl-4 border-l border-black border-opacity-20 hidden">
                    <div class="replies-list">
                        </div>
                    <form class="add-reply-form flex items-center mt-2" data-comment-id="${commentId}">
                        <input type="text" placeholder="Write a reply..." class="reply-input w-full p-1 bg-white border border-black rounded-lg focus:outline-none focus:ring-1 focus:ring-black text-black text-xs placeholder-black/50 mr-2">
                        <button type="submit" class="bg-black text-white px-3 py-1 rounded-lg text-xs hover:opacity-80 transition duration-200">Reply</button>
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
                    alert("You must be logged in to reply.");
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
                        authorName: currentLoggedInUser.displayName || currentLoggedInUser.email || 'Anonymous User',
                        createdAt: serverTimestamp()
                    });
                    replyInput.value = ''; // Clear input
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
        commentsListElement.innerHTML = '<p class="text-black opacity-75 text-sm text-center">Failed to load comments.</p>';
    });
}

// --- FETCH AND DISPLAY REPLIES ---
function fetchAndDisplayReplies(postId, commentId, repliesListElement) {
    const repliesQuery = query(collection(db, `posts/${postId}/comments/${commentId}/replies`), orderBy("createdAt", "asc"));

    onSnapshot(repliesQuery, (snapshot) => {
        repliesListElement.innerHTML = ''; // Clear existing replies

        if (snapshot.empty) {
            repliesListElement.innerHTML = '<p class="text-black opacity-60 text-xs mt-1">No replies yet.</p>';
            return;
        }

        snapshot.forEach((replyDoc) => {
            const reply = replyDoc.data();
            const replyElement = document.createElement('div');
            replyElement.classList.add('mt-1', 'pb-1', 'border-b', 'border-black', 'border-opacity-5', 'last:border-b-0', 'last:pb-0'); // Lighter separator for replies

            const replyAuthorName = reply.authorName || 'Anonymous User';
            const replyTimeAgo = reply.createdAt ? formatTimeAgo(reply.createdAt) : 'Just now';

            replyElement.innerHTML = `
                <div class="flex items-center text-xs text-black opacity-70 mb-0.5">
                    <span class="font-bold">${replyAuthorName}</span>
                    <span class="ml-2 opacity-50">${replyTimeAgo}</span>
                </div>
                <p class="text-black text-sm">${reply.content || ''}</p>
            `;
            repliesListElement.appendChild(replyElement);
        });
    }, (error) => {
        console.error("Error fetching replies: ", error);
        repliesListElement.innerHTML = '<p class="text-black opacity-75 text-xs text-center">Failed to load replies.</p>';
    });
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