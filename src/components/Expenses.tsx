import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Save, Search, Edit, X, Check } from 'lucide-react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { logActivity, ActivityType, EntityType } from '../utils/activityLogger';

interface Project {
  id: string;
  name: string;
  description: string;
}

interface Article {
  id: string;
  designation: string;
  reference: string;
  unit: string;
}

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
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
  supplierId: string;
  amountGiven: number;
  beneficiary?: string;
  expenseId: string;
}

interface Expense {
  id: string;
  date: string;
  description: string;
  projectId: string;
  reference: string;
  items: ExpenseItem[];
  userId: string;
}

const Expenses: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<Article[]>([]);
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [amountGiven, setAmountGiven] = useState('');
  const [beneficiary, setBeneficiary] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [reference, setReference] = useState('');
  const [expenseItems, setExpenseItems] = useState<{ [key: string]: ExpenseItem[] }>({});

  const [expenseSearchTerm, setExpenseSearchTerm] = useState('');
  const [expenseSortOrder, setExpenseSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expenseCurrentPage, setExpenseCurrentPage] = useState(1);
  const [expenseItemsPerPage, setExpenseItemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const userRole = localStorage.getItem('userRole') || '';
  const userId = user?.uid || '';
  const localStorageUserId = localStorage.getItem('userId') || '';
  const isAdmin = localStorage.getItem('isAdmin') === 'true' || userRole === 'admin';
  const isExp1234 = userId === 'Exp-1234' || localStorageUserId === 'Exp-1234';
  const hasExpenseEditRights = isAdmin || isExp1234;
  
  // Logs de débogage pour comprendre pourquoi les droits d'édition ne sont pas accordés
  console.log('Informations utilisateur:', {
    userId,
    localStorageUserId,
    userRole,
    isAdmin,
    isExp1234,
    hasExpenseEditRights
  });

  const fetchExpenses = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const expensesCollection = collection(db, 'expenses');
      const expensesSnapshot = await getDocs(expensesCollection);
      const expensesList = expensesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];

      const sortedExpenses = [...expensesList].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return expenseSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });

      setExpenses(sortedExpenses);

      const itemsMap: { [key: string]: ExpenseItem[] } = {};
      const expenseItemsCollection = collection(db, 'expense_items');
      const expenseItemsSnapshot = await getDocs(expenseItemsCollection);
      const allExpenseItems = expenseItemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ExpenseItem[];

      allExpenseItems.forEach(item => {
        if (item.expenseId) {
          if (!itemsMap[item.expenseId]) {
            itemsMap[item.expenseId] = [];
          }
          itemsMap[item.expenseId].push(item);
        }
      });

      setExpenseItems(itemsMap);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des dépenses:', error);
      setError('Erreur lors du chargement des dépenses');
      setLoading(false);
    }
  }, [user, expenseSortOrder]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const project = projects.find(p => p.id === expense.projectId);
      const searchTermLower = expenseSearchTerm.toLowerCase().trim();

      if (searchTermLower === '') return true;

      return (
        expense.reference?.toLowerCase().includes(searchTermLower) ||
        expense.description?.toLowerCase().includes(searchTermLower) ||
        project?.name?.toLowerCase().includes(searchTermLower) ||
        format(new Date(expense.date), 'dd/MM/yyyy').includes(searchTermLower)
      );
    });
  }, [expenses, expenseSearchTerm, projects]);

  const expenseIndexOfLastItem = expenseCurrentPage * expenseItemsPerPage;
  const expenseIndexOfFirstItem = expenseIndexOfLastItem - expenseItemsPerPage;

  const getCurrentExpenses = () => {
    return filteredExpenses.slice(expenseIndexOfFirstItem, expenseIndexOfLastItem);
  };

  const renderExpensePaginationButtons = () => {
    const pageNumbers = [];
    const totalPages = Math.ceil(filteredExpenses.length / expenseItemsPerPage);

    let startPage = Math.max(1, expenseCurrentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex items-center space-x-1">
        <button
          onClick={() => setExpenseCurrentPage(1)}
          disabled={expenseCurrentPage === 1}
          className={`px-3 py-1 rounded-md ${expenseCurrentPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          &laquo;
        </button>
        <button
          onClick={() => setExpenseCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={expenseCurrentPage === 1}
          className={`px-3 py-1 rounded-md ${expenseCurrentPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          &lsaquo;
        </button>

        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => setExpenseCurrentPage(number)}
            className={`px-3 py-1 rounded-md ${expenseCurrentPage === number ? 'bg-blue-500 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {number}
          </button>
        ))}

        <button
          onClick={() => setExpenseCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={expenseCurrentPage === totalPages}
          className={`px-3 py-1 rounded-md ${expenseCurrentPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          &rsaquo;
        </button>
        <button
          onClick={() => setExpenseCurrentPage(totalPages)}
          disabled={expenseCurrentPage === totalPages}
          className={`px-3 py-1 rounded-md ${expenseCurrentPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
        >
          &raquo;
        </button>
      </div>
    );
  };

  useEffect(() => {
    if (user) {
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
          setProjects([]);
        }
      };

      const fetchArticles = async () => {
        try {
          const articlesRef = collection(db, 'articles');
          const snapshot = await getDocs(articlesRef);
          const articlesList = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as Article[];
          setArticles(articlesList);
        } catch (error) {
          console.error('Erreur lors de la récupération des articles:', error);
        }
      };

      const fetchSuppliers = async () => {
        try {
          const suppliersRef = collection(db, 'suppliers');
          const snapshot = await getDocs(suppliersRef);
          const suppliersList = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          })) as Supplier[];
          setSuppliers(suppliersList);
        } catch (error) {
          console.error('Erreur lors de la récupération des fournisseurs:', error);
        }
      };

      fetchProjects();
      fetchArticles();
      fetchSuppliers();
      fetchExpenses();
    }
  }, [user, fetchExpenses]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredArticles([]);
      return;
    }

    const searchTermLower = searchTerm.toLowerCase();
    const filtered = articles.filter(article =>
      article.designation.toLowerCase().includes(searchTermLower) ||
      article.reference.toLowerCase().includes(searchTermLower)
    );
    setFilteredArticles(filtered);
  }, [searchTerm, articles]);

  const suggestExpenseReference = () => {
    const today = new Date();
    const prefix = `DEP-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    return `${prefix}-${Date.now().toString().slice(-4)}`;
  };

  const handleSelectArticle = (article: Article) => {
    setSelectedArticle(article);
    setSearchTerm('');
    setFilteredArticles([]);
  };

  const handleAddItem = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedArticle || !quantity || !supplierId) return;

    const selectedSupplier = suppliers.find(s => s.id === supplierId);
    if (!selectedSupplier) return;

    const newItem: ExpenseItem = {
      id: Date.now().toString(),
      expenseId: '',
      articleId: selectedArticle.id,
      designation: selectedArticle.designation,
      reference: selectedArticle.reference,
      quantity: parseFloat(quantity),
      unit: selectedArticle.unit,
      unitPrice: parseFloat(unitPrice) || 0,
      supplier: selectedSupplier.name,
      supplierId: selectedSupplier.id,
      amountGiven: parseFloat(amountGiven) || 0,
      ...(beneficiary && { beneficiary })
    };
    setItems([...items, newItem]);

    setSelectedArticle(null);
    setQuantity('');
    setUnitPrice('');
    setSupplierId('');
    setAmountGiven('');
    setBeneficiary('');
  };

  const handleEditStart = (expense: Expense) => {
    // Vérification des droits d'édition déjà effectuée lors de l'affichage des boutons
    // La fonction est appelée uniquement si le bouton est affiché
    console.log('Début de modification de dépense par utilisateur:', { userId, localStorageUserId, isExp1234, isAdmin });
    
    setEditingExpenseId(expense.id);
    setDate(expense.date);
    setDescription(expense.description);
    setProjectId(expense.projectId);
    setReference(expense.reference);

    if (expenseItems[expense.id]) {
      setItems(expenseItems[expense.id]);
    }

    setIsEditing(true);
    setShowModal(true);
  };

  const handleEditCancel = () => {
    setEditingExpenseId(null);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setDescription('');
    setProjectId('');
    setReference('');
    setItems([]);
    setIsEditing(false);
    setShowModal(false);
  };

  const handleUpdateExpense = async () => {
    if (!user || !projectId || !editingExpenseId) return;

    try {
      console.log('Début de la mise à jour de la dépense:', editingExpenseId);
      const expenseRef = doc(db, 'expenses', editingExpenseId);
      const updatedExpense = {
        date,
        description,
        projectId,
        reference,
        updatedAt: new Date().toISOString(),
        status: 'pending' // S'assurer que le statut est défini
      };

      const project = projects.find(p => p.id === projectId);
      const projectName = project ? project.name : 'Projet inconnu';

      console.log('Mise à jour de la dépense dans Firestore:', updatedExpense);
      await updateDoc(expenseRef, updatedExpense);
      console.log('Dépense mise à jour avec succès dans Firestore');

      const oldItems = expenseItems[editingExpenseId] || [];
      console.log('Suppression des anciens items:', oldItems.length);
      for (const oldItem of oldItems) {
        const itemRef = doc(db, 'expense_items', oldItem.id);
        await deleteDoc(itemRef);
        console.log('Item supprimé:', oldItem.id);

        try {
          console.log('Enregistrement de l\'activité de suppression d\'item:', oldItem.id);
          await logActivity(
            user.uid,
            user.displayName || user.email || 'Utilisateur inconnu',
            ActivityType.DELETE,
            EntityType.EXPENSE_ITEM,
            oldItem.id,
            oldItem,
            `Item de dépense supprimé lors de la mise à jour de la dépense ${reference}`,
            projectId,
            projectName
          );
          console.log('Activité de suppression d\'item enregistrée avec succès');
        } catch (logError) {
          console.error('Erreur lors de l\'enregistrement de l\'activité de suppression d\'item:', logError);
        }
      }

      const newItems: ExpenseItem[] = [];
      console.log('Ajout des nouveaux items:', items.length);
      const itemsPromises = items.map(item => {
        const { id, ...itemData } = item;
        return addDoc(collection(db, 'expense_items'), {
          ...itemData,
          expenseId: editingExpenseId,
          userId: user.uid,
          createdAt: new Date().toISOString()
        }).then(docRef => {
          const newItem = {
            id: docRef.id,
            ...itemData,
            expenseId: editingExpenseId,
            userId: user.uid
          };
          newItems.push(newItem);
          console.log('Nouvel item ajouté:', docRef.id);
          return docRef;
        });
      });

      await Promise.all(itemsPromises);
      console.log('Tous les nouveaux items ont été ajoutés');

      const completeExpense = {
        ...updatedExpense,
        id: editingExpenseId,
        userId: user.uid,
        items: newItems
      };

      try {
        console.log('Enregistrement de l\'activité de mise à jour de la dépense:', editingExpenseId);
        console.log('Données de l\'activité:', {
          userId: user.uid,
          userName: user.displayName || user.email || 'Utilisateur inconnu',
          activityType: ActivityType.UPDATE,
          entityType: EntityType.EXPENSE,
          entityId: editingExpenseId,
          details: `Dépense mise à jour: ${reference}`,
          projectId,
          projectName
        });
        
        const activityId = await logActivity(
          user.uid,
          user.displayName || user.email || 'Utilisateur inconnu',
          ActivityType.UPDATE,
          EntityType.EXPENSE,
          editingExpenseId,
          completeExpense,
          `Dépense mise à jour: ${reference}`,
          projectId,
          projectName
        );
        console.log('Activité de mise à jour enregistrée avec succès, ID:', activityId);
      } catch (logError) {
        console.error('Erreur lors de l\'enregistrement de l\'activité de mise à jour:', logError);
      }

      fetchExpenses();
      handleEditCancel();
      alert('Dépense mise à jour avec succès!');
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la dépense:', error);
      alert('Erreur lors de la mise à jour de la dépense');
    }
  };

  const handleDeleteConfirm = (expenseId: string) => {
    if (!hasExpenseEditRights) return;
    setDeleteConfirmId(expenseId);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    // Vérification des droits d'édition déjà effectuée lors de l'affichage des boutons
    // La fonction est appelée uniquement si le bouton est affiché
    if (!user) return;
    
    console.log('Début de suppression de dépense par utilisateur:', { userId, localStorageUserId, isExp1234, isAdmin });
    
    try {
      const expense = expenses.find(e => e.id === expenseId);
      if (!expense) {
        console.error('Dépense non trouvée');
        return;
      }

      const project = projects.find(p => p.id === expense.projectId);
      const projectName = project ? project.name : 'Projet inconnu';

      const expenseToLog = {
        ...expense,
        items: expenseItems[expenseId] || []
      };

      const items = expenseItems[expenseId] || [];
      for (const item of items) {
        const itemRef = doc(db, 'expense_items', item.id);
        await deleteDoc(itemRef);

        await logActivity(
          user.uid,
          user.displayName || user.email || 'Utilisateur inconnu',
          ActivityType.DELETE,
          EntityType.EXPENSE_ITEM,
          item.id,
          item,
          `Item de dépense supprimé suite à la suppression de la dépense ${expense.reference}`,
          expense.projectId,
          projectName
        );
      }

      const expenseRef = doc(db, 'expenses', expenseId);
      await deleteDoc(expenseRef);

      await logActivity(
        user.uid,
        user.displayName || user.email || 'Utilisateur inconnu',
        ActivityType.DELETE,
        EntityType.EXPENSE,
        expenseId,
        expenseToLog,
        `Dépense supprimée: ${expense.reference}`,
        expense.projectId,
        projectName
      );

      fetchExpenses();
      setDeleteConfirmId(null);
      alert('Dépense supprimée avec succès!');
    } catch (error) {
      console.error('Erreur lors de la suppression de la dépense:', error);
      alert('Erreur lors de la suppression de la dépense');
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectId || items.length === 0) return;

    try {
      if (isEditing && editingExpenseId) {
        await handleUpdateExpense();
      } else {
        const project = projects.find(p => p.id === projectId);
        const projectName = project ? project.name : 'Projet inconnu';
        const finalReference = reference || suggestExpenseReference();

        const expenseRef = await addDoc(collection(db, 'expenses'), {
          date,
          description,
          projectId,
          reference: finalReference,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });

        const newItems: ExpenseItem[] = [];
        const itemsPromises = items.map(item => {
          const { id, ...itemData } = item;
          return addDoc(collection(db, 'expense_items'), {
            ...itemData,
            expenseId: expenseRef.id,
            userId: user.uid,
            createdAt: new Date().toISOString()
          }).then(docRef => {
            const newItem = {
              id: docRef.id,
              ...itemData,
              expenseId: expenseRef.id,
              userId: user.uid
            };
            newItems.push(newItem);
            return docRef;
          });
        });

        await Promise.all(itemsPromises);

        const completeExpense = {
          id: expenseRef.id,
          date,
          description,
          projectId,
          reference: finalReference,
          userId: user.uid,
          items: newItems
        };

        await logActivity(
          user.uid,
          user.displayName || user.email || 'Utilisateur inconnu',
          ActivityType.CREATE,
          EntityType.EXPENSE,
          expenseRef.id,
          completeExpense,
          `Nouvelle dépense créée: ${finalReference}`,
          projectId,
          projectName
        );

        for (const item of newItems) {
          await logActivity(
            user.uid,
            user.displayName || user.email || 'Utilisateur inconnu',
            ActivityType.CREATE,
            EntityType.EXPENSE_ITEM,
            item.id,
            item,
            `Item de dépense créé pour la dépense ${finalReference}`,
            projectId,
            projectName
          );
        }

        setDate(format(new Date(), 'yyyy-MM-dd'));
        setDescription('');
        setProjectId('');
        setReference('');
        setItems([]);
        setShowModal(false);

        alert('Dépense enregistrée avec succès!');
        fetchExpenses();
      }
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la dépense:', error);
      alert('Erreur lors de l\'enregistrement de la dépense');
    }
  };

  const calculateTotal = (items: ExpenseItem[]) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
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

  const getProjectLabel = (project: Project) => {
    if (project.description) {
      return `${project.name} (${project.description})`;
    }
    return project.name;
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dépenses</h2>

      <div className="mb-6 flex justify-between items-center">
        <button
          onClick={() => {
            setEditingExpenseId(null);
            setDate(format(new Date(), 'yyyy-MM-dd'));
            setDescription('');
            setProjectId('');
            setReference('');
            setItems([]);
            setIsEditing(false);
            setError('');
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une dépense
        </button>
      </div>

      {/* Modal pour le formulaire */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {isEditing ? 'Modifier la dépense' : 'Ajouter une dépense'}
              </h3>
              <button
                onClick={handleEditCancel}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 gap-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Projet</label>
                      <select
                        value={projectId}
                        onChange={(e) => setProjectId(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
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
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Référence
                      <span className="text-xs text-gray-500 ml-1">(laissez vide pour génération automatique)</span>
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
                      placeholder={suggestExpenseReference()}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
                      placeholder="Description générale (optionnel)"
                      rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-lg mt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Articles et Services</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Quantité</label>
                      <input
                        type="number"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher un article</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 pr-10"
                          placeholder="Rechercher par désignation ou référence"
                          disabled={!quantity}
                        />
                        <Search className="absolute right-3 top-3 h-5 w-5 text-gray-400" />
                      </div>
                      {filteredArticles.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg">
                          <ul className="max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                            {filteredArticles.map((article) => (
                              <li
                                key={article.id}
                                className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-blue-50"
                                onClick={() => handleSelectArticle(article)}
                              >
                                <div className="flex items-center">
                                  <span className="font-normal block truncate">
                                    {article.designation} ({article.reference})
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Prix unitaire (FCFA)
                        <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
                      </label>
                      <input
                        type="number"
                        value={unitPrice}
                        onChange={(e) => setUnitPrice(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Fournisseur <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={supplierId}
                        onChange={(e) => setSupplierId(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
                        required={selectedArticle !== null}
                      >
                        <option value="">Sélectionner un fournisseur</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Montant remis (FCFA)
                        <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
                      </label>
                      <input
                        type="number"
                        value={amountGiven}
                        onChange={(e) => setAmountGiven(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bénéficiaire
                        <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
                      </label>
                      <input
                        type="text"
                        value={beneficiary}
                        onChange={(e) => setBeneficiary(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3"
                        placeholder="Nom du bénéficiaire"
                      />
                    </div>

                    {selectedArticle && (
                      <div className="md:col-span-2 bg-blue-100 p-4 rounded-md">
                        <h4 className="text-sm font-medium text-blue-900 mb-2">Article sélectionné</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <p className="text-sm text-blue-700">
                            <strong>Article:</strong> {selectedArticle.designation} ({selectedArticle.reference})
                          </p>
                          <p className="text-sm text-blue-700">
                            <strong>Unité:</strong> {selectedArticle.unit}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={handleAddItem}
                        disabled={!selectedArticle || !quantity || !supplierId}
                        className="inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Ajouter l'article
                      </button>
                    </div>
                  </div>

                  {items.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Articles ajoutés</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Article</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix unitaire</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant remis</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Solde</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bénéficiaire</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fournisseur</th>
                              <th className="px-4 py-3"></th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {items.map((item) => {
                              const total = item.quantity * item.unitPrice;
                              const remainingDebt = item.amountGiven - total;
                              return (
                                <tr key={item.id}>
                                  <td className="px-4 py-3 text-sm text-gray-900">{item.reference}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{item.designation}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{item.quantity} {item.unit}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{formatPrice(item.unitPrice)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{formatPrice(total)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{formatPrice(item.amountGiven)}</td>
                                  <td className={`px-4 py-3 text-sm font-medium ${remainingDebt > 0 ? 'text-green-600' : remainingDebt < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                    {formatPrice(Math.abs(remainingDebt))}
                                    {remainingDebt > 0 && ' (à récupérer)'}
                                    {remainingDebt < 0 && ' (à payer)'}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{item.beneficiary || '-'}</td>
                                  <td className="px-4 py-3 text-sm text-gray-900">{item.supplier}</td>
                                  <td className="px-4 py-3">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItem(item.id)}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-gray-50 font-medium">
                              <td colSpan={4} className="px-4 py-3 text-sm text-gray-900 text-right">Total</td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {formatPrice(calculateTotal(items))}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {formatPrice(items.reduce((sum, item) => sum + item.amountGiven, 0))}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {(() => {
                                  const totalDifference = items.reduce((sum, item) => {
                                    const total = item.quantity * item.unitPrice;
                                    return sum + (item.amountGiven - total);
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
                              <td colSpan={3}></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex space-x-4">
                  <button
                    type="submit"
                    disabled={items.length === 0}
                    className="inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isEditing ? 'Mettre à jour la dépense' : 'Enregistrer la dépense'}
                  </button>

                  {isEditing && (
                    <button
                      type="button"
                      onClick={handleEditCancel}
                      className="inline-flex items-center px-4 py-3 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Annuler
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Section des dépenses enregistrées */}
      <div className="mt-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Dépenses enregistrées</h2>

          <div className="w-full md:w-1/3 mt-4 md:mt-0">
            <div className="relative">
              <input
                type="text"
                value={expenseSearchTerm}
                onChange={(e) => setExpenseSearchTerm(e.target.value)}
                placeholder="Rechercher une dépense..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <label className="mr-2 text-sm text-gray-600">Trier par date:</label>
            <button
              onClick={() => {
                setExpenseSortOrder(expenseSortOrder === 'desc' ? 'asc' : 'desc');
                fetchExpenses();
              }}
              className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {expenseSortOrder === 'desc' ? 'Plus récent d\'abord' : 'Plus ancien d\'abord'}
              <span className="ml-1">{expenseSortOrder === 'desc' ? '↓' : '↑'}</span>
            </button>
          </div>

          <div className="flex items-center">
            <label className="mr-2 text-sm text-gray-600">Afficher:</label>
            <select
              value={expenseItemsPerPage}
              onChange={(e) => {
                setExpenseItemsPerPage(Number(e.target.value));
                setExpenseCurrentPage(1);
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

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Chargement des dépenses...</span>
          </div>
        ) : error ? (
          <div className="text-center py-4 text-red-600">{error}</div>
        ) : expenses.length === 0 ? (
          <p className="text-center py-4 text-gray-500">Aucune dépense enregistrée.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-3 px-4 border-b text-left font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="py-3 px-4 border-b text-left font-medium text-gray-500 uppercase tracking-wider">Référence</th>
                    <th className="py-3 px-4 border-b text-left font-medium text-gray-500 uppercase tracking-wider">Projet</th>
                    <th className="py-3 px-4 border-b text-left font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="py-3 px-4 border-b text-left font-medium text-gray-500 uppercase tracking-wider">Montant Total</th>
                    <th className="py-3 px-4 border-b text-center font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getCurrentExpenses().map(expense => {
                    const items = expenseItems[expense.id] || [];
                    const totalAmount = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
                    const project = projects.find(p => p.id === expense.projectId);

                    return (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 border-b">{format(new Date(expense.date), 'dd/MM/yyyy')}</td>
                        <td className="py-3 px-4 border-b">{expense.reference}</td>
                        <td className="py-3 px-4 border-b">{project?.name || 'N/A'}</td>
                        <td className="py-3 px-4 border-b">{expense.description || '-'}</td>
                        <td className="py-3 px-4 border-b">{formatPrice(totalAmount)}</td>
                        {/* Affichage des boutons d'action pour tous les utilisateurs */}
                        <td className="py-3 px-4 border-b text-center">
                            {deleteConfirmId === expense.id ? (
                              <div className="flex justify-center space-x-2">
                                <button
                                  onClick={() => handleDeleteExpense(expense.id)}
                                  className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                                  title="Confirmer la suppression"
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={handleDeleteCancel}
                                  className="p-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                                  title="Annuler"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center space-x-2">
                                <button
                                  onClick={() => handleEditStart(expense)}
                                  className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                                  title="Modifier"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteConfirm(expense.id)}
                                  className="p-1 bg-red-500 text-white rounded hover:bg-red-600"
                                  title="Supprimer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            )}
                          </td>
                      </tr>
                    );
                  })}
                  {filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={hasExpenseEditRights ? 6 : 5} className="py-4 text-center text-gray-500">
                        Aucune dépense ne correspond à votre recherche
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {filteredExpenses.length > expenseItemsPerPage && (
              <div className="mt-6 flex justify-between items-center">
                <p className="text-sm text-gray-700">
                  Affichage de <span className="font-medium">{filteredExpenses.length > 0 ? expenseIndexOfFirstItem + 1 : 0}</span> à{' '}
                  <span className="font-medium">{Math.min(expenseIndexOfLastItem, filteredExpenses.length)}</span> sur{' '}
                  <span className="font-medium">{filteredExpenses.length}</span> résultats
                </p>

                {renderExpensePaginationButtons()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Expenses;