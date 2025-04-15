import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

interface CashInflow {
  date: string;
  amount: number;
  source: string;
  description: string;
  projectId: string;
  userId: string;
}

export const createCashInflow = async (data: Omit<CashInflow, 'userId'>, userId: string) => {
  try {
    const cashInflowRef = collection(db, 'cash_inflow');
    const docRef = await addDoc(cashInflowRef, {
      ...data,
      userId,
      createdAt: new Date().toISOString()
    });

    return {
      success: true,
      id: docRef.id,
      message: 'Entrée de caisse enregistrée avec succès'
    };
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'entrée:', error);
    throw new Error('Erreur lors de l\'enregistrement de l\'entrée');
  }
};

export const getCashInflowsByProject = async (projectId: string, userId: string, isAdmin: boolean) => {
  try {
    const cashInflowRef = collection(db, 'cash_inflow');
    let q;
    
    if (isAdmin) {
      // Admin sees all entries for the project
      q = query(
        cashInflowRef,
        where('projectId', '==', projectId)
      );
    } else {
      // Regular users only see their own entries
      q = query(
        cashInflowRef,
        where('projectId', '==', projectId),
        where('userId', '==', userId)
      );
    }
    
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des entrées:', error);
    throw new Error('Erreur lors de la récupération des entrées');
  }
};