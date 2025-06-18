import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
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

// Configure authentication persistence
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Auth persistence configured successfully');
  })
  .catch((error) => {
    console.error('Error configuring auth persistence:', error);
  });

// Enable offline persistence
const setupPersistence = async () => {
  try {
    await enableIndexedDbPersistence(db);
    console.log('Offline persistence enabled');
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const errorWithCode = error as { code: string };
      if (errorWithCode.code === 'failed-precondition') {
        console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time');
      } else if (errorWithCode.code === 'unimplemented') {
        console.warn('The current browser\'s doesn\'t support persistence');
      } else {
        console.error('Error enabling persistence:', error);
      }
    } else {
      console.error('Unknown error enabling persistence:', error);
    }
  }
};

// Initialize persistence
setupPersistence().catch(console.error);

export default app;