// js/auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    serverTimestamp,
    getDoc // Added to check if user profile exists
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"; // New Firestore imports
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore

// --- Google Sign-In Provider ---
const provider = new GoogleAuthProvider();

// --- DOMContentLoaded Event Listener ---
document.addEventListener('DOMContentLoaded', () => {
    const googleSignInBtn = document.getElementById('google-sign-in-btn');

    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', async () => {
            try {
                // Sign in with Google Pop-up
                const result = await signInWithPopup(auth, provider);
                const user = result.user; // The signed-in user info.
                console.log("Google Sign-In Successful:", user);

                // --- Create/Update User Document in Firestore ---
                const userDocRef = doc(db, "users", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (!userDocSnap.exists()) {
                    // If user document does not exist, create it.
                    // Firestore will automatically create the 'users' collection
                    // if it doesn't exist when the first document is written to it.
                    await setDoc(userDocRef, {
                        uid: user.uid,
                        name: user.displayName,
                        email: user.email,
                        createdAt: serverTimestamp(), // Timestamp of first creation
                        // hometown will be added later via set-hometown.html
                    });
                    console.log("New user profile created in Firestore for:", user.email);
                    // Redirect new users to set-hometown.html
                    window.location.href = 'set-hometown.html';
                } else {
                    // If user document exists, update last login time or other relevant fields
                    // You can also update name/email in case they changed in Google profile
                    await setDoc(userDocRef, {
                        name: user.displayName,
                        email: user.email,
                        lastLoginAt: serverTimestamp() // Update last login time
                    }, { merge: true }); // Use merge: true to avoid overwriting existing fields like 'hometown'
                    console.log("Existing user profile updated in Firestore for:", user.email);

                    // Check if hometown is already set. If not, redirect to set-hometown.html
                    if (!userDocSnap.data().hometown) {
                        window.location.href = 'set-hometown.html';
                    } else {
                        // If hometown is already set, redirect to discover.html
                        window.location.href = 'discover.html';
                    }
                }

            } catch (error) {
                console.error("Error during Google Sign-In:", error);
                const errorCode = error.code;
                const errorMessage = error.message;
                const email = error.customData?.email;
                // const credential = GoogleAuthProvider.credentialFromError(error); // Not used currently

                if (errorCode === 'auth/popup-closed-by-user') {
                    alert("Sign-in cancelled by user.");
                } else if (errorCode === 'auth/cancelled-popup-request') {
                    alert("Another sign-in pop-up is already open.");
                } else if (errorCode === 'auth/account-exists-with-different-credential') {
                    alert(`An account with this email (${email}) already exists with a different login method. Please sign in using your existing method.`);
                } else {
                    alert(`Google Sign-In failed: ${errorMessage}`);
                }
            }
        });
    }

    // --- AUTHENTICATION STATE OBSERVER (for direct URL access or session persistence) ---
    // This checks if a user is already logged in (e.g., from a previous session)
    onAuthStateChanged(auth, async (user) => { // Made async to check hometown
        if (user) {
            // User is signed in.
            // If they are on the login page (index.html), check their hometown.
            if (window.location.pathname.includes('index.html')) {
                const userDocRef = doc(db, "users", user.uid);
                try {
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists() && userDocSnap.data().hometown) {
                        // Hometown is set, redirect to home page
                        window.location.href = 'discover.html';
                    } else {
                        // Hometown is not set, redirect to set-hometown page
                        window.location.href = 'set-hometown.html';
                    }
                } catch (error) {
                    console.error("Error checking user hometown on auth state change:", error);
                    // If there's an error fetching user doc, default to discover.html or handle appropriately
                    // This might happen if security rules prevent reading the 'users' collection before it exists.
                    // For robustness, you might want to redirect to set-hometown.html here too,
                    // or to a generic home page that then checks for hometown.
                    window.location.href = 'discover.html'; 
                }
            }
            // For other pages, this observer just confirms login.
            // Specific page JS files will handle their own redirects if hometown is missing.
        } else {
            // No user is signed in. If on a protected page, they will be redirected by that page's JS.
            // For index.html itself, this block ensures the user stays on index.html if not logged in.
        }
    });
});