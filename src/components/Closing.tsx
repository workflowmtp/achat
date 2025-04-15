import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { CheckCircle } from 'lucide-react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
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

  useEffect(() => {
    if (user) {
      fetchClosings();
      fetchInitialBalance();
    }
  }, [user]);

  const fetchInitialBalance = async () => {
    try {
      // Fetch all cash inflow entries
      const inflowRef = collection(db, 'cash_inflow');
      const q = query(inflowRef, where('userId', '==', user?.uid));
      const snapshot = await getDocs(q);
      const entries = snapshot.docs.map(doc => doc.data() as CashEntry);
      
      // Calculate total inflow
      const totalInflow = entries.reduce((sum, entry) => sum + entry.amount, 0);
      
      setInitialBalance(totalInflow);
      setFinalBalance(totalInflow.toString()); // Set final balance equal to initial balance
    } catch (error) {
      console.error('Erreur lors de la récupération du solde initial:', error);
    }
  };

  const fetchClosings = async () => {
    try {
      const closingsRef = collection(db, 'closings');
      const q = query(closingsRef, where('userId', '==', user?.uid));
      const snapshot = await getDocs(q);
      const closingsList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as ClosingEntry[];
      setClosings(closingsList);
    } catch (error) {
      console.error('Erreur lors de la récupération des clôtures:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const newClosing: Omit<ClosingEntry, 'id'> = {
        date: format(new Date(), 'yyyy-MM-dd'),
        initialBalance: initialBalance,
        finalBalance: parseFloat(finalBalance),
        difference: parseFloat(finalBalance) - initialBalance,
        notes,
        userId: user.uid
      };
      
      const docRef = await addDoc(collection(db, 'closings'), newClosing);
      setClosings([...closings, { ...newClosing, id: docRef.id }]);
      
      // Reset form but keep the initial balance
      setNotes('');
      await fetchInitialBalance(); // Refresh the initial balance
    } catch (error) {
      console.error('Erreur lors de l\'ajout de la clôture:', error);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Clôture de caisse</h2>
      
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Solde initial</label>
            <input
              type="text"
              value={formatPrice(initialBalance)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-gray-100"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Solde final</label>
            <input
              type="text"
              value={finalBalance}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-gray-100"
              disabled
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
              placeholder="Notes de clôture"
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Clôturer
        </button>
      </form>

      <div className="overflow-x-auto">
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
            {closings.map((closing) => (
              <tr key={closing.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{closing.date}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatPrice(closing.initialBalance)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                  {formatPrice(closing.finalBalance)}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                  closing.difference >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatPrice(closing.difference)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{closing.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}