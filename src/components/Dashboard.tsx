import { useState, useEffect, useCallback } from 'react';
import { Euro, TrendingUp, TrendingDown, Activity, AlertCircle } from 'lucide-react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { startOfDay, endOfDay } from 'date-fns';
import { usePCADebt } from './usePCADebt';

interface CashEntry {
  id: string;
  amount: number;
  date: string;
  description: string;
  userId: string;
  source?: string;
  projectId?: string;
  projectName?: string;
}

interface ExpenseItem {
  id: string;
  quantity: number;
  unitPrice: number;
  expenseId: string;
}

interface Expense {
  id: string;
  date: string;
  items: ExpenseItem[];
  userId: string;
  projectId?: string;
  projectName?: string;
}

export default function Dashboard() {
  const [currentBalance, setCurrentBalance] = useState(0);
  const [dailyInflow, setDailyInflow] = useState(0);
  const [dailyExpenses, setDailyExpenses] = useState(0);
  const [dailyTransactions, setDailyTransactions] = useState(0);
  const [recentInflows, setRecentInflows] = useState<CashEntry[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  
  // Utiliser le hook personnalisé pour calculer la dette PCA
  const { pcaDebt, loading: loadingPCADebt } = usePCADebt();

  const fetchDashboardData = useCallback(async () => {
    // Retirer la condition user pour permettre l'affichage des données même sans utilisateur connecté
    // Cela permet de voir les tableaux dans tous les cas

    const today = new Date();
    const startOfToday = startOfDay(today).toISOString();
    const endOfToday = endOfDay(today).toISOString();

    try {
      // Fetch all cash inflow - GLOBAL pour tous les utilisateurs
      const inflowRef = collection(db, 'cash_inflow');
      // Tous les utilisateurs voient toutes les entrées dans le tableau de bord
      const inflowQuery = query(inflowRef);
      
      const inflowSnapshot = await getDocs(inflowQuery);
      const inflowEntries = inflowSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as unknown as CashEntry[];
      
      // Calculate total inflow
      const totalInflow = inflowEntries.reduce((sum, entry) => sum + entry.amount, 0);
      
      // Calculate today's inflow
      const todayInflow = inflowEntries.filter(entry => {
        return entry.date >= startOfToday && entry.date <= endOfToday;
      });
      const todayInflowTotal = todayInflow.reduce((sum, entry) => sum + entry.amount, 0);
      
      // Récupérer les 5 dernières entrées (triées par date décroissante)
      const sortedInflows = [...inflowEntries].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }).slice(0, 5);
      
      // Récupérer les informations de projet pour les entrées
      const projectsRef = collection(db, 'projects');
      const projectsSnapshot = await getDocs(query(projectsRef));
      const projects = projectsSnapshot.docs.reduce((acc, doc) => {
        const projectData = doc.data();
        acc[doc.id] = { name: projectData.name || 'Projet sans nom' };
        return acc;
      }, {} as Record<string, { name: string }>);
      
      // Ajouter les noms de projet aux entrées
      sortedInflows.forEach(entry => {
        if (entry.projectId && projects[entry.projectId]) {
          entry.projectName = projects[entry.projectId].name;
        }
      });
      
      // Fetch all expenses - GLOBAL pour tous les utilisateurs
      const expensesRef = collection(db, 'expenses');
      // Tous les utilisateurs voient toutes les dépenses dans le tableau de bord
      const expensesQuery = query(expensesRef);
      
      const expensesSnapshot = await getDocs(expensesQuery);
      const expenses = expensesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        items: []
      })) as unknown as Expense[];
      
      // Fetch all expense items
      const itemsRef = collection(db, 'expense_items');
      const itemsQuery = query(itemsRef);
      const itemsSnapshot = await getDocs(itemsQuery);
      const allItems = itemsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as unknown as ExpenseItem[];
      
      // Associate items with their expenses
      expenses.forEach(expense => {
        expense.items = allItems.filter(item => item.expenseId === expense.id);
      });
      
      // Calculate total expenses
      const totalExpenses = expenses.reduce((sum, expense) => {
        const expenseTotal = expense.items.reduce((itemSum, item) => {
          return itemSum + (item.quantity * item.unitPrice);
        }, 0);
        return sum + expenseTotal;
      }, 0);
      
      // Calculate today's expenses
      const todayExpenses = expenses.filter(expense => {
        return expense.date >= startOfToday && expense.date <= endOfToday;
      });
      
      const todayExpensesTotal = todayExpenses.reduce((sum, expense) => {
        const expenseTotal = expense.items.reduce((itemSum, item) => {
          return itemSum + (item.quantity * item.unitPrice);
        }, 0);
        return sum + expenseTotal;
      }, 0);
      
      // Récupérer les 5 dernières dépenses (triées par date décroissante)
      const sortedExpenses = [...expenses].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }).slice(0, 5);
      
      // Ajouter les noms de projet aux dépenses
      sortedExpenses.forEach(expense => {
        if (expense.projectId && projects[expense.projectId]) {
          expense.projectName = projects[expense.projectId].name;
        }
      });
      
      // Calculate current balance
      const currentBalance = totalInflow - totalExpenses;
      
      // Calculate daily transactions count
      const dailyTransactionsCount = todayInflow.length + todayExpenses.length;
      
      // La dette PCA est maintenant calculée par le hook usePCADebt
      
      // Logs de débogage
      console.log('Entrées récentes récupérées:', sortedInflows);
      console.log('Dépenses récentes récupérées:', sortedExpenses);
      
      // Update state
      setCurrentBalance(currentBalance);
      setDailyInflow(todayInflowTotal);
      setDailyExpenses(todayExpensesTotal);
      setDailyTransactions(dailyTransactionsCount);
      // La dette PCA est gérée par le hook usePCADebt
      setRecentInflows(sortedInflows);
      setRecentExpenses(sortedExpenses);
    } catch (error) {
      console.error('Erreur lors de la récupération des données du tableau de bord:', error);
      // En cas d'erreur, définir des valeurs par défaut pour éviter les problèmes d'affichage
      setCurrentBalance(0);
      setDailyInflow(0);
      setDailyExpenses(0);
      setDailyTransactions(0);
      // La dette PCA est gérée par le hook usePCADebt
    }
  }, []);

  useEffect(() => {
    // Appeler fetchDashboardData sans condition d'utilisateur
    // pour s'assurer que les tableaux s'affichent toujours
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatPrice = (amount: number) => {
    return amount.toLocaleString('fr-FR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' FCFA';
  };

  const stats = [
    { name: 'Solde actuel', value: formatPrice(currentBalance), icon: Euro, color: 'bg-blue-500' },
    { name: 'Entrées du jour', value: formatPrice(dailyInflow), icon: TrendingUp, color: 'bg-green-500' },
    { name: 'Dépenses du jour', value: formatPrice(dailyExpenses), icon: TrendingDown, color: 'bg-red-500' },
    { name: 'Dette PCA', value: loadingPCADebt ? 'Chargement...' : formatPrice(pcaDebt), icon: AlertCircle, color: 'bg-orange-500' },
    { name: 'Transactions du jour', value: dailyTransactions.toString(), icon: Activity, color: 'bg-purple-500' }
  ];

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`${stat.color} rounded-full p-3`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                  <p className="text-lg font-semibold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Dernières entrées {recentInflows ? `(${recentInflows.length})` : '(0)'}</h3>
          <div className="space-y-4">
            {recentInflows && recentInflows.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projet</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentInflows.map((inflow) => (
                      <tr key={inflow.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {new Date(inflow.date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                          {inflow.description}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {inflow.source || '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {inflow.projectName || '-'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-green-600">
                          {formatPrice(inflow.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Aucune entrée récente</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Dernières dépenses {recentExpenses ? `(${recentExpenses.length})` : '(0)'}</h3>
          <div className="space-y-4">
            {recentExpenses && recentExpenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projet</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Montant</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Articles</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {recentExpenses.map((expense) => {
                      const totalAmount = expense.items.reduce(
                        (sum, item) => sum + item.quantity * item.unitPrice, 0
                      );
                      return (
                        <tr key={expense.id}>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            {new Date(expense.date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                            {expense.projectName || '-'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-red-600">
                            {formatPrice(totalAmount)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-500">
                            {expense.items.length}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">Aucune dépense récente</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}