import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { auth } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userRole: string;
  isAdmin: boolean;
  accessEntries: boolean;
  accessExpenses: boolean;
  accessHistory: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userRole: '',
  isAdmin: false,
  accessEntries: false,
  accessExpenses: false,
  accessHistory: false
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [accessEntries, setAccessEntries] = useState(false);
  const [accessExpenses, setAccessExpenses] = useState(false);
  const [accessHistory, setAccessHistory] = useState(false);

  useEffect(() => {
    // Configurer la persistance de session
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('Persistance de session configurée avec succès');
      })
      .catch((error) => {
        console.error('Erreur lors de la configuration de la persistance:', error);
      });

    // Observer les changements d'état d'authentification
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Récupérer les informations de l'utilisateur depuis localStorage
        const storedUserRole = localStorage.getItem('userRole') || '';
        const storedIsAdmin = localStorage.getItem('isAdmin') === 'true';
        const storedAccessEntries = localStorage.getItem('accessEntries') === 'true';
        const storedAccessExpenses = localStorage.getItem('accessExpenses') === 'true';
        const storedAccessHistory = localStorage.getItem('accessHistory') === 'true';
        
        // Mettre à jour l'état avec les informations stockées
        setUserRole(storedUserRole);
        setIsAdmin(storedIsAdmin);
        setAccessEntries(storedAccessEntries);
        setAccessExpenses(storedAccessExpenses);
        setAccessHistory(storedAccessHistory);
        
        // Vérifier si les informations sont également dans Firestore
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Si les données existent dans Firestore mais pas dans localStorage, les mettre à jour
            if (!storedUserRole && userData.role) {
              localStorage.setItem('userRole', userData.role);
              setUserRole(userData.role);
            }
            if (!storedIsAdmin && userData.isAdmin) {
              localStorage.setItem('isAdmin', userData.isAdmin.toString());
              setIsAdmin(userData.isAdmin);
            }
            if (!storedAccessEntries && userData.accessEntries) {
              localStorage.setItem('accessEntries', userData.accessEntries.toString());
              setAccessEntries(userData.accessEntries);
            }
            if (!storedAccessExpenses && userData.accessExpenses) {
              localStorage.setItem('accessExpenses', userData.accessExpenses.toString());
              setAccessExpenses(userData.accessExpenses);
            }
            if (!storedAccessHistory && userData.accessHistory) {
              localStorage.setItem('accessHistory', userData.accessHistory.toString());
              setAccessHistory(userData.accessHistory);
            }
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des données utilisateur:', error);
        }
      } else {
        // Réinitialiser les états si l'utilisateur est déconnecté
        setUserRole('');
        setIsAdmin(false);
        setAccessEntries(false);
        setAccessExpenses(false);
        setAccessHistory(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      userRole, 
      isAdmin, 
      accessEntries, 
      accessExpenses,
      accessHistory 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}