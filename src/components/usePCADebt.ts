import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';

export function usePCADebt() {
  const [pcaDebt, setPcaDebt] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useAuth();

  const calculatePCADebt = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // 1. Récupérer TOUTES les entrées au compte PCA (calcul global)
      const cashInflowRef = collection(db, 'cash_inflow');
      const inflowQuery = query(
        cashInflowRef,
        where('source', '==', 'pca')
      );
      
      const inflowSnapshot = await getDocs(inflowQuery);
      const pcaEntries = inflowSnapshot.docs.map(doc => doc.data());
      
      // Calculer le total des entrées PCA (global pour tous les utilisateurs)
      const totalPCAEntries = pcaEntries.reduce((sum, entry) => sum + entry.amount, 0);
      
      // 2. Récupérer TOUS les remboursements PCA (calcul global)
      const reimburseRef = collection(db, 'pca_reimbursements');
      const reimburseQuery = query(reimburseRef);
      
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
  }, [user]);

  useEffect(() => {
    if (user) {
      calculatePCADebt();
    }
  }, [user, calculatePCADebt]);

  return { pcaDebt, loading, refreshPCADebt: calculatePCADebt };
}