import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
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
      console.log('Début du calcul de la dette PCA');
      
      // 1. Récupérer toutes les entrées au compte PCA
      const cashInflowRef = collection(db, 'cash_inflow');
      
      // Pour la dette PCA, on récupère toutes les entrées PCA, peu importe l'utilisateur
      const inflowQuery = query(
        cashInflowRef,
        where('source', '==', 'pca')
      );
      
      const inflowSnapshot = await getDocs(inflowQuery);
      const pcaEntries = inflowSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount || '0'),
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date)
        };
      });
      
      // Calculer le total des entrées PCA
      const totalPCAEntries = pcaEntries.reduce((sum, entry) => sum + entry.amount, 0);
      console.log('Total des entrées PCA:', totalPCAEntries);
      
      // 2. Récupérer toutes les dépenses validées liées au PCA
      const expensesRef = collection(db, 'expenses');
      const expensesQuery = query(
        expensesRef,
        where('status', '==', 'validated'),
        where('pcaRelated', '==', true)
      );
      
      const expensesSnapshot = await getDocs(expensesQuery);
      const validatedExpenses = [];
      
      // Pour chaque dépense validée, récupérer les items associés
      for (const expenseDoc of expensesSnapshot.docs) {
        const expenseData = expenseDoc.data();
        const expenseId = expenseDoc.id;
        
        // Récupérer les items de la dépense
        const itemsRef = collection(db, 'expense_items');
        const itemsQuery = query(itemsRef, where('expenseId', '==', expenseId));
        const itemsSnapshot = await getDocs(itemsQuery);
        
        const items = itemsSnapshot.docs.map(itemDoc => {
          const itemData = itemDoc.data();
          return {
            id: itemDoc.id,
            ...itemData,
            quantity: typeof itemData.quantity === 'number' ? itemData.quantity : parseFloat(itemData.quantity || '1'),
            unitPrice: typeof itemData.unitPrice === 'number' ? itemData.unitPrice : parseFloat(itemData.unitPrice || '0')
          };
        });
        
        // Calculer le montant total de la dépense
        const totalAmount = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        
        validatedExpenses.push({
          id: expenseId,
          ...expenseData,
          totalAmount,
          date: expenseData.date instanceof Timestamp ? expenseData.date.toDate() : new Date(expenseData.date)
        });
      }
      
      // Calculer le total des dépenses validées liées au PCA
      const totalValidatedPCAExpenses = validatedExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
      console.log('Total des dépenses validées PCA:', totalValidatedPCAExpenses);
      
      // 3. Récupérer tous les remboursements PCA
      const reimburseRef = collection(db, 'pca_reimbursements');
      const reimburseQuery = query(reimburseRef);
      
      const reimburseSnapshot = await getDocs(reimburseQuery);
      const reimbursements = reimburseSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount || '0'),
          date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date)
        };
      });
      
      // Calculer le total des remboursements
      const totalReimbursements = reimbursements.reduce((sum, entry) => sum + entry.amount, 0);
      console.log('Total des remboursements PCA:', totalReimbursements);
      
      // 4. Calculer la dette PCA actuelle
      // Dette PCA = Entrées PCA - Dépenses validées PCA - Remboursements PCA
      const currentDebt = totalPCAEntries - totalValidatedPCAExpenses - totalReimbursements;
      console.log('Dette PCA calculée:', currentDebt);
      
      // Ne pas permettre une dette négative
      const finalDebt = currentDebt > 0 ? currentDebt : 0;
      console.log('Dette PCA finale affichée:', finalDebt);
      
      setPcaDebt(finalDebt);
      
    } catch (error) {
      console.error('Erreur lors du calcul de la dette PCA:', error);
    } finally {
      setLoading(false);
    }
  }, [user]); // isAdmin n'est plus utilisé comme dépendance car nous récupérons toutes les entrées PCA

  useEffect(() => {
    if (user) {
      calculatePCADebt();
    }
  }, [user, calculatePCADebt]);

  return { pcaDebt, loading, refreshPCADebt: calculatePCADebt };
}