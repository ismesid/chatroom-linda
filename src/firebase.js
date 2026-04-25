// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAFVdG7J4wVuxUMMMnr3CRcgQt2sx_5O4s",
  authDomain: "chatroom-linda.firebaseapp.com",
  projectId: "chatroom-linda",
  storageBucket: "chatroom-linda.firebasestorage.app",
  messagingSenderId: "268702218367",
  appId: "1:268702218367:web:f808604c65394438b0e74a",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// 匯出之後會用到的 Firebase 功能
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;