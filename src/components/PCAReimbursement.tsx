import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Save, AlertCircle, Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, Loader } from 'lucide-react';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { logActivity, ActivityType, EntityType } from '../utils/activityLogger';
import { useAuth } from './auth/AuthContext';
import { usePCADebt } from './usePCADebt'; // Importer le hook pour la dette PCA

// Interfaces pour les données
interface Expense {
  id: string;
  date: string;
  description: string;
  projectId: string;
  userId: string;
  createdAt?: string;
  reference?: string;
}

interface ExpenseItem {
  id: string;
  expenseId: string;
  designation: string;
  reference: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  supplier: string;
  supplierId: string;
  amountGiven: number;
  beneficiary?: string;
  userId: string;
  createdAt?: string;
}

interface PCAReimbursementHistory extends Expense {
  totalAmount: number;
}

export default function PCAReimbursement() {
  // États pour le formulaire de remboursement
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // États pour l'historique des remboursements
  const [reimbursementHistory, setReimbursementHistory] = useState<PCAReimbursementHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  const { user } = useAuth();
  const { pcaDebt, loading, refreshPCADebt } = usePCADebt(); // Utiliser le hook

  // Fonction pour récupérer l'historique des remboursements PCA
  const fetchReimbursementHistory = useCallback(async () => {
    if (!user) return;
    
    try {
      setHistoryLoading(true);
      
      // Récupérer les dépenses avec description "Remboursement PCA"
      const expensesCollection = collection(db, 'expenses');
      const expensesSnapshot = await getDocs(expensesCollection);
      const allExpenses = expensesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
      
      // Filtrer pour ne garder que les remboursements PCA
      const pcaExpenses = allExpenses.filter(expense => 
        expense.description.toLowerCase().includes('remboursement pca') && 
        expense.projectId === 'pca_remboursement'
      );
      
      // Récupérer tous les articles de dépense
      const expenseItemsCollection = collection(db, 'expense_items');
      const expenseItemsSnapshot = await getDocs(expenseItemsCollection);
      const allExpenseItems = expenseItemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExpenseItem[];
      
      // Calculer le montant total pour chaque remboursement PCA
      const pcaReimbursementHistory: PCAReimbursementHistory[] = pcaExpenses.map(expense => {
        // Trouver tous les articles associés à cette dépense
        const expenseItems = allExpenseItems.filter(item => item.expenseId === expense.id);
        
        // Calculer le montant total
        const totalAmount = expenseItems.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
        
        return {
          ...expense,
          totalAmount,
          // Ajouter un champ référence formaté pour l'affichage
          reference: expense.id.substring(0, 8).toUpperCase()
        };
      });
      
      // Trier par date (plus récente d'abord par défaut)
      const sortedHistory = [...pcaReimbursementHistory].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
      
      setReimbursementHistory(sortedHistory);
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique des remboursements:', error);
    } finally {
      setHistoryLoading(false);
    }
  }, [user]);
  
  // Charger l'historique des remboursements au montage du composant
  useEffect(() => {
    fetchReimbursementHistory();
  }, [fetchReimbursementHistory]);
  
  // Filtrer et trier les remboursements en fonction des critères de recherche
  const filteredReimbursements = useMemo(() => {
    if (!reimbursementHistory.length) return [];
    
    // Filtrer selon le terme de recherche
    let filtered = reimbursementHistory;
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(item => 
        item.description.toLowerCase().includes(searchLower) ||
        item.date.toLowerCase().includes(searchLower) ||
        (item.reference?.toLowerCase().includes(searchLower) || false) ||
        item.totalAmount.toString().includes(searchLower)
      );
    }
    
    // Trier selon le champ et la direction de tri
    return [...filtered].sort((a, b) => {
      if (sortField === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      if (sortField === 'amount') {
        return sortDirection === 'asc' 
          ? a.totalAmount - b.totalAmount 
          : b.totalAmount - a.totalAmount;
      }
      
      // Par défaut, trier par description
      const valA = (a as unknown as Record<string, unknown>)[sortField]?.toString().toLowerCase() || '';
      const valB = (b as unknown as Record<string, unknown>)[sortField]?.toString().toLowerCase() || '';
      return sortDirection === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    });
  }, [reimbursementHistory, searchTerm, sortField, sortDirection]);
  
  // Gérer la pagination
  const totalPages = Math.ceil(filteredReimbursements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReimbursements = filteredReimbursements.slice(startIndex, startIndex + itemsPerPage);
  
  // Gérer le tri
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Inverser la direction si on clique sur le même champ
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Gérer la navigation des pages
  const goToPage = (page: number) => {
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    setCurrentPage(page);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!amount || parseFloat(amount) <= 0) {
      setError('Le montant du remboursement doit être supérieur à 0');
      return;
    }

    const reimbursementAmount = parseFloat(amount);

    if (reimbursementAmount > pcaDebt) {
      setError('Le montant du remboursement ne peut pas être supérieur à la dette');
      return;
    }

    try {
      // 1. Enregistrer le remboursement
      await addDoc(collection(db, 'pca_reimbursements'), {
        amount: reimbursementAmount,
        description,
        userId: user!.uid,
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: new Date().toISOString()
      });

      // 2. Créer une dépense pour le remboursement
      const expenseRef = await addDoc(collection(db, 'expenses'), {
        date: format(new Date(), 'yyyy-MM-dd'),
        description: `Remboursement PCA: ${description}`,
        projectId: 'pca_remboursement', // Créer un projet spécifique pour les remboursements PCA
        userId: user!.uid,
        createdAt: new Date().toISOString()
      });
      
      // 3. Créer l'élément de dépense
      await addDoc(collection(db, 'expense_items'), {
        expenseId: expenseRef.id,
        designation: "Remboursement PCA",
        reference: "PCA-RMB",
        quantity: 1,
        unit: "FCFA",
        unitPrice: reimbursementAmount,
        supplier: "PCA",
        supplierId: "pca_internal", // Identifiant interne pour PCA
        amountGiven: reimbursementAmount, // Montant remis (égal au montant total car payé intégralement)
        beneficiary: "PCA",
        userId: user!.uid,
        createdAt: new Date().toISOString()
      });

      // 4. Ajouter une notification
      await addDoc(collection(db, 'notifications'), {
        message: `Remboursement PCA effectué: ${formatPrice(reimbursementAmount)}`,
        type: 'pca_reimbursement',
        read: false,
        createdAt: new Date().toISOString(),
        userId: user ? user.uid : 'system' // Conserver l'utilisateur pour la traçabilité si disponible
      });

      // 5. Enregistrer l'activité dans l'historique
      if (user) {
        await logActivity(
          user.uid,
          user.displayName || user.email || 'Utilisateur',
          ActivityType.CREATE,
          EntityType.CASH_INFLOW, // Utiliser CASH_INFLOW car il n'y a pas de type spécifique pour les remboursements PCA
          'pca_reimbursement_' + new Date().getTime(),
          {
            amount: reimbursementAmount,
            description,
            date: format(new Date(), 'yyyy-MM-dd'),
            type: 'pca_reimbursement'
          },
          `Remboursement PCA: ${description}`,
          'pca_remboursement',
          'Remboursement PCA'
        );
      }

      // 6. Rafraîchir le calcul de la dette PCA
      refreshPCADebt();

      // Réinitialiser le formulaire
      setAmount('');
      setDescription('');
      setSuccess('Remboursement enregistré avec succès');
    } catch (error) {
      console.error('Erreur lors du remboursement:', error);
      setError('Erreur lors du remboursement');
    }
  };

  const formatPrice = (amount: number) => {
    return amount.toLocaleString('fr-FR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' FCFA';
  };

  return (
    <div className="space-y-8">
      {/* Formulaire de remboursement */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-6">Remboursement PCA</h2>

        <div className="mb-6 bg-yellow-50 p-4 rounded-lg">
          <p className="text-sm font-medium text-yellow-800">
            {loading ? 'Calcul de la dette PCA...' : `Dette PCA actuelle: ${formatPrice(pcaDebt)}`}
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-center bg-red-50 border-l-4 border-red-400 p-4 rounded-r" role="alert">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-r" role="alert">
            <span className="text-green-700">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Montant du remboursement (FCFA)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              placeholder="0"
              min="0"
              max={pcaDebt}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              placeholder="Description du remboursement"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > pcaDebt}
            className="inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4 mr-2" />
            Enregistrer le remboursement
          </button>
        </form>
      </div>
      
      {/* Tableau d'historique des remboursements */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-6">Historique des remboursements PCA</h2>
        
        {/* Barre de recherche */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400" />
          </div>
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un remboursement..." 
            className="pl-10 p-2.5 block w-full rounded-lg border border-gray-300 bg-gray-50 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        {/* Tableau des remboursements */}
        <div className="overflow-x-auto relative shadow-md sm:rounded-lg">
          {historyLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader className="animate-spin w-8 h-8 text-blue-500" />
              <span className="ml-2">Chargement de l'historique...</span>
            </div>
          ) : filteredReimbursements.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? 'Aucun résultat trouvé pour cette recherche.' : 'Aucun remboursement PCA trouvé.'}
            </div>
          ) : (
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="py-3 px-6 cursor-pointer" onClick={() => handleSort('reference')}>
                    <div className="flex items-center">
                      Référence
                      {sortField === 'reference' && (
                        sortDirection === 'asc' ? <ArrowUp className="ml-1 w-4 h-4" /> : <ArrowDown className="ml-1 w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="py-3 px-6 cursor-pointer" onClick={() => handleSort('date')}>
                    <div className="flex items-center">
                      Date
                      {sortField === 'date' && (
                        sortDirection === 'asc' ? <ArrowUp className="ml-1 w-4 h-4" /> : <ArrowDown className="ml-1 w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="py-3 px-6 cursor-pointer" onClick={() => handleSort('description')}>
                    <div className="flex items-center">
                      Description
                      {sortField === 'description' && (
                        sortDirection === 'asc' ? <ArrowUp className="ml-1 w-4 h-4" /> : <ArrowDown className="ml-1 w-4 h-4" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="py-3 px-6 cursor-pointer" onClick={() => handleSort('amount')}>
                    <div className="flex items-center">
                      Montant
                      {sortField === 'amount' && (
                        sortDirection === 'asc' ? <ArrowUp className="ml-1 w-4 h-4" /> : <ArrowDown className="ml-1 w-4 h-4" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedReimbursements.map(item => (
                  <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="py-4 px-6 font-medium text-gray-900">
                      {item.reference || item.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td className="py-4 px-6">
                      {item.date}
                    </td>
                    <td className="py-4 px-6">
                      {item.description}
                    </td>
                    <td className="py-4 px-6">
                      {formatPrice(item.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Affichage de <span className="font-semibold">{startIndex + 1}</span> à <span className="font-semibold">
                  {Math.min(startIndex + itemsPerPage, filteredReimbursements.length)}
                </span> sur <span className="font-semibold">{filteredReimbursements.length}</span> résultats
              </span>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Éléments par page:</span>
                <select 
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                >
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </select>
              </div>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={() => goToPage(currentPage - 1)} 
                disabled={currentPage === 1}
                className="px-3 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToPage(i + 1)}
                  className={`px-3 py-2 border rounded-md ${currentPage === i + 1 ? 'bg-blue-500 text-white' : ''}`}
                >
                  {i + 1}
                </button>
              )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
              <button 
                onClick={() => goToPage(currentPage + 1)} 
                disabled={currentPage === totalPages}
                className="px-3 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}