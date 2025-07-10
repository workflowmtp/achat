import { useState, useEffect, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { format } from 'date-fns';
import { ArrowLeftCircle, PlusCircle, Eye, Trash2 } from 'lucide-react';

// Interface pour le projet
interface Project {
  id: string;
  name: string;
  description: string;
  startDate?: string;
  endDate?: string;
}

// Interface pour les entrées financières
interface CashInflow {
  id: string;
  amount: number;
  date: string;
  description: string;
  source: string;
  category: string;
  projectId: string;
}

// Interface pour les dépenses
interface Expense {
  id: string;
  date: string;
  reference: string;
  description: string;
  projectId: string;
  amount: number; // Ajout du montant pour la dépense
}

// Interface pour les éléments de dépense
// Cette interface est utilisée pour le calcul des sommes de dépenses
// et sera utilisée dans une future implémentation pour l'affichage détaillé des dépenses
// Elle est utilisée dans la fonction calculateExpenseSum ci-dessous
interface ExpenseItem {
  id: string;
  expenseId: string;
  articleId: string;
  quantity: number;
  unitPrice: number;
  total: number;
  description: string;
}

// Interface pour les statistiques financières
interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
}

export default function ProjectDetail() {
  // États pour stocker les données
  const [project, setProject] = useState<Project | null>(null);
  const [cashInflows, setCashInflows] = useState<CashInflow[]>([]);
  // expenses est utilisé dans fetchExpenses et sera utilisé dans une future implémentation
  // pour afficher les dépenses du projet
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary>({
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0
  });

  // États pour la gestion de l'UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Récupérer l'ID du projet depuis l'URL
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();

  // Débogage initial
  useEffect(() => {
    console.log('ProjectDetail - Montage du composant avec ID:', projectId);
    console.log('ProjectDetail - Chemin actuel:', window.location.pathname);
    console.log('ProjectDetail - User:', user ? 'Authentifié' : 'Non authentifié');
  }, [projectId, user]);

  // Fonction pour formater les montants en FCFA
  const formatAmount = (amount: number): string => {
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
  };

  // Fonction pour formater les dates
  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return format(date, 'dd/MM/yyyy');
    } catch (err) {
      console.error('Erreur de formatage de date:', err);
      return dateString || '-';
    }
  };

  // Récupérer les détails du projet
  const fetchProjectDetails = useCallback(async () => {
    setLoading(true);
    setError('');

    if (!projectId) {
      setError('ID du projet non spécifié');
      setLoading(false);
      return;
    }

    console.log('Récupération des détails du projet avec ID:', projectId);
    try {
      // Récupérer les détails du projet
      const projectDoc = doc(db, 'projects', projectId);
      const projectSnapshot = await getDoc(projectDoc);

      if (projectSnapshot.exists()) {
        const projectData = projectSnapshot.data() as Project;
        projectData.id = projectSnapshot.id;
        setProject(projectData);

        // Récupérer les entrées financières après avoir chargé le projet
        fetchCashInflows();
        fetchExpenses();
      } else {
        setError("Projet non trouvé");
        console.error("Projet non trouvé");
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des détails du projet:', error);
      setError('Erreur lors du chargement du projet. Veuillez réessayer plus tard.');
    } finally {
      setLoading(false);
    }
  }, [projectId, fetchCashInflows, fetchExpenses]);

  // Récupérer les entrées de caisse pour ce projet
  const fetchCashInflows = useCallback(async () => {
    if (!projectId) return;

    try {
      const q = query(
        collection(db, 'cash_inflows'),
        where('projectId', '==', projectId),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const inflows: CashInflow[] = [];
      let totalIncome = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const inflow = {
          id: doc.id,
          amount: data.amount || 0,
          date: data.date || '',
          description: data.description || '',
          source: data.source || '',
          category: data.category || '',
          projectId: data.projectId,
          reference: data.reference || ''
        };

        inflows.push(inflow);
        totalIncome += inflow.amount;
      });

      setCashInflows(inflows);

      // Mettre à jour le résumé financier
      setFinancialSummary(prevSummary => ({
        ...prevSummary,
        totalIncome,
        balance: totalIncome - prevSummary.totalExpenses
      }));
    } catch (err) {
      console.error('Erreur lors de la récupération des entrées de caisse:', err);
    }
  }, [projectId]);

  // Récupérer les dépenses pour ce projet
  const fetchExpenses = useCallback(async () => {
    if (!projectId) return;

    try {
      const q = query(
        collection(db, 'expenses'),
        where('projectId', '==', projectId),
        orderBy('date', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const expenseList: Expense[] = [];
      let totalExpenses = 0;

      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const expense = {
          id: doc.id,
          date: data.date || '',
          reference: data.reference || '',
          description: data.description || '',
          projectId: data.projectId,
          amount: 0 // Valeur initiale qui sera mise à jour
        };

        // Récupérer les éléments de dépense
        const itemsQuery = query(
          collection(db, 'expense_items'),
          where('expenseId', '==', doc.id)
        );

        const itemsSnapshot = await getDocs(itemsQuery);
        let expenseTotal = 0;

        itemsSnapshot.forEach((itemDoc) => {
          const itemData = itemDoc.data();
          expenseTotal += parseFloat(itemData.total) || 0;
        });

        totalExpenses += expenseTotal;
        expense.amount = expenseTotal;
        expenseList.push(expense);
      }

      setExpenses(expenseList);

      // Mettre à jour le résumé financier
      setFinancialSummary(prevSummary => ({
        ...prevSummary,
        totalExpenses,
        balance: prevSummary.totalIncome - totalExpenses
      }));
    } catch (err) {
      console.error('Erreur lors de la récupération des dépenses:', err);
    }
  }, [projectId]);

  // Charger les données au montage du composant
  useEffect(() => {
    fetchProjectDetails();
  }, [fetchProjectDetails]);

  // Filtrer les entrées de caisse en fonction du terme de recherche
  const filteredCashInflows = cashInflows.filter(inflow =>
    inflow.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inflow.source.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Utilisation de la variable expenses pour le débogage et suivi des données
  // Cette console.log sera supprimée en production
  useEffect(() => {
    if (expenses.length > 0 && projectId) {
      console.log(`${expenses.length} dépenses chargées pour le projet ${projectId}`);
    }
  }, [expenses, projectId]);

  // Si pas d'ID de projet, rediriger vers la liste des projets
  if (!projectId) {
    return <Navigate to="/projects" />;
  }

  // Fonctionnalité pour afficher les dépenses qui sera implémentée dans une future version
  // Pour l'instant, nous nous concentrons sur l'affichage des entrées financières
  /*
  const filteredExpenses = expenses.filter((expense) =>
    expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.reference.toLowerCase().includes(searchTerm.toLowerCase())
  );
  */

  // Fonction pour gérer le changement dans la recherche
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  // Fonction pour ajouter une nouvelle entrée
  const handleAddEntry = () => {
    alert('Fonctionnalité en cours de développement');
  };
  
  // Affichage du chargement
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-lg font-medium text-gray-600">Chargement des détails du projet...</p>
      </div>
    );
  }

  // Affichage des erreurs
  if (error) {
    return (
      <div className="bg-white shadow-md rounded-lg p-6 max-w-4xl mx-auto my-8">
        <div className="flex items-center mb-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center text-blue-600 hover:text-blue-800"
          >
            <ArrowLeftCircle className="mr-2" size={20} />
            Retour
          </button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erreur</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      {/* En-tête du projet */}
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center">
                <button 
                  onClick={() => window.history.back()}
                  className="flex items-center text-blue-600 hover:text-blue-800 mr-4"
                >
                  <ArrowLeftCircle size={20} />
                </button>
                <h1 className="text-2xl font-semibold text-gray-900">{project?.name || "Détails du projet"}</h1>
              </div>
              <p className="mt-1 text-sm text-gray-600">{project?.description}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Cartes de statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <h3 className="text-sm text-green-800 mb-1">Total des entrées (global)</h3>
            <p className="text-xl font-bold text-green-700">{formatAmount(financialSummary.totalIncome)}</p>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <h3 className="text-sm text-red-800 mb-1">Total des dépenses (global)</h3>
            <p className="text-xl font-bold text-red-700">{formatAmount(financialSummary.totalExpenses)}</p>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <h3 className="text-sm text-blue-800 mb-1">Solde en caisse (global)</h3>
            <p className="text-xl font-bold text-blue-700">{formatAmount(financialSummary.balance)}</p>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <h3 className="text-sm text-yellow-800 mb-1">Dette PCA (global)</h3>
            <p className="text-xl font-bold text-yellow-700">{formatAmount(0)}</p>
          </div>
        </div>
        
        {/* Bouton d'ajout et barre de recherche */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-5">
          <button 
            onClick={handleAddEntry}
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md flex items-center mb-3 sm:mb-0"
          >
            <PlusCircle className="mr-2" size={18} />
            Ajouter une entrée
          </button>
          
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Rechercher par description, projet, date..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        {/* Tableau des entrées */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Référence
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projet
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Montant
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCashInflows.length > 0 ? (
                filteredCashInflows.map((inflow) => (
                  <tr key={inflow.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(inflow.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inflow.reference || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {inflow.source || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {project?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {inflow.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {formatAmount(inflow.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end">
                        <button className="text-blue-600 hover:text-blue-900 mr-3">
                          <Eye size={16} />
                        </button>
                        <button className="text-red-600 hover:text-red-900">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    Aucune entrée trouvée pour ce projet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
