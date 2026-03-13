import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyCnFVApUseYxanez9bVXQ1rV6WBJOWB6DE",
  authDomain: "mobile-wedding-web-ad664.firebaseapp.com",
  projectId: "mobile-wedding-web-ad664",
  storageBucket: "mobile-wedding-web-ad664.firebasestorage.app",
  messagingSenderId: "755477080200",
  appId: "1:755477080200:web:07afeb79713b5602aa173d",
  measurementId: "G-CTQNVW1D45"
};

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
