import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
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
    // La persistance est déjà configurée dans firebase.ts

    // Observer les changements d'état d'authentification
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      console.log('Auth state changed:', currentUser ? 'user logged in' : 'user logged out');
      setUser(currentUser);
      
      if (currentUser) {
        // Stocker l'ID de l'utilisateur dans le localStorage pour vérifier la persistance
        localStorage.setItem('currentUserId', currentUser.uid);
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
        // Vérifier si nous avons un ID utilisateur dans le localStorage
        const storedUserId = localStorage.getItem('currentUserId');
        
        if (storedUserId) {
          console.log('Session perdue mais ID utilisateur trouvé dans localStorage, tentative de restauration...');
          // Ne pas effacer les données de rôle pour permettre la restauration de session
        } else {
          // Réinitialiser les états si l'utilisateur est déconnecté
          setUserRole('');
          setIsAdmin(false);
          localStorage.removeItem('userRole');
          localStorage.removeItem('isAdmin');
          localStorage.removeItem('accessEntries');
          localStorage.removeItem('accessExpenses');
          localStorage.removeItem('accessHistory');
          setAccessEntries(false);
          setAccessExpenses(false);
          setAccessHistory(false);
        }
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