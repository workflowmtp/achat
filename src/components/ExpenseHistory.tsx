import React, { useState, useEffect, useCallback } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { Info, X, FileDown, Search, Save, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { collection, getDocs, query, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';

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
  amountGiven: number;
  beneficiary?: string;
  expenseId: string;
}

interface Expense {
  id: string;  // Cet ID sera utilisé comme référence unique de la dépense
  date: string;
  description: string;
  projectId: string;
  items: ExpenseItem[];
  userId: string;
  createdAt?: string;
}

export default function ExpenseHistory() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [userNames, setUserNames] = useState<{[key: string]: string}>({});
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingItems, setEditingItems] = useState<{ [key: string]: string }>({});
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const { user } = useAuth();

  // Fonction pour exporter les dépenses en CSV
  const exportToCSV = async () => {
    try {
      // Définir les en-têtes CSV
      const headers = ['Date', 'Description', 'Projet', 'Utilisateur', 'Articles', 'Total'];
      
      // Transformer les données pour le CSV
      const csvData = expenses.map(expense => {
        const projectName = projects.find(p => p.id === expense.projectId)?.name || 'Non spécifié';
        const userName = getUserName(expense.userId);
        const itemsText = expense.items.map(item => 
          `${item.designation} (${item.quantity} ${item.unit} à ${item.unitPrice}€)`
        ).join('; ');
        const total = expense.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0).toFixed(2);
        
        return [
          expense.date,
          expense.description,
          projectName,
          userName,
          itemsText,
          total
        ];
      });
      
      // Combiner les en-têtes et les données
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          row.map(cell => 
            // Échapper les virgules et les guillemets dans les cellules
            typeof cell === 'string' && (cell.includes(',') || cell.includes('"')) 
              ? `"${cell.replace(/"/g, '""')}"` 
              : cell
          ).join(',')
        )
      ].join('\n');
      
      // Créer un objet Blob avec le contenu CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      
      // Créer un lien de téléchargement
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      // Configurer le lien
      link.setAttribute('href', url);
      link.setAttribute('download', `depenses_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`);
      link.style.visibility = 'hidden';
      
      // Ajouter le lien au DOM, cliquer dessus, puis le supprimer
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('Exportation CSV réussie !');
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      setError('Erreur lors de l\'exportation des données');
    }
  };

  // Fonction pour récupérer le nom d'un utilisateur depuis Firebase
  const fetchUserName = useCallback(async (userId: string) => {
    try {
      // Vérifier si nous avons déjà le nom de cet utilisateur
      if (userNames[userId]) {
        return;
      }

      // Récupérer les informations de l'utilisateur depuis Firebase
      const userDoc = doc(db, 'users', userId);
      const userSnapshot = await getDoc(userDoc);
      
      if (userSnapshot.exists()) {
        const userData = userSnapshot.data();
        // Utiliser le displayName, le nom ou l'email comme nom d'utilisateur
        const name = userData.displayName || userData.name || userData.email || userId;
        
        // Mettre à jour l'état avec le nouveau nom d'utilisateur
        setUserNames(prev => ({
          ...prev,
          [userId]: name
        }));
      } else {
        // Si l'utilisateur n'existe pas dans la collection 'users', utiliser l'ID comme nom
        // Si c'est un email, extraire le nom d'utilisateur
        let name = userId;
        if (userId.includes('@')) {
          const username = userId.split('@')[0];
          name = username
            .split('.')
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
        }
        
        // Mettre à jour l'état avec le nouveau nom d'utilisateur
        setUserNames(prev => ({
          ...prev,
          [userId]: name
        }));
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du nom d\'utilisateur:', error);
      // En cas d'erreur, utiliser l'ID comme nom
      setUserNames(prev => ({
        ...prev,
        [userId]: userId
      }));
    }
  }, [userNames]);

  useEffect(() => {
    if (user) {
      fetchExpenses();
      fetchProjects();
    }
  }, [user]);

  useEffect(() => {
    // Lorsque les dépenses sont chargées, récupérer les noms d'utilisateurs
    if (expenses.length > 0) {
      // Récupérer tous les IDs d'utilisateurs uniques
      const userIds = [...new Set(expenses.map(expense => expense.userId))].filter(Boolean);
      
      // Récupérer les noms d'utilisateurs pour chaque ID
      userIds.forEach(userId => {
        if (userId && !userNames[userId]) {
          fetchUserName(userId);
        }
      });
    }
  }, [expenses, userNames, fetchUserName]);

  const fetchExpenses = async () => {
    if (!user) return;
    
    try {
      // Récupérer toutes les dépenses, sans filtrer par utilisateur
      const expensesRef = collection(db, 'expenses');
      // Créer une requête ordonnée par date (du plus récent au moins récent)
      const expensesQuery = query(expensesRef);
      const expensesSnapshot = await getDocs(expensesQuery);
      const expensesList = expensesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,  // L'ID du document est utilisé comme référence unique
        items: [] as ExpenseItem[]
      })) as Expense[];

      // Trier les dépenses par date (du plus récent au moins récent)
      expensesList.sort((a, b) => {
        // D'abord essayer de comparer par la date stockée
        const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateComparison !== 0) return dateComparison;
        
        // Si dates identiques, utiliser createdAt comme critère secondaire
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        
        return 0;
      });

      // Récupérer tous les items de dépenses
      const itemsRef = collection(db, 'expense_items');
      const itemsSnapshot = await getDocs(itemsRef);
      const allItems = itemsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as ExpenseItem[];

      // Associer les items à leurs dépenses respectives
      expensesList.forEach(expense => {
        expense.items = allItems.filter(item => item.expenseId === expense.id);
      });

      // Définir toutes les dépenses (pour tous les utilisateurs)
      setExpenses(expensesList);
      
    } catch (error) {
      console.error('Erreur lors de la récupération des dépenses:', error);
      setError('Erreur lors de la récupération des dépenses');
    }
  };

  const fetchProjects = async () => {
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
      setError('Erreur lors de la récupération des projets');
    }
  };

  // Fonction pour obtenir le nom d'utilisateur à partir de son ID
  const getUserName = (userId: string | undefined) => {
    if (!userId) return '-';
    
    // Si nous avons déjà récupéré le nom de cet utilisateur, l'utiliser
    if (userNames[userId]) {
      return userNames[userId];
    }
    
    // Si nous n'avons pas encore le nom, lancer la récupération en arrière-plan
    // et retourner une valeur temporaire
    fetchUserName(userId);
    
    // Retourner une valeur temporaire pendant le chargement
    if (userId.includes('@')) {
      const username = userId.split('@')[0];
      return username
        .split('.')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
    }
    
    return userId;
  };

  const handleShowDetails = (expense: Expense) => {
    setSelectedExpense(expense);
    // Initialiser l'état d'édition pour tous les items
    const initialEditingState: { [key: string]: string } = {};
    expense.items.forEach(item => {
      initialEditingState[item.id] = item.amountGiven.toString();
    });
    setEditingItems(initialEditingState);
    setShowModal(true);
    setError('');
    setSuccess('');
  };

  const handleAmountChange = (itemId: string, value: string) => {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handleUpdateAmount = async (item: ExpenseItem) => {
    if (!user) return;

    const newAmount = parseFloat(editingItems[item.id]);
    if (isNaN(newAmount) || newAmount < 0) {
      setError('Le montant doit être un nombre positif');
      return;
    }

    try {
      setSavingItemId(item.id);
      const itemRef = doc(db, 'expense_items', item.id);
      await updateDoc(itemRef, {
        amountGiven: newAmount,
        updatedAt: new Date().toISOString()
      });

      // Mettre à jour l'état local
      setExpenses(prevExpenses => 
        prevExpenses.map(expense => ({
          ...expense,
          items: expense.items.map(expenseItem => 
            expenseItem.id === item.id
              ? { ...expenseItem, amountGiven: newAmount }
              : expenseItem
          )
        }))
      );

      if (selectedExpense) {
        setSelectedExpense({
          ...selectedExpense,
          items: selectedExpense.items.map(expenseItem =>
            expenseItem.id === item.id
              ? { ...expenseItem, amountGiven: newAmount }
              : expenseItem
          )
        });
      }

      setSuccess('Montant mis à jour avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du montant:', error);
      setError('Erreur lors de la mise à jour du montant');
    } finally {
      setSavingItemId(null);
    }
  };

  const calculateTotal = (items: ExpenseItem[]) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const calculateTotalRemainingDebt = (expense: Expense) => {
    return expense.items.reduce((sum, item) => {
      const total = item.quantity * item.unitPrice;
      return sum + (item.amountGiven - total);
    }, 0);
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

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) {
      return format(new Date(), 'dd/MM/yyyy');
    }
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) {
        return format(new Date(), 'dd/MM/yyyy');
      }
      return format(date, 'dd/MM/yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return format(new Date(), 'dd/MM/yyyy');
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Rapport des Dépenses', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Généré le ${format(new Date(), 'dd/MM/yyyy')}`, 14, 30);
    if (selectedProject) {
      const project = projects.find(p => p.id === selectedProject);
      if (project) {
        doc.text(`Projet: ${project.name}`, 14, 35);
      }
    }

    const filteredExpenses = getFilteredExpenses();

    let currentY = selectedProject ? 40 : 35;

    filteredExpenses.forEach((expense, index) => {
      currentY += 10;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      // Utiliser une vérification explicite pour expense.date
      const expenseDate = expense.date || '';
      doc.text(`Dépense du ${formatDate(expenseDate)} - Réf: ${formatExpenseId(expense.id)}`, 14, currentY);
      
      currentY += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Description: ${expense.description}`, 14, currentY);
      currentY += 5;
      doc.text(`Projet: ${projects.find(p => p.id === expense.projectId)?.name || '-'}`, 14, currentY);
      
      currentY += 10;
      (doc as any).autoTable({
        startY: currentY,
        head: [['Référence', 'Article', 'Quantité', 'Prix unitaire', 'Total', 'Montant remis', 'Reste à payer', 'Bénéficiaire', 'Fournisseur']],
        body: expense.items.map(item => [
          item.reference,
          item.designation,
          `${item.quantity} ${item.unit}`,
          formatPrice(item.unitPrice),
          formatPrice(item.quantity * item.unitPrice),
          formatPrice(item.amountGiven),
          formatPrice(item.amountGiven - (item.quantity * item.unitPrice)),
          item.beneficiary || '-',
          item.supplier
        ]),
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        margin: { left: 14 },
        tableWidth: 180
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
      const expenseTotal = calculateTotal(expense.items);
      doc.text(
        `Total de la dépense: ${formatPrice(expenseTotal)}`,
        14,
        currentY
      );

      currentY += 10;

      if (currentY > 270 && index < filteredExpenses.length - 1) {
        doc.addPage();
        currentY = 20;
      }
    });

    const totalAmount = filteredExpenses.reduce((sum, expense) => sum + calculateTotal(expense.items), 0);
    doc.setFont(undefined, 'bold');
    doc.text(
      `Total général: ${formatPrice(totalAmount)}`,
      14,
      currentY + 10
    );

    doc.save('rapport-depenses.pdf');
  };

  const getProjectLabel = (project: Project) => {
    if (project.description) {
      return `${project.name} (${project.description})`;
    }
    return project.name;
  };

  // Formatage de l'ID pour l'afficher comme référence
  const formatExpenseId = (id: string | undefined) => {
    // Prendre les premiers 8 caractères de l'ID comme référence
    if (!id) return 'N/A';
    return id.substring(0, 8).toUpperCase();
  };

  const getFilteredExpenses = () => {
    // Vérifier que expenses existe et n'est pas vide
    if (!expenses || expenses.length === 0) {
      return [];
    }
    
    return expenses.filter(expense => {
      // Vérifier que expense existe
      if (!expense) return false;
      
      // Vérification du projet sélectionné
      const matchesProject = !selectedProject || expense.projectId === selectedProject;
      
      if (!searchTerm) {
        // Si aucun terme de recherche, seulement filtrer par projet
        return matchesProject;
      }
      
      const searchTermLower = searchTerm.toLowerCase();
      
      // Vérification du terme de recherche dans la description de la dépense
      const expenseDescriptionMatch = expense.description ? expense.description.toLowerCase().includes(searchTermLower) : false;
      
      // Vérification du terme de recherche dans l'ID (référence) de la dépense
      const expenseIdMatch = expense.id ? expense.id.toLowerCase().includes(searchTermLower) : false;
      
      // Vérification du terme de recherche dans les articles (désignation ou référence)
      const itemsMatch = expense.items.some(item => {
        const designationMatch = item.designation ? item.designation.toLowerCase().includes(searchTermLower) : false;
        const referenceMatch = item.reference ? item.reference.toLowerCase().includes(searchTermLower) : false;
        const supplierMatch = item.supplier ? item.supplier.toLowerCase().includes(searchTermLower) : false;
        const beneficiaryMatch = item.beneficiary ? item.beneficiary.toLowerCase().includes(searchTermLower) : false;
        
        return designationMatch || referenceMatch || supplierMatch || beneficiaryMatch;
      });
      
      // Vérification du terme de recherche dans la date (format dd/MM/yyyy)
      const formattedDate = formatDate(expense.date);
      const dateMatch = formattedDate.includes(searchTerm);
      
      // Vérification du terme de recherche dans le nom du projet
      const project = projects.find(p => p.id === expense.projectId);
      const projectMatch = project ? 
        project.name.toLowerCase().includes(searchTermLower) || 
        (project.description || '').toLowerCase().includes(searchTermLower) 
        : false;
      
      // Vérification du terme de recherche dans l'ID de l'utilisateur
      const userMatch = expense.userId ? expense.userId.toLowerCase().includes(searchTermLower) : false;
      
      return matchesProject && (
        expenseDescriptionMatch || 
        expenseIdMatch ||
        itemsMatch || 
        dateMatch || 
        projectMatch ||
        userMatch
      );
    });
  };

  const filteredExpenses = getFilteredExpenses();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Historique des dépenses</h2>
        <div className="flex gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            <Download className="w-4 h-4" />
            Exporter en CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FileDown className="w-4 h-4 mr-2" />
            Exporter en PDF
          </button>
        </div>
      </div>

      <div className="mb-6">
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

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-blue-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Référence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projet</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Détails</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredExpenses.map((expense) => {
              const totalRemainingDebt = calculateTotalRemainingDebt(expense);
              const project = projects.find(p => p.id === expense.projectId);
              return (
                <tr key={expense.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(expense.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{expense.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {formatExpenseId(expense.id)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project ? getProjectLabel(project) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatPrice(calculateTotal(expense.items))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <button
                      onClick={() => handleShowDetails(expense)}
                      className={`inline-flex items-center justify-center p-2 rounded-full ${
                        totalRemainingDebt !== 0 
                          ? 'text-red-600 bg-red-100 hover:bg-red-200' 
                          : 'text-blue-600 bg-blue-100 hover:bg-blue-200'
                      }`}
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredExpenses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  {searchTerm ? 'Aucune dépense ne correspond à votre recherche' : 'Aucune dépense n\'a été enregistrée'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && selectedExpense && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Détails de la dépense du {formatDate(selectedExpense.date)} - Réf: {formatExpenseId(selectedExpense.id)}
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reste à payer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bénéficiaire</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedExpense.items.map((item) => {
                    const total = item.quantity * item.unitPrice;
                    const remainingDebt = parseFloat(editingItems[item.id]) - total;
                    return (
                      <tr key={item.id} className={remainingDebt < 0 ? 'bg-red-50' : ''}>
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
                            value={editingItems[item.id]}
                            onChange={(e) => handleAmountChange(item.id, e.target.value)}
                            className="w-32 px-2 py-1 text-right border rounded focus:ring-blue-500 focus:border-blue-500"
                            min="0"
                          />
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${
                          remainingDebt < 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatPrice(remainingDebt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.beneficiary || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <button
                            onClick={() => handleUpdateAmount(item)}
                            disabled={savingItemId === item.id}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            {savingItemId === item.id ? 'Enregistrement...' : 'Enregistrer'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-4 py-3 text-sm font-medium text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatPrice(calculateTotal(selectedExpense.items))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                      {formatPrice(selectedExpense.items.reduce((sum, item) => sum + parseFloat(editingItems[item.id]), 0))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                      {formatPrice(selectedExpense.items.reduce((sum, item) => {
                        const total = item.quantity * item.unitPrice;
                        return sum + (parseFloat(editingItems[item.id]) - total);
                      }, 0))}
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