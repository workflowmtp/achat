import  { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';

export function usePCADebt() {
  const [pcaDebt, setPcaDebt] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useAuth();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    if (user) {
      calculatePCADebt();
    }
  }, [user]);

  const calculatePCADebt = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // 1. Récupérer toutes les entrées au compte PCA
      const cashInflowRef = collection(db, 'cash_inflow');
      let inflowQuery;
      
      if (isAdmin) {
        inflowQuery = query(
          cashInflowRef,
          where('source', '==', 'pca')
        );
      } else {
        inflowQuery = query(
          cashInflowRef,
          where('userId', '==', user.uid),
          where('source', '==', 'pca')
        );
      }
      
      const inflowSnapshot = await getDocs(inflowQuery);
      const pcaEntries = inflowSnapshot.docs.map(doc => doc.data());
      
      // Calculer le total des entrées PCA
      const totalPCAEntries = pcaEntries.reduce((sum, entry) => sum + entry.amount, 0);
      
      // 2. Récupérer tous les remboursements PCA
      const reimburseRef = collection(db, 'pca_reimbursements');
      let reimburseQuery;
      
      if (isAdmin) {
        reimburseQuery = query(reimburseRef);
      } else {
        reimburseQuery = query(
          reimburseRef,
          where('userId', '==', user.uid)
        );
      }
      
      const reimburseSnapshot = await getDocs(reimburseQuery);
      const reimbursements = reimburseSnapshot.docs.map(doc => doc.data());
      
      // Calculer le total des remboursements
      const totalReimbursements = reimbursements.reduce((sum, entry) => sum + entry.amount, 0);
      
      // 3. Calculer la dette PCA actuelle
      const currentDebt = totalPCAEntries - totalReimbursements;
      setPcaDebt(currentDebt > 0 ? currentDebt : 0); // Ne pas permettre une dette négative
      
    } catch (error) {
      console.error('Erreur lors du calcul de la dette PCA:', error);
    } finally {
      setLoading(false);
    }
  };

  return { pcaDebt, loading, refreshPCADebt: calculatePCADebt };
}