import React, { useState, useEffect } from 'react';
import { Euro, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { startOfDay, endOfDay } from 'date-fns';

interface CashEntry {
  amount: number;
  date: string;
}

interface ExpenseItem {
  quantity: number;
  unitPrice: number;
}

interface Expense {
  id: string;
  date: string;
  items: ExpenseItem[];
}

export default function Dashboard() {
  const [currentBalance, setCurrentBalance] = useState(0);
  const [dailyInflow, setDailyInflow] = useState(0);
  const [dailyExpenses, setDailyExpenses] = useState(0);
  const [dailyTransactions, setDailyTransactions] = useState(0);
  const { user } = useAuth();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    if (!user) return;

    const today = new Date();
    const startOfToday = startOfDay(today).toISOString();
    const endOfToday = endOfDay(today).toISOString();

    try {
      // Fetch all cash inflow
      const inflowRef = collection(db, 'cash_inflow');
      let inflowQuery;
      
      if (isAdmin) {
        // Admin sees all inflow
        inflowQuery = query(inflowRef);
      } else {
        // Regular users only see their own inflow
        inflowQuery = query(inflowRef, where('userId', '==', user.uid));
      }
      
      const inflowSnapshot = await getDocs(inflowQuery);
      const inflowEntries = inflowSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as CashEntry[];
      
      // Calculate current balance (all time)
      const totalInflow = inflowEntries.reduce((sum, entry) => sum + entry.amount, 0);
      
      // Calculate daily inflow
      const todayInflow = inflowEntries.filter(entry => 
        entry.date >= startOfToday && entry.date <= endOfToday
      );
      const todayInflowTotal = todayInflow.reduce((sum, entry) => sum + entry.amount, 0);
      
      // Fetch all expenses
      const expensesRef = collection(db, 'expenses');
      let expensesQuery;
      
      if (isAdmin) {
        // Admin sees all expenses
        expensesQuery = query(expensesRef);
      } else {
        // Regular users only see their own expenses
        expensesQuery = query(expensesRef, where('userId', '==', user.uid));
      }
      
      const expensesSnapshot = await getDocs(expensesQuery);
      const expenses = expensesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        items: []
      })) as Expense[];
      
      // Fetch all expense items
      const itemsRef = collection(db, 'expense_items');
      const itemsSnapshot = await getDocs(itemsRef);
      const allItems = itemsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as ExpenseItem[];
      
      // Associate items with their expenses
      expenses.forEach(expense => {
        expense.items = allItems.filter(item => item.expenseId === expense.id);
      });
      
      // Calculate total expenses
      let totalExpenses = 0;
      for (const expense of expenses) {
        const items = expense.items || [];
        const expenseTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        totalExpenses += expenseTotal;
      }
      
      // Calculate daily expenses
      const todayExpenses = expenses.filter(expense => 
        expense.date >= startOfToday && expense.date <= endOfToday
      );
      let todayExpensesTotal = 0;
      for (const expense of todayExpenses) {
        const items = expense.items || [];
        const expenseTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        todayExpensesTotal += expenseTotal;
      }
      
      // Calculate current balance
      const currentBalance = totalInflow - totalExpenses;
      
      // Set state
      setCurrentBalance(currentBalance);
      setDailyInflow(todayInflowTotal);
      setDailyExpenses(todayExpensesTotal);
      setDailyTransactions(todayInflow.length + todayExpenses.length);
      
    } catch (error) {
      console.error('Erreur lors de la récupération des données du tableau de bord:', error);
      // En cas d'erreur, définir des valeurs par défaut pour éviter les problèmes d'affichage
      setCurrentBalance(0);
      setDailyInflow(0);
      setDailyExpenses(0);
      setDailyTransactions(0);
    }
  };

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
          <h3 className="text-lg font-medium text-gray-900 mb-4">Dernières entrées</h3>
          <div className="space-y-4">
            {/* Placeholder for recent inflows */}
            <p className="text-gray-500 text-sm">Aucune entrée récente</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Dernières dépenses</h3>
          <div className="space-y-4">
            {/* Placeholder for recent expenses */}
            <p className="text-gray-500 text-sm">Aucune dépense récente</p>
          </div>
        </div>
      </div>
    </div>
  );
}