import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { collection, getDocs, query, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { usePCADebt } from './usePCADebt'; // Importer le hook pour la dette PCA

interface Project {
  id: string;
  name: string;
  description: string;
}

interface CashEntry {
  id: string;
  date: string;
  amount: number;
  source: string;
  description: string;
  projectId: string;
  userId: string;
}

interface ExpenseItem {
  quantity: number;
  unitPrice: number;
  expenseId: string;
}

interface Expense {
  id: string;
  items: ExpenseItem[];
  userId?: string; // Ajouter userId comme propriété optionnelle
}

export default function CashInflow() {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [globalTotalInflow, setGlobalTotalInflow] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const { user } = useAuth();
  const userRole = localStorage.getItem('userRole') || '';
  const isAdmin = localStorage.getItem('isAdmin') === 'true' || userRole === 'admin';
  const { pcaDebt, loading, refreshPCADebt } = usePCADebt(); // Utiliser le hook pour la dette PCA
  
  // Afficher un message dans la console pour le débogage
  useEffect(() => {
    console.log('CashInflow - isAdmin:', isAdmin);
    console.log('CashInflow - userRole:', userRole);
  }, [isAdmin, userRole]);

  const sources = [
    { id: 'rebus', label: 'Compte des rebus' },
    { id: 'bank', label: 'Compte bancaire' },
    { id: 'pca', label: 'Compte PCA' },
    { id: 'granule', label: 'Vente Granule' },
    { id: 'espece', label: 'Vente d\'espèce client' }
  ];

  // Définir fetchTotalExpenses avec useCallback - calcul global pour tous les utilisateurs
  const fetchTotalExpenses = React.useCallback(async () => {
    if (!user) return;
    
    try {
      const expensesRef = collection(db, 'expenses');
      const snapshot = await getDocs(expensesRef);
      const expenses = snapshot.docs
        .map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as Expense[];

      // Calcul global pour tous les utilisateurs - pas de filtrage par utilisateur
      let total = 0;

      for (const expense of expenses) {
        const itemsRef = collection(db, 'expense_items');
        const itemsQuery = query(itemsRef);
        const itemsSnapshot = await getDocs(itemsQuery);
        const items = itemsSnapshot.docs
          .map(doc => doc.data() as ExpenseItem)
          .filter(item => item.expenseId === expense.id);
        
        const expenseTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        total += expenseTotal;
      }

      setTotalExpenses(total);
    } catch (error) {
      console.error('Erreur lors du calcul des dépenses totales:', error);
    }
  }, [user]);

  // Définir fetchProjects avec useCallback
  const fetchProjects = React.useCallback(async () => {
    try {
      const projectsRef = collection(db, 'projects');
      const snapshot = await getDocs(projectsRef);
      const projectsList = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        description: doc.data().description || ''
      }));
      setProjects(projectsList);
    } catch (error) {
      console.error('Erreur lors de la récupération des projets:', error);
      // En cas d'erreur, définir une liste vide pour éviter les problèmes d'affichage
      setProjects([]);
    }
  }, []);

  // Définir fetchEntries avec useCallback
  const fetchEntries = React.useCallback(async () => {
    if (!user) return;
    
    try {
      const entriesRef = collection(db, 'cash_inflow');
      const snapshot = await getDocs(entriesRef);
      const entriesList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as CashEntry[];

      // Tous les utilisateurs voient toutes les entrées - pas de filtrage par utilisateur
      // Cela permet d'avoir une vue globale des entrées pour tous les utilisateurs
      setEntries(entriesList);
      
      // Calculer le total global des entrées (pour tous les utilisateurs)
      const globalTotal = entriesList.reduce((sum, entry) => sum + entry.amount, 0);
      setGlobalTotalInflow(globalTotal);
    } catch (error) {
      console.error('Erreur lors de la récupération des entrées:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchEntries();
      fetchProjects();
      fetchTotalExpenses();
    }
  }, [user, fetchEntries, fetchProjects, fetchTotalExpenses]);

  // La fonction fetchTotalExpenses a été déplacée avant le useEffect

  // La fonction fetchProjects a été déplacée avant le useEffect

  // La fonction fetchEntries a été déplacée avant le useEffect

  const createCashInflow = async (entry: {
    date: string;
    amount: number;
    source: string;
    description: string;
    projectId: string;
  }, userId: string) => {
    try {
      const cashInflowRef = collection(db, 'cash_inflow');
      const docRef = await addDoc(cashInflowRef, {
        ...entry,
        userId,
        createdAt: new Date().toISOString(),
      });
      
      // Si c'est une entrée PCA, rafraîchir la dette PCA
      if (entry.source === 'pca') {
        refreshPCADebt();
      }
      
      return { success: true, id: docRef.id };
    } catch (error) {
      console.error('Erreur lors de la création de l\'entrée:', error);
      setError('Erreur lors de la création de l\'entrée');
      return { success: false, id: null };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectId) return;

    try {
      const newEntry = {
        date,
        amount: parseFloat(amount),
        source,
        description,
        projectId
      };

      const result = await createCashInflow(newEntry, user.uid);
      
      if (result.success) {
        if (result.id) {
          setEntries([...entries, { ...newEntry, id: result.id, userId: user.uid }]);
        }
        setAmount('');
        setSource('');
        setDescription('');
        setProjectId('');
        setError('');
      }
    } catch (error) {
      console.error('Erreur lors de l\'ajout de l\'entrée:', error);
      setError('Erreur lors de l\'ajout de l\'entrée');
    }
  };

  const getProjectLabel = (project: Project) => {
    if (project.description) {
      return `${project.name} (${project.description})`;
    }
    return project.name;
  };

  const formatPrice = (amount: number | undefined) => {
    if (amount === undefined || amount === null) {
      return '0 FCFA';
    }
    return amount.toLocaleString('fr-FR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' FCFA';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Entrées de fonds</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-green-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-green-800">Total des entrées (global)</h3>
          <p className="mt-2 text-2xl font-semibold text-green-900">
            {formatPrice(globalTotalInflow)}
          </p>
          {isAdmin ? null : (
            <p className="mt-1 text-xs text-green-600">
              Vos entrées: {formatPrice(entries.reduce((sum, entry) => sum + entry.amount, 0))}
            </p>
          )}
        </div>
        <div className="bg-red-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-red-800">Total des dépenses (global)</h3>
          <p className="mt-2 text-2xl font-semibold text-red-900">
            {formatPrice(totalExpenses)}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-blue-800">Solde en caisse (global)</h3>
          <p className="mt-2 text-2xl font-semibold text-blue-900">
            {formatPrice(globalTotalInflow - totalExpenses)}
          </p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-yellow-800">Dette PCA (global)</h3>
          <p className="mt-2 text-2xl font-semibold text-yellow-900">
            {loading ? 'Calcul en cours...' : formatPrice(pcaDebt)}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-8 bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-bold mb-4">Nouvelle entrée</h3>
        
        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-r" role="alert">
            <span className="text-red-700">{error}</span>
          </div>
        )}
        
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Montant (FCFA)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
              placeholder="0"
              step="1"
              min="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
              required
            >
              <option value="">Sélectionner une source</option>
              {sources.map((src) => (
                <option key={src.id} value={src.id}>{src.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Projet</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
              required
            >
              <option value="">Sélectionner un projet</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {getProjectLabel(project)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
              placeholder="Description de l'entrée"
              required
            />
          </div>
        </div>
        <button
          type="submit"
          className="mt-4 inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter
        </button>
      </form>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {entries.map((entry) => {
              const project = projects.find(p => p.id === entry.projectId);
              return (
                <tr key={entry.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.date && !isNaN(new Date(entry.date).getTime()) 
                      ? format(new Date(entry.date), 'dd/MM/yyyy')
                      : 'Date invalide'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {sources.find(s => s.id === entry.source)?.label}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project ? getProjectLabel(project) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatPrice(entry.amount)}
                  </td>
                </tr>
              );
            })}
            {entries.length > 0 && (
              <tr className="bg-gray-50">
                <td colSpan={4} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Total
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  {formatPrice(entries.reduce((sum, entry) => sum + entry.amount, 0))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}