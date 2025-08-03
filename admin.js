// js/admin.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore, 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    doc, 
    setDoc, 
    updateDoc, 
    deleteDoc,
    getDocs, 
    getDoc, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL,
    deleteObject 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { firebaseConfig } from './firebase-config.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

console.log("Firebase App Initialized:", app.name);
console.log("Firebase Config Loaded:", firebaseConfig);

let allBusinesses = [];
let currentFilters = {
    town: '',
    status: '',
    search: ''
};
let businessToDeleteId = null;
let selectedImageFileForAdminAdd = null;
let selectedImageFileForEdit = null;

// --- DOM ELEMENTS ---
// Login/Signup related
const adminLoginForm = document.getElementById('admin-login-form');
const adminLoginEmailInput = document.getElementById('email');
const adminLoginPasswordInput = document.getElementById('password');
const adminLoginBtn = document.getElementById('login-btn');
const adminLoginErrorMessage = document.getElementById('admin-login-error-message');

const adminSignupForm = document.getElementById('admin-signup-form');
const adminSignupEmailInput = document.getElementById('signup-email');
const adminSignupPasswordInput = document.getElementById('signup-password');
const adminSignupConfirmPasswordInput = document.getElementById('signup-confirm-password');
const adminSignupBtn = document.getElementById('signup-btn');
const adminSignupErrorMessage = document.getElementById('admin-signup-error-message');

const toggleFormLink = document.getElementById('toggle-form-link');

// Dashboard-related
const adminDashboardContent = document.getElementById('admin-dashboard-content');
const adminLogoutBtn = document.getElementById('logout-btn');

// Business List Filters
const filterStatusSelect = document.getElementById('filter-status');
const filterTownSelect = document.getElementById('filter-town');
const filterSearchInput = document.getElementById('filter-search');

// Business Lists
const pendingBusinessesList = document.getElementById('pending-businesses-list');
const approvedBusinessesList = document.getElementById('approved-businesses-list');
const rejectedBusinessesList = document.getElementById('rejected-businesses-list');
const noPendingBusinessesMsg = document.getElementById('no-pending-businesses');
const noApprovedBusinessesMsg = document.getElementById('no-approved-businesses');
const noRejectedBusinessesMsg = document.getElementById('no-rejected-businesses');

// Admin Add Business Form elements
const adminAddBusinessForm = document.getElementById('admin-add-business-form');
const adminTownSelect = document.getElementById('admin-town');
const adminImageInput = document.getElementById('admin-image'); // File input
const adminImageUrlInput = document.getElementById('admin-image-url'); // URL input
const adminImagePreview = document.getElementById('admin-image-preview');
const adminAddBusinessStatus = document.getElementById('admin-add-business-status');

// Edit Modal elements
const editModal = document.getElementById('edit-modal');
const editBusinessForm = document.getElementById('edit-business-form');
const editBusinessIdInput = document.getElementById('edit-business-id');
const editNameInput = document.getElementById('edit-name');
const editCategorySelect = document.getElementById('edit-category');
const editTownSelect = document.getElementById('edit-town');
const editDescriptionInput = document.getElementById('edit-description');
const editAddressInput = document.getElementById('edit-address');
const editPhoneInput = document.getElementById('edit-phone');
const editStatusSelect = document.getElementById('edit-status');
const editImageInput = document.getElementById('edit-image'); // File input
const editImageUrlInput = document.getElementById('edit-image-url'); // URL input
const editImagePreview = document.getElementById('edit-image-preview');
const currentImageNameP = document.getElementById('current-image-name');
const editOwnerEmailInput = document.getElementById('edit-owner-email');
const editStatusMessage = document.getElementById('edit-status-message');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Delete Modal elements
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// Analytics elements
const userCountEl = document.getElementById('user-count');
const totalBusinessesCountEl = document.getElementById('total-businesses-count');
const approvedBusinessesCountEl = document.getElementById('approved-businesses-count');
const pendingBusinessesCountEl = document.getElementById('pending-businesses-count');
const mostViewedBusinessesList = document.getElementById('most-viewed-businesses-list');
const businessesByTownList = document.getElementById('businesses-by-town-list');

// NEW: Claim Request Elements
const claimRequestsList = document.getElementById('claim-requests-list');
const noClaimRequestsMsg = document.getElementById('no-claim-requests-msg');


// --- HELPER FUNCTIONS ---

/**
 * Checks if a user's UID exists in the 'adminUsers' Firestore collection.
 * @param {string} uid The user's UID.
 * @returns {Promise<boolean>} True if the user is an admin, false otherwise.
 */
async function checkIfUserIsAdminInFirestore(uid) {
    if (!uid) {
        console.warn("checkIfUserIsAdminInFirestore called with null UID.");
        return false;
    }
    console.log(`[Admin Check] Checking admin status for UID: ${uid}`); // Diagnostic log
    try {
        const adminDocRef = doc(db, "adminUsers", uid);
        const adminDocSnap = await getDoc(adminDocRef);
        console.log(`[Admin Check] Admin doc for ${uid} exists: ${adminDocSnap.exists()}`); // Diagnostic log
        return adminDocSnap.exists();
    } catch (error) {
        console.error("[Admin Check] Error checking admin status in Firestore:", error);
        return false;
    }
}

/**
 * Adds a new admin user's details to the 'adminUsers' Firestore collection.
 * This should only be called after successful Firebase Authentication user creation.
 * @param {string} uid The user's UID.
 * @param {string} email The user's email.
 */
async function addAdminUserToFirestore(uid, email) {
    console.log(`[Firestore Write] Attempting to add admin user to Firestore: UID=${uid}, Email=${email}`); // Diagnostic log
    try {
        const adminDocRef = doc(db, "adminUsers", uid);
        console.log(`[Firestore Write] Calling setDoc for path: adminUsers/${uid}`); // More specific log
        await setDoc(adminDocRef, {
            email: email,
            createdAt: serverTimestamp()
        });
        console.log(`[Firestore Write] Admin user ${email} (UID: ${uid}) successfully added to Firestore.`); // Diagnostic log
    } catch (error) {
        console.error(`[Firestore Write] Error adding admin user ${email} (UID: ${uid}) to Firestore:`, error); // Diagnostic log
        if (error.code === 'permission-denied') {
            alert("Permission denied: Failed to register admin in database. Check Firestore Security Rules.");
        } else {
            alert(`Failed to register admin in database: ${error.message}. Please contact support.`);
        }
    } finally {
        console.log(`[Firestore Write] addAdminUserToFirestore function completed for UID: ${uid}`); // Final log
    }
}


// --- AUTHENTICATION STATE OBSERVER ---
onAuthStateChanged(auth, async (user) => {
    const currentPage = window.location.pathname.split('/').pop();
    console.log("onAuthStateChanged triggered. User:", user ? user.email : "null", "Current Page:", currentPage);

    const isOnLoginPage = (currentPage === 'admin-login.html');
    const isOnPanelPage = (currentPage === 'admin-panel.html');

    if (user) {
        // User is logged in via Firebase Auth. Now verify if they are an authorized admin.
        const isAdmin = await checkIfUserIsAdminInFirestore(user.uid);
        
        if (isAdmin) {
            console.log("Authenticated user is an admin:", user.email);
            if (isOnLoginPage) {
                console.log("Redirecting from login page to admin panel.");
                window.location.href = 'admin-panel.html'; // Redirect to dashboard
            } else if (isOnPanelPage) {
                console.log("Already on admin panel, showing dashboard content.");
                // Ensure login/signup forms are hidden and dashboard content is visible
                if (adminLoginForm) adminLoginForm.classList.add('hidden');
                if (adminSignupForm) adminSignupForm.classList.add('hidden');
                if (adminDashboardContent) adminDashboardContent.classList.remove('hidden');
                
                // Initialize dashboard features
                populateAdminTownDropdowns();
                fetchBusinesses(); // This will trigger rendering and other data fetches
                fetchClaimRequests(); // Fetch claim requests
                populateTownFilter(); // Ensures filter is populated on load
                fetchAnalytics(); // Ensures analytics are fetched on load
            }
        } else {
            // Logged in but not an authorized admin (e.g., a regular user tried to access admin panel)
            console.log("Authenticated user is NOT an admin. Signing out.");
            alert("Access Denied: You are not authorized to access the admin panel.");
            await signOut(auth); // Sign out unauthorized user
            if (!isOnLoginPage) { // Only redirect if not already on login page
                window.location.href = 'admin-login.html';
            } else {
                // If already on admin-login.html, just ensure login/signup forms are visible
                if (adminLoginForm) adminLoginForm.classList.remove('hidden');
                if (adminSignupForm) adminSignupForm.classList.add('hidden'); // Default to login view
                if (adminDashboardContent) adminDashboardContent.classList.add('hidden');
            }
        }
    } else {
        // No user is logged in
        console.log("No user authenticated.");
        if (isOnPanelPage) {
            console.log("Not logged in and on admin panel, redirecting to login.");
            window.location.href = 'admin-login.html'; // Redirect to admin login
        } else if (isOnLoginPage) {
            console.log("Not logged in and on login page, ensuring login form is visible.");
            // Ensure login form is visible and dashboard content is hidden
            if (adminLoginForm) adminLoginForm.classList.remove('hidden');
            if (adminSignupForm) adminSignupForm.classList.add('hidden'); // Default to login view
            if (adminDashboardContent) adminDashboardContent.classList.add('hidden');
        }
    }
});

// --- DOMContentLoaded Event Listener ---
// Ensures all DOM elements are loaded before attaching event listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded fired.");

    // --- TOGGLE LOGIN/SIGNUP FORMS ---
    if (toggleFormLink) {
        toggleFormLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (adminLoginForm && adminSignupForm) {
                adminLoginForm.classList.toggle('hidden');
                adminSignupForm.classList.toggle('hidden');
                if (adminLoginForm.classList.contains('hidden')) {
                    toggleFormLink.textContent = 'Switch to Login';
                    if (adminSignupErrorMessage) adminSignupErrorMessage.textContent = ''; // Clear signup errors
                } else {
                    toggleFormLink.textContent = 'Switch to Sign Up';
                    if (adminLoginErrorMessage) adminLoginErrorMessage.textContent = ''; // Clear login errors
                }
            }
        });
    }

    // --- ADMIN LOGIN LOGIC ---
    if (adminLoginBtn) {
        adminLoginBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("Login button clicked. Initiating sign-in...");

            const loginEmail = adminLoginEmailInput.value.trim();
            const loginPassword = adminLoginPasswordInput.value.trim();

            adminLoginBtn.disabled = true;
            adminLoginBtn.textContent = 'Logging In...';
            if (adminLoginErrorMessage) adminLoginErrorMessage.textContent = '';

            if (!loginEmail || !loginPassword) {
                if (adminLoginErrorMessage) {
                    adminLoginErrorMessage.textContent = "Please enter both email and password.";
                }
                adminLoginBtn.disabled = false;
                adminLoginBtn.textContent = 'Login';
                console.log("Login attempt failed: Email or password missing.");
                return;
            }

            try {
                const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
                console.log("signInWithEmailAndPassword successful for user:", userCredential.user.email);
                // onAuthStateChanged will handle the redirection.
            } catch (error) {
                console.error("Firebase Auth Error during login:", error);
                let errorMessage = "Login failed. Please check your credentials.";
                if (error.code) {
                    console.error("Error Code:", error.code);
                    console.error("Error Message:", error.message);
                    switch (error.code) {
                        case 'auth/user-not-found':
                        case 'auth/wrong-password':
                            errorMessage = "Invalid email or password.";
                            break;
                        case 'auth/invalid-email':
                            errorMessage = "Invalid email format.";
                            break;
                        case 'auth/user-disabled':
                            errorMessage = "Your account has been disabled.";
                            break;
                        default:
                            errorMessage = `Login error: ${error.message}`;
                    }
                }
                if (adminLoginErrorMessage) {
                    adminLoginErrorMessage.textContent = errorMessage;
                }
                console.log("Login attempt failed with error:", errorMessage);
            } finally {
                adminLoginBtn.disabled = false;
                adminLoginBtn.textContent = 'Login';
                console.log("Login button re-enabled.");
            }
        });
    }

    // --- ADMIN SIGNUP LOGIC ---
    if (adminSignupBtn) {
        adminSignupBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log("Signup button clicked. Initiating user creation...");

            const signupEmail = adminSignupEmailInput.value.trim();
            const signupPassword = adminSignupPasswordInput.value.trim();
            const signupConfirmPassword = adminSignupConfirmPasswordInput.value.trim();

            adminSignupBtn.disabled = true;
            adminSignupBtn.textContent = 'Signing Up...';
            if (adminSignupErrorMessage) adminSignupErrorMessage.textContent = '';

            if (!signupEmail || !signupPassword || !signupConfirmPassword) {
                if (adminSignupErrorMessage) {
                    adminSignupErrorMessage.textContent = "Please fill in all fields.";
                }
                adminSignupBtn.disabled = false;
                adminSignupBtn.textContent = 'Sign Up';
                console.log("Signup attempt failed: Missing fields.");
                return;
            }

            if (signupPassword.length < 6) {
                if (adminSignupErrorMessage) {
                    adminSignupErrorMessage.textContent = "Password should be at least 6 characters.";
                }
                adminSignupBtn.disabled = false;
                adminSignupBtn.textContent = 'Sign Up';
                console.log("Signup attempt failed: Password too short.");
                return;
            }

            if (signupPassword !== signupConfirmPassword) {
                if (adminSignupErrorMessage) {
                    adminSignupErrorMessage.textContent = "Passwords do not match.";
                }
                adminSignupBtn.disabled = false;
                adminSignupBtn.textContent = 'Sign Up';
                console.log("Signup attempt failed: Passwords mismatch.");
                return;
            }

            try {
                console.log("[Signup Flow] Attempting createUserWithEmailAndPassword...");
                const userCredential = await createUserWithEmailAndPassword(auth, signupEmail, signupPassword);
                console.log("[Signup Flow] createUserWithEmailAndPassword successful for user:", userCredential.user.email);
                console.log("[Signup Flow] New user UID:", userCredential.user.uid); 
                
                console.log("[Signup Flow] Calling addAdminUserToFirestore...");
                // Add the new user's UID and email to the 'adminUsers' collection in Firestore
                await addAdminUserToFirestore(userCredential.user.uid, userCredential.user.email);
                console.log("[Signup Flow] addAdminUserToFirestore call completed.");

                if (adminSignupErrorMessage) {
                    adminSignupErrorMessage.textContent = "Account created successfully! You can now log in.";
                    adminSignupErrorMessage.classList.remove('text-red-500');
                    adminSignupErrorMessage.classList.add('text-green-500');
                }
                // Automatically switch to login form after successful signup
                if (adminLoginForm && adminSignupForm && toggleFormLink) {
                    adminLoginForm.classList.remove('hidden');
                    adminSignupForm.classList.add('hidden');
                    toggleFormLink.textContent = 'Switch to Sign Up';
                }
                adminSignupForm.reset(); // Clear signup form
                
            } catch (error) {
                console.error("Firebase Auth Error during signup:", error);
                let errorMessage = "Signup failed. Please try again.";
                if (error.code) {
                    console.error("Error Code:", error.code);
                    console.error("Error Message:", error.message);
                    switch (error.code) {
                        case 'auth/email-already-in-use':
                            errorMessage = "Email address is already in use.";
                            break;
                        case 'auth/invalid-email':
                            errorMessage = "Invalid email address.";
                            break;
                        case 'auth/weak-password':
                            errorMessage = "Password is too weak.";
                            break;
                        default:
                            errorMessage = `Signup error: ${error.message}`;
                    }
                }
                if (adminSignupErrorMessage) {
                    adminSignupErrorMessage.textContent = errorMessage;
                    adminSignupErrorMessage.classList.remove('text-green-500');
                    adminSignupErrorMessage.classList.add('text-red-500');
                }
                console.log("Signup attempt failed with error:", errorMessage);
            } finally {
                adminSignupBtn.disabled = false;
                adminSignupBtn.textContent = 'Sign Up';
                console.log("Signup button re-enabled.");
            }
        });
    }

    // --- ADMIN LOGOUT LOGIC ---
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', async () => {
            console.log("Admin logout button clicked.");
            try {
                await signOut(auth);
                console.log("Admin signed out successfully.");
                // onAuthStateChanged will handle redirection to admin-login.html
            } catch (error) {
                console.error("Error signing out:", error);
                alert("Failed to log out. Please try again.");
            }
        });
    }

    // --- ATTACH OTHER DASHBOARD EVENT LISTENERS ---
    if (filterStatusSelect) {
        filterStatusSelect.addEventListener('change', () => {
            currentFilters.status = filterStatusSelect.value;
            fetchBusinesses();
        });
    }

    if (filterTownSelect) {
        filterTownSelect.addEventListener('change', () => {
            currentFilters.town = filterTownSelect.value;
            fetchBusinesses();
        });
    }

    if (filterSearchInput) {
        filterSearchInput.addEventListener('input', () => {
            currentFilters.search = filterSearchInput.value.toLowerCase();
            renderBusinesses();
        });
    }

    // Edit Modal Buttons
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            editModal.classList.add('hidden');
            editStatusMessage.textContent = '';
        });
    }

    if (editBusinessForm) {
        editBusinessForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const updateBtn = editBusinessForm.querySelector('button[type="submit"]');
            updateBtn.disabled = true;
            updateBtn.textContent = 'Saving...';
            editStatusMessage.textContent = '';

            const businessId = editBusinessIdInput.value;
            const name = editNameInput.value;
            const category = editCategorySelect.value;
            const town = editTownSelect.value;
            const description = editDescriptionInput.value;
            const address = editAddressInput.value;
            const phone = editPhoneInput.value;
            const status = editStatusSelect.value;
            const ownerEmail = editOwnerEmailInput.value || null;

            let newImageUrl = null;
            const currentBusiness = allBusinesses.find(b => b.id === businessId);
            const oldImageUrl = currentBusiness ? currentBusiness.imageUrl : null;
            const imageUrlFromInput = editImageUrlInput.value.trim();

            if (selectedImageFileForEdit) {
                try {
                    const storageRef = ref(storage, `business_images/${Date.now()}_${selectedImageFileForEdit.name}`);
                    const uploadTask = await uploadBytes(storageRef, selectedImageFileForEdit);
                    newImageUrl = await getDownloadURL(uploadTask.ref);
                    if (oldImageUrl && oldImageUrl.startsWith('gs://') && oldImageUrl !== newImageUrl) {
                        await deleteObject(ref(storage, oldImageUrl));
                    }
                } catch (error) {
                    editStatusMessage.textContent = `Failed to upload image: ${error.message}`;
                    updateBtn.disabled = false;
                    updateBtn.textContent = 'Save Changes';
                    return;
                }
            } else if (imageUrlFromInput) {
                newImageUrl = imageUrlFromInput;
                if (oldImageUrl && oldImageUrl.startsWith('gs://')) {
                    await deleteObject(ref(storage, oldImageUrl));
                }
            } else if (editImageInput.value === '' && imageUrlFromInput === '' && oldImageUrl) {
                newImageUrl = null;
                if (oldImageUrl.startsWith('gs://')) {
                    await deleteObject(ref(storage, oldImageUrl));
                }
            } else {
                newImageUrl = oldImageUrl;
            }

            try {
                await updateDoc(doc(db, "businesses", businessId), {
                    name, category, town, description, address, phone, status, ownerEmail,
                    imageUrl: newImageUrl,
                    updatedAt: serverTimestamp()
                });
                editStatusMessage.textContent = "Business details updated successfully! ✅";
                selectedImageFileForEdit = null;
                editModal.classList.add('hidden');
            } catch (error) {
                editStatusMessage.textContent = `Failed to update business: ${error.message}`;
            } finally {
                updateBtn.disabled = false;
                updateBtn.textContent = 'Save Changes';
            }
        });
    }

    if (editImageInput) {
        editImageInput.addEventListener('change', (e) => {
            selectedImageFileForEdit = e.target.files[0];
            if (selectedImageFileForEdit) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    editImagePreview.src = e.target.result;
                    editImagePreview.classList.remove('hidden');
                    currentImageNameP.textContent = `New: ${selectedImageFileForEdit.name}`;
                };
                reader.readAsDataURL(selectedImageFileForEdit);
                editImageUrlInput.value = '';
            } else {
                if (!editImageUrlInput.value) {
                    editImagePreview.classList.add('hidden');
                }
                currentImageNameP.textContent = 'No new image selected.';
            }
        });
    }

    if (editImageUrlInput) {
        editImageUrlInput.addEventListener('input', () => {
            const url = editImageUrlInput.value.trim();
            if (url) {
                editImagePreview.src = url;
                editImagePreview.classList.remove('hidden');
                editImagePreview.onerror = () => {
                    editImagePreview.src = 'https://placehold.co/150x150/E5E7EB/000000?text=Invalid+URL'; 
                    currentImageNameP.textContent = "Invalid image URL provided.";
                };
                currentImageNameP.textContent = `New URL: ${url}`;
                editImageInput.value = '';
                selectedImageFileForEdit = null;
            } else {
                if (!selectedImageFileForEdit) {
                    editImagePreview.classList.add('hidden');
                }
                currentImageNameP.textContent = 'No image URL.';
            }
        });
    }

    // Delete Modal Buttons
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async () => {
            if (!businessToDeleteId) return;

            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = 'Deleting...';

            try {
                const businessDoc = await getDoc(doc(db, "businesses", businessToDeleteId));
                if (businessDoc.exists()) {
                    const businessData = businessDoc.data();
                    if (businessData.imageUrl && businessData.imageUrl.startsWith('gs://')) {
                        await deleteObject(ref(storage, businessData.imageUrl));
                    }
                    await deleteDoc(doc(db, "businesses", businessToDeleteId));
                    alert("Business deleted successfully! 🗑️");
                }
                deleteConfirmModal.classList.add('hidden');
            } catch (error) {
                alert(`Failed to delete business: ${error.message}`);
            } finally {
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = 'Delete';
                businessToDeleteId = null;
            }
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            deleteConfirmModal.classList.add('hidden');
            businessToDeleteId = null;
        });
    }

    // Admin Add New Business Form
    if (adminImageInput) {
        adminImageInput.addEventListener('change', (e) => {
            selectedImageFileForAdminAdd = e.target.files[0];
            if (selectedImageFileForAdminAdd) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    adminImagePreview.src = e.target.result;
                    adminImagePreview.classList.remove('hidden');
                };
                reader.readAsDataURL(selectedImageFileForAdminAdd);
                adminImageUrlInput.value = '';
            } else {
                if (!adminImageUrlInput.value) {
                    adminImagePreview.classList.add('hidden');
                }
            }
        });
    }

    if (adminImageUrlInput) {
        adminImageUrlInput.addEventListener('input', () => {
            const url = adminImageUrlInput.value.trim();
            if (url) {
                adminImagePreview.src = url;
                adminImagePreview.classList.remove('hidden');
                adminImagePreview.onerror = () => {
                    adminImagePreview.src = 'https://placehold.co/150x150/E5E7EB/000000?text=Invalid+URL'; 
                    adminAddBusinessStatus.textContent = "Invalid image URL provided.";
                };
                adminImageInput.value = '';
                selectedImageFileForAdminAdd = null;
            } else {
                if (!selectedImageFileForAdminAdd) {
                    adminImagePreview.classList.add('hidden');
                }
                adminAddBusinessStatus.textContent = '';
            }
        });
    }

    if (adminAddBusinessForm) {
        adminAddBusinessForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('admin-add-business-btn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';
            adminAddBusinessStatus.textContent = '';

            const businessName = document.getElementById('admin-name').value;
            const businessCategory = document.getElementById('admin-category').value;
            const businessTown = adminTownSelect.value;
            const businessDescription = document.getElementById('admin-description').value;
            const businessAddress = document.getElementById('admin-address').value;
            const businessPhone = document.getElementById('admin-phone').value;
            const businessOwnerEmail = document.getElementById('admin-owner-email').value || null;

            if (!businessName || !businessCategory || !businessTown || !businessDescription || !businessAddress || !businessPhone) {
                adminAddBusinessStatus.textContent = 'Please fill in all required fields.';
                adminAddBusinessStatus.classList.add('text-red-500');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Business (Approved)';
                return;
            }

            let imageUrl = null;
            const imageUrlFromInput = adminImageUrlInput.value.trim();

            if (selectedImageFileForAdminAdd) {
                try {
                    const storageRef = ref(storage, `business_images/${Date.now()}_${selectedImageFileForAdminAdd.name}`);
                    const uploadResult = await uploadBytes(storageRef, selectedImageFileForAdminAdd);
                    imageUrl = await getDownloadURL(uploadResult.ref);
                } catch (error) {
                    adminAddBusinessStatus.textContent = "Failed to upload image.";
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Add Business (Approved)';
                    return;
                }
            } else if (imageUrlFromInput) {
                imageUrl = imageUrlFromInput;
            }

            try {
                await addDoc(collection(db, "businesses"), {
                    name: businessName,
                    category: businessCategory,
                    town: businessTown,
                    description: businessDescription,
                    address: businessAddress,
                    phone: businessPhone,
                    imageUrl: imageUrl,
                    ownerEmail: businessOwnerEmail,
                    submittedBy: auth.currentUser.uid,
                    createdAt: serverTimestamp(),
                    status: 'approved',
                    upvoteCount: 0, 
                    upvotedBy: [], 
                    views: 0,
                    isClaimed: false,
                    claimedBy: null,
                    claimStatus: 'unclaimed'
                });

                adminAddBusinessStatus.textContent = "✅ Business added successfully!";
                adminAddBusinessStatus.classList.remove('text-red-500');
                adminAddBusinessStatus.classList.add('text-emerald-400');
                adminAddBusinessForm.reset();
                adminImagePreview.classList.add('hidden');
                selectedImageFileForAdminAdd = null;
                
            } catch (error) {
                adminAddBusinessStatus.textContent = "❌ Failed to add business.";
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Add Business (Approved)';
            }
        });
    }
});

// --- ANALYTICS FUNCTIONS ---
async function fetchAnalytics() {
    if (!userCountEl || !totalBusinessesCountEl || !approvedBusinessesCountEl || 
        !pendingBusinessesCountEl || !mostViewedBusinessesList || !businessesByTownList) {
        return;
    }

    try {
        const businessSnapshot = await getDocs(collection(db, "businesses"));
        const allBusinessesData = businessSnapshot.docs.map(doc => doc.data());

        totalBusinessesCountEl.textContent = allBusinessesData.length;
        approvedBusinessesCountEl.textContent = allBusinessesData.filter(b => b.status === 'approved').length;
        pendingBusinessesCountEl.textContent = allBusinessesData.filter(b => b.status === 'pending').length;

        const uids = new Set(allBusinessesData.map(b => b.submittedBy).filter(Boolean));
        const emails = new Set(allBusinessesData.map(b => b.ownerEmail).filter(Boolean));
        userCountEl.textContent = uids.size + emails.size;

        const sortedByViews = allBusinessesData.sort((a, b) => (b.views || 0) - (a.views || 0));
        mostViewedBusinessesList.innerHTML = '';
        sortedByViews.slice(0, 5).forEach(business => {
            const li = document.createElement('li');
            li.textContent = `${business.name} (${business.views || 0} views)`;
            mostViewedBusinessesList.appendChild(li);
        });

        const businessesByTown = allBusinessesData.reduce((acc, b) => {
            if (b.town) acc[b.town] = (acc[b.town] || 0) + 1;
            return acc;
        }, {});
        const sortedTowns = Object.entries(businessesByTown).sort(([, a], [, b]) => b - a);
        businessesByTownList.innerHTML = '';
        sortedTowns.slice(0, 5).forEach(([town, count]) => {
            const li = document.createElement('li');
            li.textContent = `${town}: ${count} businesses`;
            businessesByTownList.appendChild(li);
        });

    } catch (error) {
        console.error("Error fetching analytics:", error);
    }
}

// --- POPULATE TOWN FILTER ---
async function populateTownFilter() {
    if (!filterTownSelect) return;
    try {
        const querySnapshot = await getDocs(collection(db, "businesses"));
        const towns = new Set(querySnapshot.docs.map(doc => doc.data().town).filter(Boolean));
        filterTownSelect.innerHTML = '<option value="">All Towns</option>';
        towns.forEach(town => {
            const option = new Option(town, town);
            filterTownSelect.add(option);
        });
    } catch (error) {
        console.error("Error populating town filter:", error);
    }
}

// --- BUSINESS RENDERING ---
function fetchBusinesses() {
    let q = query(collection(db, "businesses"), orderBy("createdAt", "desc"));
    if (currentFilters.status) q = query(q, where("status", "==", currentFilters.status));
    if (currentFilters.town) q = query(q, where("town", "==", currentFilters.town));

    onSnapshot(q, (snapshot) => {
        allBusinesses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderBusinesses();
        populateAdminTownDropdowns();
        fetchAnalytics();
    });
}

function renderBusinesses() {
    if (!pendingBusinessesList || !approvedBusinessesList || !rejectedBusinessesList) return;

    pendingBusinessesList.innerHTML = '';
    approvedBusinessesList.innerHTML = '';
    rejectedBusinessesList.innerHTML = '';

    const filtered = allBusinesses.filter(b => 
        !currentFilters.search || 
        b.name.toLowerCase().includes(currentFilters.search) || 
        b.description.toLowerCase().includes(currentFilters.search)
    );

    const pending = filtered.filter(b => b.status === 'pending');
    const approved = filtered.filter(b => b.status === 'approved');
    const rejected = filtered.filter(b => b.status === 'rejected');

    noPendingBusinessesMsg.style.display = pending.length ? 'none' : 'block';
    noApprovedBusinessesMsg.style.display = approved.length ? 'none' : 'block';
    noRejectedBusinessesMsg.style.display = rejected.length ? 'none' : 'block';

    pending.forEach(b => pendingBusinessesList.appendChild(createBusinessCard(b)));
    approved.forEach(b => approvedBusinessesList.appendChild(createBusinessCard(b)));
    rejected.forEach(b => rejectedBusinessesList.appendChild(createBusinessCard(b)));
}

function createBusinessCard(business) {
    const div = document.createElement('div');
    div.className = 'business-item bg-gray-800 p-4 rounded-lg shadow items-center text-sm md:text-base';
    const imageUrl = business.imageUrl || 'https://via.placeholder.com/150?text=No+Image';

    div.innerHTML = `
        <div class="flex items-center space-x-3 md:col-span-2">
            <img src="${imageUrl}" alt="${business.name}" class="w-16 h-16 object-cover rounded-md">
            <div>
                <h3 class="text-lg font-semibold text-white">${business.name}</h3>
                <p class="text-gray-400">${business.category} • ${business.town}</p>
            </div>
        </div>
        <div><p class="text-gray-300">Status: <span class="font-medium ${business.status === 'approved' ? 'text-emerald-400' : 'text-yellow-400'}">${business.status}</span></p></div>
        <div><p class="text-gray-300">Submitted By: ${business.ownerEmail || 'N/A'}</p></div>
        <div class="flex flex-wrap gap-2 mt-3 md:mt-0 md:justify-end">
            ${business.status === 'pending' ? `
                <button class="approve-btn bg-emerald-600 text-white px-3 py-1 rounded-md" data-id="${business.id}">Approve</button>
                <button class="reject-btn bg-yellow-600 text-white px-3 py-1 rounded-md" data-id="${business.id}">Reject</button>
            ` : ''}
            <button class="edit-btn bg-blue-600 text-white px-3 py-1 rounded-md" data-id="${business.id}">Edit</button>
            <button class="delete-btn bg-red-600 text-white px-3 py-1 rounded-md" data-id="${business.id}">Delete</button>
        </div>
    `;

    div.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const action = e.target.classList.contains('approve-btn') ? 'approved' :
                           e.target.classList.contains('reject-btn') ? 'rejected' :
                           e.target.classList.contains('edit-btn') ? 'edit' : 'delete';
            handleBusinessAction(e.target, action);
        });
    });

    return div;
}

async function handleBusinessAction(button, actionType) {
    const businessId = button.dataset.id;
    if (!businessId) return;

    if (actionType === 'approved' || actionType === 'rejected') {
        await updateDoc(doc(db, "businesses", businessId), { status: actionType });
        alert(`Business ${actionType}.`);
    } else if (actionType === 'edit') {
        const business = allBusinesses.find(b => b.id === businessId);
        if (business) {
            editBusinessIdInput.value = business.id;
            editNameInput.value = business.name;
            editCategorySelect.value = business.category;
            editTownSelect.value = business.town;
            editDescriptionInput.value = business.description;
            editAddressInput.value = business.address;
            editPhoneInput.value = business.phone;
            editStatusSelect.value = business.status;
            editOwnerEmailInput.value = business.ownerEmail;
            if (business.imageUrl) {
                editImagePreview.src = business.imageUrl;
                editImagePreview.classList.remove('hidden');
            }
            editModal.classList.remove('hidden');
        }
    } else if (actionType === 'delete') {
        businessToDeleteId = businessId;
        deleteConfirmModal.classList.remove('hidden');
    }
}

// --- POPULATE ADMIN TOWN DROPDOWNS ---
async function populateAdminTownDropdowns() {
    if (!adminTownSelect || !editTownSelect) return;
    const currentAdminTown = adminTownSelect.value;
    const currentEditTown = editTownSelect.value;

    adminTownSelect.innerHTML = '<option value="">Select a Town</option>';
    editTownSelect.innerHTML = '<option value="">Select a Town</option>';

    try {
        const townsSnapshot = await getDocs(query(collection(db, "towns"), orderBy("name")));
        townsSnapshot.forEach((doc) => {
            const town = doc.data();
            const option = new Option(town.name, town.name);
            adminTownSelect.add(option.cloneNode(true));
            editTownSelect.add(option);
        });
        adminTownSelect.value = currentAdminTown;
        editTownSelect.value = currentEditTown;
    } catch (error) {
        console.error("Error fetching towns for dropdowns:", error);
    }
}


// --- NEW: CLAIM REQUEST FUNCTIONS ---

/**
 * Fetches pending business claim requests from Firestore.
 */
function fetchClaimRequests() {
    const q = query(collection(db, "claimRequests"), where("status", "==", "pending"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        if (!claimRequestsList || !noClaimRequestsMsg) return;

        if (snapshot.empty) {
            claimRequestsList.innerHTML = '';
            noClaimRequestsMsg.style.display = 'block';
            return;
        }
        
        noClaimRequestsMsg.style.display = 'none';
        claimRequestsList.innerHTML = ''; // Clear previous list
        snapshot.forEach(doc => {
            const request = { id: doc.id, ...doc.data() };
            claimRequestsList.appendChild(createClaimRequestCard(request));
        });

    }, (error) => {
        console.error("Error fetching claim requests:", error);
        if(claimRequestsList) claimRequestsList.innerHTML = '<p class="text-red-500 text-center">Failed to load claim requests.</p>';
    });
}

/**
 * Creates an HTML element for a single claim request.
 * @param {object} request - The claim request data.
 * @returns {HTMLElement} The created div element.
 */
function createClaimRequestCard(request) {
    const div = document.createElement('div');
    div.className = 'claim-item bg-gray-800 p-4 rounded-lg shadow items-center text-sm';

    div.innerHTML = `
        <div>
            <h3 class="font-semibold text-white">${request.businessName}</h3>
            <p class="text-gray-400">Business ID: ${request.businessId}</p>
        </div>
        <div>
            <p class="text-gray-300">Requested by: ${request.requestingUserEmail}</p>
            <p class="text-gray-400">User ID: ${request.requestingUserId}</p>
        </div>
        <div>
            <p class="text-gray-300 font-semibold">Proof:</p>
            <p class="text-gray-400 whitespace-pre-wrap">${request.proofOfOwnership}</p>
        </div>
        <div class="flex flex-wrap gap-2 md:justify-end">
            <button class="approve-claim-btn bg-emerald-600 text-white px-3 py-1 rounded-md hover:bg-emerald-700 transition" data-claim-id="${request.id}" data-business-id="${request.businessId}" data-user-id="${request.requestingUserId}" data-user-email="${request.requestingUserEmail}">Approve</button>
            <button class="reject-claim-btn bg-red-600 text-white px-3 py-1 rounded-md hover:bg-red-700 transition" data-claim-id="${request.id}" data-business-id="${request.businessId}">Reject</button>
        </div>
    `;

    div.querySelector('.approve-claim-btn').addEventListener('click', (e) => handleClaimAction(e, 'approved'));
    div.querySelector('.reject-claim-btn').addEventListener('click', (e) => handleClaimAction(e, 'rejected'));

    return div;
}

/**
 * Handles the approval or rejection of a claim request.
 * @param {Event} e - The click event.
 * @param {string} actionType - 'approved' or 'rejected'.
 */
async function handleClaimAction(e, actionType) {
    const button = e.currentTarget;
    const { claimId, businessId, userId, userEmail } = button.dataset;

    button.disabled = true;
    button.textContent = 'Processing...';

    const claimRef = doc(db, "claimRequests", claimId);
    const businessRef = doc(db, "businesses", businessId);

    try {
        if (actionType === 'approved') {
            // Update the business document
            await updateDoc(businessRef, {
                isClaimed: true,
                claimedBy: userId,
                ownerEmail: userEmail, // Assign the business to the claiming user's email
                claimStatus: 'approved'
            });

            // Update the claim request document
            await updateDoc(claimRef, {
                status: 'approved',
                reviewedAt: serverTimestamp()
            });

            alert('Claim approved successfully!');

        } else if (actionType === 'rejected') {
            // Update the business document to allow others to claim
            await updateDoc(businessRef, {
                claimStatus: 'unclaimed' // Reset status
            });

            // Update the claim request document
            await updateDoc(claimRef, {
                status: 'rejected',
                reviewedAt: serverTimestamp()
            });

            alert('Claim rejected.');
        }
    } catch (error) {
        console.error(`Error ${actionType} claim:`, error);
        alert(`Failed to ${actionType} the claim. Please check the console.`);
        button.disabled = false;
        button.textContent = actionType === 'approved' ? 'Approve' : 'Reject';
    }
}
