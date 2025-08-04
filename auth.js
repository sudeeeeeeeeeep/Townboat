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
    getDoc,
    query,
    collection,
    where,
    getDocs,
    updateDoc,
    increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore

// --- Google Sign-In Provider ---
const provider = new GoogleAuthProvider();

// --- DOMContentLoaded Event Listener ---
document.addEventListener('DOMContentLoaded', () => {
    // --- NEW: Capture referral ID on page load and store it in sessionStorage ---
    const urlParamsOnLoad = new URLSearchParams(window.location.search);
    const referrerIdOnLoad = urlParamsOnLoad.get('ref');
    if (referrerIdOnLoad) {
        sessionStorage.setItem('referrerId', referrerIdOnLoad);
        console.log('Referrer ID captured and stored:', referrerIdOnLoad);
    }

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
                    // --- MODIFIED: Read referrer ID from sessionStorage instead of URL ---
                    const referrerId = sessionStorage.getItem('referrerId');

                    // If user document does not exist, create it.
                    await setDoc(userDocRef, {
                        uid: user.uid,
                        name: user.displayName,
                        email: user.email,
                        createdAt: serverTimestamp(),
                        // Affiliate Program Fields
                        isAffiliate: false, 
                        referralPoints: 0,
                        referredBy: referrerId || null // Store who referred this user
                    });
                    console.log("New user profile created in Firestore for:", user.email, "Referred by:", referrerId);

                    // If referred, award a point to the referrer
                    if (referrerId) {
                        await awardPointToReferrer(referrerId);
                        // --- NEW: Clean up sessionStorage after use ---
                        sessionStorage.removeItem('referrerId');
                    }

                    // Redirect new users to set-hometown.html
                    window.location.href = 'set-hometown.html';
                } else {
                    // If user document exists, update last login time
                    await setDoc(userDocRef, {
                        name: user.displayName,
                        email: user.email,
                        lastLoginAt: serverTimestamp()
                    }, { merge: true });
                    console.log("Existing user profile updated for:", user.email);

                    // Redirect existing users based on hometown status
                    if (!userDocSnap.data().hometown) {
                        window.location.href = 'set-hometown.html';
                    } else {
                        window.location.href = 'discover.html';
                    }
                }

            } catch (error) {
                console.error("Error during Google Sign-In:", error);
                alert(`Google Sign-In failed: ${error.message}`);
            }
        });
    }

    // --- AUTHENTICATION STATE OBSERVER ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (window.location.pathname.includes('index.html')) {
                const userDocRef = doc(db, "users", user.uid);
                try {
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists() && userDocSnap.data().hometown) {
                        window.location.href = 'discover.html';
                    } else {
                        window.location.href = 'set-hometown.html';
                    }
                } catch (error) {
                    console.error("Error checking user hometown:", error);
                    window.location.href = 'discover.html'; 
                }
            }
        }
    });
});

/**
 * Finds the referrer by their UID and awards them one point if they are an affiliate.
 * @param {string} referrerId - The UID of the user who referred the new user.
 */
async function awardPointToReferrer(referrerId) {
    console.log(`Attempting to award point to referrer: ${referrerId}`);
    try {
        // Find the user document directly by their UID
        const referrerDocRef = doc(db, "users", referrerId);
        const referrerDocSnap = await getDoc(referrerDocRef);

        // Check if the referrer exists AND is an approved affiliate
        if (referrerDocSnap.exists() && referrerDocSnap.data().isAffiliate === true) {
            // Increment their referralPoints by 1
            await updateDoc(referrerDocRef, {
                referralPoints: increment(1)
            });
            console.log(`Successfully awarded 1 point to affiliate ${referrerDocSnap.data().email}`);
        } else {
            console.warn(`Referrer with ID "${referrerId}" not found or is not an affiliate.`);
        }
    } catch (error) {
        console.error("Error awarding point to referrer:", error);
    }
}
