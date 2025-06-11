import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { CheckCircle } from 'lucide-react';
import { collection, addDoc, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';

const formatPrice = (amount: number) => {
  return amount.toLocaleString('fr-FR', { 
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }) + ' FCFA';
};

interface ClosingEntry {
  id: string;
  date: string;
  initialBalance: number;
  finalBalance: number;
  difference: number;
  notes: string;
  userId: string;
}

interface CashEntry {
  amount: number;
}

export default function Closing() {
  const [closings, setClosings] = useState<ClosingEntry[]>([]);
  const [initialBalance, setInitialBalance] = useState(0);
  const [finalBalance, setFinalBalance] = useState('');
  const [notes, setNotes] = useState('');
  const { user } = useAuth();

  // Récupérer le solde initial (qui est le solde final de la dernière clôture)
  const fetchInitialBalance = useCallback(async () => {
    try {
      // 1. Vérifier s'il existe des clôtures précédentes
      const closingsRef = collection(db, 'closings');
      const closingsQuery = query(closingsRef);
      const closingsSnapshot = await getDocs(closingsQuery);
      const allClosings = closingsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as ClosingEntry[];
      
      // Trier les clôtures par date (la plus récente en premier)
      const sortedClosings = allClosings.sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      // 2. S'il existe une clôture précédente, utiliser son solde final comme solde initial
      if (sortedClosings.length > 0) {
        const lastClosing = sortedClosings[0];
        console.log('Dernière clôture trouvée:', lastClosing);
        setInitialBalance(lastClosing.finalBalance);
        setFinalBalance(lastClosing.finalBalance.toString());
      } else {
        // 3. S'il n'y a pas de clôture précédente, calculer le solde à partir des entrées de caisse
        const inflowRef = collection(db, 'cash_inflow');
        const q = query(inflowRef);
        const snapshot = await getDocs(q);
        const entries = snapshot.docs.map(doc => doc.data() as CashEntry);
        
        // Calculer le total des entrées
        const totalInflow = entries.reduce((sum, entry) => sum + entry.amount, 0);
        
        console.log('Aucune clôture précédente, solde initial calculé:', totalInflow);
        setInitialBalance(totalInflow);
        setFinalBalance(totalInflow.toString());
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du solde initial:', error);
    }
  }, []);

  const fetchClosings = useCallback(async () => {
    try {
      const closingsRef = collection(db, 'closings');
      const q = query(closingsRef); // Récupérer toutes les clôtures sans filtrer par utilisateur
      const snapshot = await getDocs(q);
      const closingsList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as ClosingEntry[];
      setClosings(closingsList);
    } catch (error) {
      console.error('Erreur lors de la récupération des clôtures:', error);
    }
  }, []);
  
  // Utilisation de useEffect avec les fonctions useCallback comme dépendances
  useEffect(() => {
    if (user) {
      fetchClosings();
      fetchInitialBalance();
    }
  }, [user, fetchClosings, fetchInitialBalance]);

  // Calculer la différence entre le solde final et le solde initial
  const calculateDifference = () => {
    const final = parseFloat(finalBalance) || 0;
    return final - initialBalance;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation du solde final
    if (!finalBalance || isNaN(parseFloat(finalBalance))) {
      alert('Veuillez entrer un solde final valide');
      return;
    }

    try {
      const finalBalanceNum = parseFloat(finalBalance);
      const difference = calculateDifference();
      
      const newClosing: Omit<ClosingEntry, 'id'> = {
        date: format(new Date(), 'yyyy-MM-dd'),
        initialBalance: initialBalance,
        finalBalance: finalBalanceNum,
        difference: difference,
        notes,
        userId: user.uid
      };
      
      const docRef = await addDoc(collection(db, 'closings'), newClosing);
      
      // Ajouter la nouvelle clôture à la liste et trier par date (la plus récente en premier)
      const updatedClosings = [...closings, { ...newClosing, id: docRef.id }]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setClosings(updatedClosings);
      
      // Reset form
      setNotes('');
      
      // Le solde initial de la prochaine clôture sera le solde final de celle-ci
      setInitialBalance(finalBalanceNum);
      setFinalBalance(finalBalanceNum.toString());
      
      alert('Clôture enregistrée avec succès!');
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la clôture:', error);
      alert('Erreur lors de l\'enregistrement de la clôture');
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Clôture de caisse</h2>
      
      <form onSubmit={handleSubmit} className="mb-8 bg-white p-6 rounded-lg shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Solde initial</label>
            <input
              type="text"
              value={formatPrice(initialBalance)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-gray-100"
              disabled
            />
            <p className="text-xs text-gray-500 mt-1">Solde final de la dernière clôture</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Solde final (actuel)</label>
            <input
              type="number"
              value={finalBalance}
              onChange={(e) => setFinalBalance(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
              placeholder="Entrez le solde actuel de la caisse"
              required
            />
            <p className="text-xs text-gray-500 mt-1">Solde actuel de la caisse</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
              placeholder="Notes de clôture"
            />
          </div>
        </div>
        
        {/* Indicateur de différence */}
        <div className="mt-4 p-3 rounded-md" style={{ backgroundColor: calculateDifference() >= 0 ? '#f0fdf4' : '#fef2f2' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Différence:</span>
            <span className={`font-bold ${calculateDifference() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {calculateDifference() >= 0 ? '+' : ''}{formatPrice(calculateDifference())}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: calculateDifference() >= 0 ? '#166534' : '#991b1b' }}>
            {calculateDifference() > 0 ? 'Excédent de caisse' : 
             calculateDifference() < 0 ? 'Déficit de caisse' : 'Caisse équilibrée'}
          </p>
        </div>
        <button
          type="submit"
          className="mt-4 inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Clôturer
        </button>
      </form>

      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Historique des clôtures</h3>
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Solde initial</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Solde final</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Différence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {closings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Aucune clôture enregistrée</td>
                </tr>
              ) : (
                closings.map((closing) => (
                  <tr key={closing.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{closing.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatPrice(closing.initialBalance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatPrice(closing.finalBalance)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                      <div className="flex items-center justify-end">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          closing.difference > 0 ? 'bg-green-100 text-green-800' : 
                          closing.difference < 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {closing.difference > 0 ? '+' : ''}{formatPrice(closing.difference)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{closing.notes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}