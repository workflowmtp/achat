import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Save, Search, Edit, X, Check } from 'lucide-react';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { logActivity, ActivityType, EntityType } from '../utils/activityLogger';
import PCAReimbursement from './PCAReimbursement';

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

// Cette interface est utilisée lors de la création d'une dépense complète
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
  
  // États pour la gestion de la modification et suppression
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [reference, setReference] = useState('');
  const [expenseItems, setExpenseItems] = useState<{[key: string]: ExpenseItem[]}>({});
  
  // Vérification des droits d'administration
  const userRole = localStorage.getItem('userRole') || '';
  const isAdmin = localStorage.getItem('isAdmin') === 'true' || userRole === 'admin';

  // Fonction pour récupérer les dépenses et leurs items
  const fetchExpenses = useCallback(async () => {
    if (!user) return;
    
    try {
      // Récupérer toutes les dépenses
      const expensesRef = collection(db, 'expenses');
      const expensesSnapshot = await getDocs(expensesRef);
      const expensesList = expensesSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Expense[];
      
      setExpenses(expensesList);
      
      // Pour chaque dépense, récupérer ses items
      const itemsMap: {[key: string]: ExpenseItem[]} = {};
      
      for (const expense of expensesList) {
        const expenseItemsRef = query(
          collection(db, 'expense_items'),
          where('expenseId', '==', expense.id)
        );
        
        const itemsSnapshot = await getDocs(expenseItemsRef);
        const itemsList = itemsSnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as ExpenseItem[];
        
        itemsMap[expense.id] = itemsList;
      }
      
      setExpenseItems(itemsMap);
    } catch (error) {
      console.error('Erreur lors de la récupération des dépenses:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // Fonction pour récupérer les projets
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

      // Fonction pour récupérer les articles (sans filtrer par utilisateur)
      const fetchArticles = async () => {
        try {
          const articlesRef = collection(db, 'articles');
          // Récupérer tous les articles sans filtrer par utilisateur
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

      // Fonction pour récupérer les fournisseurs (sans filtrer par utilisateur)
      const fetchSuppliers = async () => {
        try {
          const suppliersRef = collection(db, 'suppliers');
          // Récupérer tous les fournisseurs sans filtrer par utilisateur
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

      // Exécuter les fonctions de récupération
      fetchProjects();
      fetchArticles();
      fetchSuppliers();
      fetchExpenses(); // Récupérer les dépenses existantes
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

  // Fonction pour générer une référence de dépense unique
  const generateExpenseReference = async () => {
    // Préfixe basé sur l'année et le mois actuels
    const today = new Date();
    const prefix = `DEP-${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}`;
    
    try {
      // Récupérer toutes les dépenses pour trouver le dernier numéro
      const expensesRef = collection(db, 'expenses');
      const snapshot = await getDocs(expensesRef);
      
      // Filtrer les références qui commencent par le même préfixe
      const matchingRefs = snapshot.docs
        .map(doc => doc.data().reference)
        .filter((ref: string) => ref && ref.startsWith(prefix))
        .map((ref: string) => parseInt(ref.split('-')[2]) || 0);

      // Déterminer le prochain numéro
      const nextNum = matchingRefs.length > 0 
        ? Math.max(...matchingRefs) + 1 
        : 1;

      // Créer la nouvelle référence
      return `${prefix}-${nextNum.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Erreur lors de la génération de la référence:', error);
      // Fallback avec timestamp si erreur
      return `${prefix}-${Date.now().toString().slice(-4)}`;
    }
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
      expenseId: '', // Sera rempli lors de l'enregistrement de la dépense
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
    
    // Réinitialiser les champs après l'ajout
    setSelectedArticle(null);
    setQuantity('');
    setUnitPrice('');
    setSupplierId(''); // Réinitialiser le champ fournisseur
    setAmountGiven('');
    setBeneficiary('');
  };

  // Fonction pour commencer l'édition d'une dépense
  const handleEditStart = (expense: Expense) => {
    if (!isAdmin) return;
    
    setEditingExpenseId(expense.id);
    setDate(expense.date);
    setDescription(expense.description);
    setProjectId(expense.projectId);
    setReference(expense.reference);
    
    // Charger les items de la dépense
    if (expenseItems[expense.id]) {
      setItems(expenseItems[expense.id]);
    }
    
    setIsEditing(true);
  };

  // Fonction pour annuler l'édition
  const handleEditCancel = () => {
    setEditingExpenseId(null);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setDescription('');
    setProjectId('');
    setReference('');
    setItems([]);
    setIsEditing(false);
  };

  // Fonction pour mettre à jour une dépense
  const handleUpdateExpense = async () => {
    if (!user || !projectId || !editingExpenseId) return;

    try {
      const expenseRef = doc(db, 'expenses', editingExpenseId);
      const updatedExpense = {
        date,
        description,
        projectId,
        reference,
        updatedAt: new Date().toISOString()
      };

      // Trouver le projet pour le log d'activité
      const project = projects.find(p => p.id === projectId);
      const projectName = project ? project.name : 'Projet inconnu';

      await updateDoc(expenseRef, updatedExpense);

      // Supprimer les anciens items
      const oldItems = expenseItems[editingExpenseId] || [];
      for (const oldItem of oldItems) {
        const itemRef = doc(db, 'expense_items', oldItem.id);
        await deleteDoc(itemRef);
        
        // Journaliser la suppression de l'item
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
      }

      // Ajouter les nouveaux items
      const newItems: ExpenseItem[] = [];
      const itemsPromises = items.map(item => {
        // On ignore l'id lors de la mise à jour des items
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          return docRef;
        });
      });

      await Promise.all(itemsPromises);
      
      // Journaliser la mise à jour de la dépense avec ses nouveaux items
      const completeExpense = {
        ...updatedExpense,
        id: editingExpenseId,
        userId: user.uid,
        items: newItems
      };
      
      await logActivity(
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
      
      // Rafraîchir les données
      fetchExpenses();
      
      // Réinitialiser le formulaire
      handleEditCancel();
      
      // Informer l'utilisateur
      alert('Dépense mise à jour avec succès!');
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la dépense:', error);
      alert('Erreur lors de la mise à jour de la dépense');
    }
  };

  // Fonction pour confirmer la suppression
  const handleDeleteConfirm = (expenseId: string) => {
    if (!isAdmin) return;
    setDeleteConfirmId(expenseId);
  };

  // Fonction pour annuler la suppression
  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  // Fonction pour supprimer une dépense
  const handleDeleteExpense = async (expenseId: string) => {
    if (!isAdmin || !user) return;

    try {
      // Récupérer les informations de la dépense pour le log
      const expense = expenses.find(e => e.id === expenseId);
      if (!expense) {
        console.error('Dépense non trouvée');
        return;
      }

      // Trouver le projet pour le log d'activité
      const project = projects.find(p => p.id === expense.projectId);
      const projectName = project ? project.name : 'Projet inconnu';

      // Créer une copie complète de la dépense avec ses items pour le log
      const expenseToLog = {
        ...expense,
        items: expenseItems[expenseId] || []
      };

      // Supprimer les items de la dépense
      const items = expenseItems[expenseId] || [];
      for (const item of items) {
        const itemRef = doc(db, 'expense_items', item.id);
        await deleteDoc(itemRef);

        // Journaliser la suppression de chaque item
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

      // Supprimer la dépense
      const expenseRef = doc(db, 'expenses', expenseId);
      await deleteDoc(expenseRef);

      // Journaliser la suppression de la dépense
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

      // Rafraîchir les données
      fetchExpenses();
      
      setDeleteConfirmId(null);
      
      // Informer l'utilisateur
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
        // Mode édition - mettre à jour une dépense existante
        await handleUpdateExpense();
      } else {
        // Mode création - ajouter une nouvelle dépense
        // Trouver le projet pour le log d'activité
        const project = projects.find(p => p.id === projectId);
        const projectName = project ? project.name : 'Projet inconnu';
        
        // Générer une référence unique pour la dépense
        const newReference = await generateExpenseReference();
        
        // Créer la dépense
        const expenseRef = await addDoc(collection(db, 'expenses'), {
          date,
          description,
          projectId,
          reference: newReference,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });

        // Ajouter chaque item de la dépense
        const newItems: ExpenseItem[] = [];
        const itemsPromises = items.map(item => {
          // On exclut l'id local car Firestore génère son propre id
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
        
        // Journaliser la création de la dépense
        const completeExpense = {
          id: expenseRef.id,
          date,
          description,
          projectId,
          reference: newReference,
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
          `Nouvelle dépense créée: ${newReference}`,
          projectId,
          projectName
        );
        
        // Journaliser la création de chaque item
        for (const item of newItems) {
          await logActivity(
            user.uid,
            user.displayName || user.email || 'Utilisateur inconnu',
            ActivityType.CREATE,
            EntityType.EXPENSE_ITEM,
            item.id,
            item,
            `Item de dépense créé pour la dépense ${newReference}`,
            projectId,
            projectName
          );
        }
        
        // Réinitialiser le formulaire
        setDate(format(new Date(), 'yyyy-MM-dd'));
        setDescription('');
        setProjectId('');
        setItems([]);
        
        // Informer l'utilisateur
        alert('Dépense enregistrée avec succès!');
        
        // Rafraîchir les données
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
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">
            {isEditing ? 'Modifier la dépense' : 'Ajouter une dépense'}
          </h2>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
                placeholder="Description générale (optionnel)"
                rows={5}
                style={{ resize: 'vertical' }}
              ></textarea>
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
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
                  placeholder="0"
                  min="0"
                  step="1"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher un article</label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50 pr-10"
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
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
                  placeholder="0"
                  min="0"
                  step="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fournisseur <span className="text-red-500">*</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
                  required={selectedArticle !== null} // Requis uniquement lors de l'ajout d'un article
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
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
                  placeholder="0"
                  min="0"
                  step="1"
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
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-4 py-3 bg-blue-50"
                  placeholder="Nom du bénéficiaire"
                />
              </div>

              {selectedArticle && (
                <div className="md:col-span-2 bg-blue-50 p-4 rounded-md">
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
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Article</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantité</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prix unitaire</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant remis</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant à rembourser</th>
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
                            <td className={`px-4 py-3 text-sm font-medium ${
                              remainingDebt > 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              {formatPrice(remainingDebt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.beneficiary || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.supplier}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-red-600 hover:text-red-800"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-blue-50">
                        <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-900">Total</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatPrice(calculateTotal(items))}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatPrice(items.reduce((sum, item) => sum + item.amountGiven, 0))}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600">
                          {formatPrice(items.reduce((sum, item) => {
                            const total = item.quantity * item.unitPrice;
                            return sum + (item.amountGiven - total);
                          }, 0))}
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

        <div>
          <PCAReimbursement />
        </div>
        
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Dépenses enregistrées</h2>
          
          {expenses.length === 0 ? (
            <p>Aucune dépense enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white border border-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 border-b text-left">Date</th>
                    <th className="py-2 px-4 border-b text-left">Référence</th>
                    <th className="py-2 px-4 border-b text-left">Projet</th>
                    <th className="py-2 px-4 border-b text-left">Description</th>
                    <th className="py-2 px-4 border-b text-left">Montant Total</th>
                    {isAdmin && <th className="py-2 px-4 border-b text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(expense => {
                    const items = expenseItems[expense.id] || [];
                    const totalAmount = items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
                    const project = projects.find(p => p.id === expense.projectId);
                    
                    return (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="py-2 px-4 border-b">{format(new Date(expense.date), 'dd/MM/yyyy')}</td>
                        <td className="py-2 px-4 border-b">{expense.reference}</td>
                        <td className="py-2 px-4 border-b">{project?.name || 'N/A'}</td>
                        <td className="py-2 px-4 border-b">{expense.description}</td>
                        <td className="py-2 px-4 border-b">{totalAmount.toLocaleString('fr-FR')} FCFA</td>
                        {isAdmin && (
                          <td className="py-2 px-4 border-b text-center">
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
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Expenses;