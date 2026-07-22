// firebase/firebase.js
// -----------------------------------------------------------------------------
// Central Firebase init. Replace firebaseConfig below with your project's
// values (Firebase Console -> Project Settings -> General -> Your apps -> SDK
// setup and configuration). Every other file imports db + Firestore helpers
// from this single module so there is only one Firebase app instance.
// -----------------------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    deleteField

} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAJEhtNFhxx9kq_FzV4Y6hZttxh48J8Aes",
    authDomain: "information-board-9caba.firebaseapp.com",
    projectId: "information-board-9caba",
    storageBucket: "information-board-9caba.firebasestorage.app",
    messagingSenderId: "567842109045",
    appId: "1:567842109045:web:0f3b07f72b62c0ce31aa3c",
    measurementId: "G-8HMVYF0HYH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
    db,
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    deleteField
};