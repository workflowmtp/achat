import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCOU1QKdC9Nkc9xnaMFn1ngdd6wBEwciz4",
  authDomain: "gestion-de-caisse.firebaseapp.com",
  projectId: "gestion-de-caisse",
  storageBucket: "gestion-de-caisse.appspot.com",
  messagingSenderId: "687375906007",
  appId: "1:687375906007:web:d101f8df6321a617a26c92",
  measurementId: "G-ZHH75YZCKF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

// Enable offline persistence
const setupPersistence = async () => {
  try {
    await enableIndexedDbPersistence(db, {
      synchronizeTabs: true
    });
    console.log('Offline persistence enabled');
  } catch (error) {
    if (error.code === 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time');
    } else if (error.code === 'unimplemented') {
      console.warn('The current browser doesn\'t support persistence');
    } else {
      console.error('Error enabling persistence:', error);
    }
  }
};

// Initialize persistence
setupPersistence().catch(console.error);

export default app;