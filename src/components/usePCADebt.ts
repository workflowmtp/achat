import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export function usePCADebt() {
  const [pcaDebt, setPcaDebt] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  const calculatePCADebt = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Récupérer TOUTES les entrées au compte PCA (calcul global)
      const cashInflowRef = collection(db, 'cash_inflow');
      const inflowQuery = query(
        cashInflowRef,
        where('source', '==', 'pca')
      );
      
      const inflowSnapshot = await getDocs(inflowQuery);
      const pcaEntries = inflowSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          amount: data.amount || 0
        };
      });
      
      // Afficher les entrées PCA pour débogage
      console.log('Entrées PCA récupérées:', pcaEntries);
      
      // Calculer le total des entrées PCA (global pour tous les utilisateurs)
      const totalPCAEntries = pcaEntries.reduce((sum, entry) => sum + (entry.amount as number), 0);
      console.log('Total des entrées PCA:', totalPCAEntries);
      
      // 2. Récupérer TOUS les remboursements PCA (calcul global)
      const reimburseRef = collection(db, 'pca_reimbursements');
      const reimburseQuery = query(reimburseRef);
      
      const reimburseSnapshot = await getDocs(reimburseQuery);
      const reimbursements = reimburseSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          amount: data.amount || 0
        };
      });
      
      // Afficher les remboursements pour débogage
      console.log('Remboursements PCA récupérés:', reimbursements);
      
      // Calculer le total des remboursements
      const totalReimbursements = reimbursements.reduce((sum, entry) => sum + (entry.amount as number), 0);
      console.log('Total des remboursements PCA:', totalReimbursements);
      
      // 3. Calculer la dette PCA actuelle
      const currentDebt = totalPCAEntries - totalReimbursements;
      console.log('Calcul de la dette PCA:', `${totalPCAEntries} - ${totalReimbursements} = ${currentDebt}`);
      
      // Mettre à jour l'état avec la dette calculée
      setPcaDebt(currentDebt > 0 ? currentDebt : 0); // Ne pas permettre une dette négative
      console.log('Dette PCA finale affichée:', currentDebt > 0 ? currentDebt : 0);
      
    } catch (error) {
      console.error('Erreur lors du calcul de la dette PCA:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    calculatePCADebt();
  }, [calculatePCADebt]);

  return { pcaDebt, loading, refreshPCADebt: calculatePCADebt };
}