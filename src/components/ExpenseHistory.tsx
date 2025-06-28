import { collection, getDocs, query, updateDoc, doc, where, getDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import { useAuth } from '../components/auth/AuthContext';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Check, Download, FileDown, Info, Search, X, Save } from 'lucide-react';

// Extension de jsPDF pour autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// Fonctions utilitaires
const formatDate = (date: string | Date | undefined) => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'dd/MM/yyyy', { locale: fr });
};

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(price) + ' FCFA';
};

const formatExpenseId = (id: string | undefined): string => {
  if (!id) return '-';
  return id.substring(0, 6).toUpperCase();
};

const calculateTotal = (items: ExpenseItem[]) => {
  if (!items || !Array.isArray(items)) return 0;
  return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice || 0), 0);
};

interface Project {
  id: string;
  name: string;
  description: string;
}

interface ExpenseItem {
  id: string;
  articleId: string;
  designation: string;
  reference: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  supplier: string;
  supplierId?: string;
  amountGiven: number;
  beneficiary?: string;
  expenseId: string;
}

interface Expense {
  id: string;
  date: string;
  description: string;
  projectId: string;
  items: ExpenseItem[];
  userId: string;
  createdAt?: string;
  reference?: string;
  status?: string;
}

function ExpenseHistory() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<Record<string, string>>({});
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');

  // Fonction pour exporter les dépenses en CSV
  const exportToCSV = async () => {
    try {
      const headers = ['Date', 'Référence', 'Description', 'Projet', 'Utilisateur', 'Articles', 'Total'];
      
      const csvData = expenses.map(expense => {
        const projectName = projects.find(p => p.id === expense.projectId)?.name || 'Non spécifié';
        const userName = userNames[expense.userId] || 'Utilisateur inconnu';
        const itemsText = expense.items.map(item => 
          `${item.designation} (${item.quantity} ${item.unit} à ${item.unitPrice} FCFA)`
        ).join('; ');
        const total = calculateTotal(expense.items);
        
        return [
          formatDate(expense.date),
          expense.reference || formatExpenseId(expense.id),
          expense.description || '-',
          projectName,
          userName,
          itemsText,
          total
        ];
      });
      
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          row.map(cell => 
            typeof cell === 'string' && (cell.includes(',') || cell.includes('"')) 
              ? `"${cell.replace(/"/g, '""')}"` 
              : cell
          ).join(',')
        )
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `depenses_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('Exportation CSV réussie !');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      setError('Erreur lors de l\'exportation des données');
      setTimeout(() => setError(null), 3000);
    }
  };

  // Fonction pour récupérer le nom d'un utilisateur depuis Firebase
  const fetchUserName = useCallback(async (userId: string) => {
    try {
      if (userNames[userId]) {
        return;
      }

      const userDoc = doc(db, 'users', userId);
      const userSnapshot = await getDoc(userDoc);
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        const name = userData.displayName || userData.name || userData.email || userId;
        
        setUserNames(prev => ({
          ...prev,
          [userId]: name
        }));
      } else {
        let name = userId;
        if (userId.includes('@')) {
          const username = userId.split('@')[0];
          name = username
            .split('.')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
        }
        
        setUserNames(prev => ({
          ...prev,
          [userId]: name
        }));
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du nom d\'utilisateur:', error);
      setUserNames(prev => ({
        ...prev,
        [userId]: userId
      }));
    }
  }, [userNames]);

  // Fonction pour récupérer les dépenses
  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    
    try {
      setError('');
      const expensesRef = collection(db, 'expenses');
      const snapshot = await getDocs(expensesRef);
      
      const expensesPromises = snapshot.docs.map(async (doc) => {
        const expenseData = doc.data();
        const itemsRef = collection(db, 'expense_items');
        const itemsQuery = query(itemsRef, where('expenseId', '==', doc.id));
        const itemsSnapshot = await getDocs(itemsQuery);
        
        const items = itemsSnapshot.docs.map(itemDoc => ({
          id: itemDoc.id,
          ...itemDoc.data(),
          amountGiven: itemDoc.data().amountGiven || 0
        })) as ExpenseItem[];
        
        return {
          id: doc.id,
          ...expenseData,
          items,
          date: expenseData.date || new Date().toISOString(),
          status: expenseData.status || 'pending'
        } as Expense;
      });
      
      const expensesWithItems = await Promise.all(expensesPromises);
      setExpenses(expensesWithItems);
      
      // Initialiser editingItems avec les montants actuels
      const initialEditingItems: Record<string, string> = {};
      expensesWithItems.forEach(expense => {
        expense.items.forEach(item => {
          initialEditingItems[item.id] = item.amountGiven.toString();
        });
      });
      setEditingItems(initialEditingItems);
    } catch (error) {
      console.error('Erreur lors de la récupération des dépenses:', error);
      setError('Erreur lors de la récupération des dépenses');
    }
  }, [user]);

  // Fonction pour récupérer les projets
  const fetchProjects = useCallback(async () => {
    try {
      const projectsRef = collection(db, 'projects');
      const snapshot = await getDocs(projectsRef);
      const projectsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsList);
    } catch (error) {
      console.error('Erreur lors de la récupération des projets:', error);
      setError('Erreur lors de la récupération des projets');
    }
  }, []);

  // Fonction pour récupérer les utilisateurs
  const fetchUsers = useCallback(async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || doc.data().displayName || doc.data().email || doc.id,
        email: doc.data().email
      }));
      const usersMap = usersList.reduce((acc, user) => ({ ...acc, [user.id]: user.name }), {} as Record<string, string>);
      setUserNames(usersMap);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      setUserNames({});
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchExpenses();
      fetchProjects();
      fetchUsers();
    }
  }, [user, fetchExpenses, fetchProjects, fetchUsers]);

  useEffect(() => {
    if (expenses.length > 0) {
      const userIds = [...new Set(expenses.map(expense => expense.userId))].filter(Boolean);
      
      userIds.forEach(userId => {
        if (userId && !userNames[userId]) {
          fetchUserName(userId);
        }
      });
    }
  }, [expenses, userNames, fetchUserName]);

  const getUserName = (userId: string | undefined) => {
    if (!userId) return '-';
    return userNames[userId] || userId.substring(0, 8);
  };

  const getStatusLabel = (expense: Expense) => {
    if (!expense.status || expense.status === 'pending') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          En attente
        </span>
      );
    } else if (expense.status === 'danger') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Dette
        </span>
      );
    } else if (expense.status === 'validated') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Validé
        </span>
      );
    }
    return null;
  };

  const handleValidateExpense = async (expense: Expense) => {
    try {
      setError('');
      setSuccess('');
      
      const expenseRef = doc(db, 'expenses', expense.id);
      await updateDoc(expenseRef, {
        status: 'validated'
      });
      
      setExpenses(prevExpenses => 
        prevExpenses.map(exp => 
          exp.id === expense.id ? { ...exp, status: 'validated' } : exp
        )
      );
      
      setSuccess(`La dépense ${expense.reference || formatExpenseId(expense.id)} a été validée avec succès.`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erreur lors de la validation de la dépense:', error);
      setError('Erreur lors de la validation de la dépense');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleShowDetails = (expense: Expense) => {
    setSelectedExpense(expense);
    setShowModal(true);
  };

  const generateExpensesReportPDF = () => {
    const doc = new jsPDF();
    const filteredExpenses = getFilteredExpenses();
    
    doc.setFontSize(18);
    doc.text('Rapport des dépenses', 14, 22);
    doc.setFontSize(11);
    doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, 14, 30);
    
    const tableColumn = ['Référence', 'Date', 'Description', 'Projet', 'Utilisateur', 'Total', 'Statut'];
    const tableRows: string[][] = [];
    
    filteredExpenses.forEach((expense: Expense) => {
      const projectName = projects.find((p: Project) => p.id === expense.projectId)?.name || '-';
      const userName = getUserName(expense.userId);
      const total = calculateTotal(expense.items);
      const statusText = expense.status === 'validated' ? 'Validé' : 
                        expense.status === 'danger' ? 'Dette' : 'En attente';
      
      tableRows.push([
        expense.reference || formatExpenseId(expense.id),
        formatDate(expense.date),
        expense.description || '-',
        projectName,
        userName,
        formatPrice(total),
        statusText
      ]);
    });
    
    doc.autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });
    
    const currentY = doc.lastAutoTable.finalY || 150;
    const totalAmount = filteredExpenses.reduce((sum: number, expense: Expense) => sum + calculateTotal(expense.items), 0);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Total général: ${formatPrice(totalAmount)}`,
      14,
      currentY + 10
    );

    doc.save('rapport-depenses.pdf');
  };
  
  const handleExportPDF = () => {
    try {
      generateExpensesReportPDF();
      setSuccess('Le rapport des dépenses a été généré avec succès.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setError(`Erreur lors de la génération du PDF: ${errorMessage}`);
      setTimeout(() => setError(null), 3000);
    }
  };
  
  const handleAmountChange = (itemId: string, value: string) => {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: value
    }));
  };
  
  const handleUpdateAmount = async (item: ExpenseItem) => {
    const newAmount = parseFloat(editingItems[item.id] || '0');
    if (isNaN(newAmount) || newAmount < 0) {
      setError("Le montant doit être un nombre positif");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setSavingItemId(item.id);
    
    try {
      const itemRef = doc(db, 'expense_items', item.id);
      await updateDoc(itemRef, { amountGiven: newAmount });
      
      setExpenses(prevExpenses => {
        return prevExpenses.map(exp => {
          if (exp.id === item.expenseId) {
            return {
              ...exp,
              items: exp.items.map(i => i.id === item.id ? { ...i, amountGiven: newAmount } : i)
            };
          }
          return exp;
        });
      });
      
      setSuccess("Montant mis à jour avec succès");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      setError(`Erreur lors de la mise à jour: ${errorMessage}`);
      setTimeout(() => setError(null), 3000);
    } finally {
      setSavingItemId(null);
    }
  };

  const getProjectLabel = (project: Project) => {
    if (!project) return '-';
    return project.name || project.id.substring(0, 8);
  };

  const sortExpensesByDate = (expenses: Expense[], order: 'asc' | 'desc') => {
    return [...expenses].sort((a: Expense, b: Expense) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return order === 'desc' ? dateB - dateA : dateA - dateB;
    });
  };

  const getFilteredExpenses = () => {
    let filteredByProject = expenses;
    
    if (searchTerm && searchTerm.trim() !== '') {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filteredByProject = filteredByProject.filter((expense: Expense) => {
        const project = projects.find((p: Project) => p.id === expense.projectId);
        const matchesDescription = expense.description?.toLowerCase().includes(lowerSearchTerm);
        const matchesReference = expense.reference?.toLowerCase().includes(lowerSearchTerm);
        const matchesProject = project && getProjectLabel(project).toLowerCase().includes(lowerSearchTerm);
        const matchesId = expense.id.toLowerCase().includes(lowerSearchTerm);
        const matchesUser = getUserName(expense.userId).toLowerCase().includes(lowerSearchTerm);
        const matchesItems = expense.items.some(item => 
          item.designation?.toLowerCase().includes(lowerSearchTerm) || 
          item.supplier?.toLowerCase().includes(lowerSearchTerm) ||
          item.beneficiary?.toLowerCase().includes(lowerSearchTerm)
        );
        
        return matchesDescription || matchesReference || matchesProject || matchesId || matchesUser || matchesItems;
      });
    }
    
    if (selectedProject) {
      filteredByProject = filteredByProject.filter((expense: Expense) => expense.projectId === selectedProject);
    }
    
    return sortExpensesByDate(filteredByProject, sortOrder);
  };

  const filteredExpenses = getFilteredExpenses();
  
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  
  const renderPagination = () => {
    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
    const pageNumbers = [];
    
    let startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }
    
    return (
      <div className="flex justify-center mt-4">
        <nav className="inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
          <button
            onClick={() => paginate(1)}
            disabled={currentPage === 1}
            className={`relative inline-flex items-center px-2 py-2 rounded-l-md border ${currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-500 hover:bg-gray-50'} text-sm font-medium`}
          >
            «
          </button>
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className={`relative inline-flex items-center px-2 py-2 border ${currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-500 hover:bg-gray-50'} text-sm font-medium`}
          >
            ‹
          </button>
          {pageNumbers.map((number: number) => (
            <button
              key={number}
              onClick={() => paginate(number)}
              className={`relative inline-flex items-center px-4 py-2 border ${currentPage === number ? 'bg-blue-50 text-blue-600 border-blue-500' : 'bg-white text-gray-700 hover:bg-gray-50'} text-sm font-medium`}
            >
              {number}
            </button>
          ))}
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`relative inline-flex items-center px-2 py-2 border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-500 hover:bg-gray-50'} text-sm font-medium`}
          >
            ›
          </button>
          <button
            onClick={() => paginate(totalPages)}
            disabled={currentPage === totalPages}
            className={`relative inline-flex items-center px-2 py-2 rounded-r-md border ${
              currentPage === totalPages
                ? 'bg-gray-100 text-gray-400'
                : 'bg-white text-gray-500 hover:bg-gray-50'
            } text-sm font-medium`}
          >
            »
          </button>
        </nav>
      </div>
    );
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentExpenses = filteredExpenses.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold">Historique des dépenses</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            <Download className="w-4 h-4" />
            Exporter en CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Exporter en PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-r" role="alert">
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-4 rounded-r" role="alert">
          <span className="text-green-700">{success}</span>
        </div>
      )}

      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="col-span-1 md:col-span-2">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par référence, description, désignation, fournisseur, bénéficiaire ou utilisateur..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Tous les projets</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="flex items-center mb-4 sm:mb-0">
            <label className="mr-2 text-sm text-gray-600">Trier par date:</label>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {sortOrder === 'desc' ? 'Plus récent d\'abord' : 'Plus ancien d\'abord'}
              <span className="ml-1">{sortOrder === 'desc' ? '↓' : '↑'}</span>
            </button>
          </div>
          
          <div className="flex items-center">
            <label className="mr-2 text-sm text-gray-600">Afficher:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                const newItemsPerPage = Number(e.target.value);
                setItemsPerPage(newItemsPerPage);
                setCurrentPage(1);
              }}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value="5">5</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <span className="ml-2 text-sm text-gray-600">par page</span>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-blue-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}>
                  Date {sortOrder === 'desc' ? '↓' : '↑'}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Référence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projet</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {currentExpenses.map((expense: Expense) => {
                const totalRemainingDebt = expense.items.reduce((sum, item) => {
                  const total = item.quantity * item.unitPrice;
                  return sum + (item.amountGiven - total);
                }, 0);
                const project = projects.find((p: Project) => p.id === expense.projectId);
                return (
                  <tr 
                    key={expense.id} 
                    className={`hover:bg-gray-50 ${expense.status === 'validated' ? 'bg-green-50' : totalRemainingDebt < 0 ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{expense.description || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      {expense.reference || formatExpenseId(expense.id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {project ? getProjectLabel(project) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                      {formatPrice(calculateTotal(expense.items))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      {getStatusLabel(expense)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleShowDetails(expense)}
                          className="inline-flex items-center justify-center p-2 rounded-full text-blue-600 bg-blue-100 hover:bg-blue-200"
                          title="Voir les détails"
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        {expense.status !== 'validated' && (
                          <button
                            onClick={() => handleValidateExpense(expense)}
                            className="inline-flex items-center justify-center p-2 rounded-full text-green-600 bg-green-100 hover:bg-green-200"
                            title="Valider la dépense"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    {searchTerm ? 'Aucune dépense ne correspond à votre recherche' : 'Aucune dépense n\'a été enregistrée'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-gray-700 mb-4 sm:mb-0">
              Affichage de <span className="font-medium">{filteredExpenses.length > 0 ? indexOfFirstItem + 1 : 0}</span> à{' '}
              <span className="font-medium">{Math.min(indexOfLastItem, filteredExpenses.length)}</span> sur{' '}
              <span className="font-medium">{filteredExpenses.length}</span> résultats
            </p>
            
            {filteredExpenses.length > itemsPerPage && renderPagination()}
          </div>
        </div>
      </div>

      {showModal && selectedExpense && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Détails de la dépense du {formatDate(selectedExpense.date)} - Réf: {selectedExpense.reference || formatExpenseId(selectedExpense.id)}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {error && (
                <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-r" role="alert">
                  <span className="text-red-700">{error}</span>
                </div>
              )}

              {success && (
                <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-4 rounded-r" role="alert">
                  <span className="text-green-700">{success}</span>
                </div>
              )}

              <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Projet</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {projects.find(p => p.id === selectedExpense.projectId)?.name || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Description</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedExpense.description || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Utilisateur</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {getUserName(selectedExpense.userId)}
                  </p>
                </div>
              </div>

              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Article</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Prix unitaire</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant remis</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Solde</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bénéficiaire</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedExpense.items.map((item) => {
                    const total = item.quantity * item.unitPrice;
                    const currentAmount = parseFloat(editingItems[item.id] || item.amountGiven.toString());
                    const remainingDebt = currentAmount - total;
                    return (
                      <tr key={item.id} className={remainingDebt < 0 ? 'bg-red-50' : remainingDebt > 0 ? 'bg-green-50' : ''}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.designation} ({item.reference})
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {formatPrice(item.unitPrice)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {formatPrice(total)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <input
                            type="number"
                            value={editingItems[item.id] || item.amountGiven}
                            onChange={(e) => handleAmountChange(item.id, e.target.value)}
                            className="w-32 px-2 py-1 text-right border rounded focus:ring-blue-500 focus:border-blue-500"
                            min="0"
                            step="0.01"
                          />
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${
                          remainingDebt < 0 ? 'text-red-600' : remainingDebt > 0 ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {formatPrice(Math.abs(remainingDebt))}
                          {remainingDebt > 0 && ' (à récupérer)'}
                          {remainingDebt < 0 && ' (à payer)'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.beneficiary || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <button
                            onClick={() => handleUpdateAmount(item)}
                            disabled={savingItemId === item.id || selectedExpense.status === 'validated'}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            {savingItemId === item.id ? 'Enregistrement...' : 'Enregistrer'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50 font-medium">
                    <td colSpan={3} className="px-4 py-3 text-sm text-gray-900 text-right">Total</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {formatPrice(calculateTotal(selectedExpense.items))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">
                      {formatPrice(selectedExpense.items.reduce((sum, item) => {
                        const currentAmount = parseFloat(editingItems[item.id] || item.amountGiven.toString());
                        return sum + currentAmount;
                      }, 0))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {(() => {
                        const totalDifference = selectedExpense.items.reduce((sum, item) => {
                          const total = item.quantity * item.unitPrice;
                          const currentAmount = parseFloat(editingItems[item.id] || item.amountGiven.toString());
                          return sum + (currentAmount - total);
                        }, 0);
                        return (
                          <span className={totalDifference > 0 ? 'text-green-600' : totalDifference < 0 ? 'text-red-600' : 'text-gray-900'}>
                            {formatPrice(Math.abs(totalDifference))}
                            {totalDifference > 0 && ' (à récupérer)'}
                            {totalDifference < 0 && ' (à payer)'}
                          </span>
                        );
                      })()}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseHistory;