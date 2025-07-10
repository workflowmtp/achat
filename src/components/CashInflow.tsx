import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { Plus, Edit, Trash2, X, Check, Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, AlertCircle } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { usePCADebt } from './usePCADebt'; // Importer le hook pour la dette PCA
import { useUserRights } from './utils/UserRoleHelper'; // Importer le hook pour la gestion des droits utilisateur

interface Project {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  balance?: number;
  totalIncome?: number;
  totalExpenses?: number;
  updatedAt?: string;
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
  const [totalValidatedExpenses, setTotalValidatedExpenses] = useState<number>(0);
  const [globalTotalInflow, setGlobalTotalInflow] = useState<number>(0);
  const [effectiveBalance, setEffectiveBalance] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // États pour la recherche et pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof CashEntry>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showModal, setShowModal] = useState(false);
  
  const { user } = useAuth();
  // Utiliser le hook pour récupérer les droits utilisateur
  const { isAdmin, isDep12345, isDep1234, hasEditRights } = useUserRights();
  const { pcaDebt, loading, refreshPCADebt } = usePCADebt(); // Utiliser le hook pour la dette PCA
  
  // Afficher un message dans la console pour le débogage
  useEffect(() => {
    console.log('CashInflow - isAdmin:', isAdmin);
    console.log('CashInflow - isDep12345:', isDep12345);
    console.log('CashInflow - isDep1234:', isDep1234);
    console.log('CashInflow - hasEditRights:', hasEditRights);
    
    // Forcer la mise à jour du composant si l'utilisateur a des droits d'édition
    if (hasEditRights) {
      console.log('CashInflow - Utilisateur avec droits d\'édition détecté, forçage de l\'affichage des actions');
    }
  }, [isAdmin, isDep12345, isDep1234, hasEditRights]);

  // Liste des sources d'entrée (récupéré depuis un state global ou une base de données)
  const sources = useMemo(() => [
    { id: 'rebus', label: 'Compte des rebus' },
    { id: 'bank', label: 'Compte bancaire' },
    { id: 'pca', label: 'Compte PCA' },
    { id: 'granule', label: 'Vente Granule' },
    { id: 'espece', label: 'Vente d\'espèce client' }
  ], []);

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
      let validatedTotal = 0;

      for (const expense of expenses) {
        const itemsRef = collection(db, 'expense_items');
        const itemsQuery = query(itemsRef);
        const itemsSnapshot = await getDocs(itemsQuery);
        const items = itemsSnapshot.docs
          .map(doc => doc.data() as ExpenseItem)
          .filter(item => item.expenseId === expense.id);
        
        const expenseTotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        total += expenseTotal;
        
        // Vérifier si la dépense est validée
        const expenseData = expense as any;
        const status = String(expenseData.status || '').toLowerCase();
        if (status === 'validated' || status === 'valid' || status === 'true') {
          validatedTotal += expenseTotal;
        }
      }

      setTotalExpenses(total);
      setTotalValidatedExpenses(validatedTotal);
      
      // Calculer le solde effectif (entrées - dépenses validées)
      setEffectiveBalance(globalTotalInflow - validatedTotal);
    } catch (error) {
      console.error('Erreur lors du calcul des dépenses totales:', error);
    }
  }, [user, globalTotalInflow]);

  // Définir fetchProjects avec useCallback
  const fetchProjects = React.useCallback(async () => {
    try {
      const projectsRef = collection(db, 'projects');
      const snapshot = await getDocs(projectsRef);
      setProjects(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || '',
          description: data.description || '',
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          balance: data.balance || 0,
          totalIncome: data.totalIncome || 0,
          totalExpenses: data.totalExpenses || 0,
          updatedAt: data.updatedAt || ''
        } as Project;
      }));
    } catch (error) {
      console.error('Erreur lors de la récupération des projets:', error);
      setError('Erreur lors de la récupération des projets');
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
      
      // Mettre à jour le solde effectif avec le nouveau total des entrées
      setEffectiveBalance(globalTotal - totalValidatedExpenses);
    } catch (error) {
      console.error('Erreur lors de la récupération des entrées:', error);
    }
  }, [user]);
  
  // Filtrer et trier les entrées avec useMemo
  const filteredEntries = useMemo(() => {
    let result = [...entries];
    
    // Filtrage par terme de recherche
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(entry => {
        const project = projects.find(p => p.id === entry.projectId);
        const source = sources.find(s => s.id === entry.source);
        // Formaté l'ID pour la recherche par référence (8 premiers caractères en majuscule)
        const reference = entry.id ? entry.id.substring(0, 8).toUpperCase() : '';
        
        return (
          entry.description.toLowerCase().includes(searchLower) ||
          (project && project.name.toLowerCase().includes(searchLower)) ||
          (source && source.label.toLowerCase().includes(searchLower)) ||
          String(entry.amount).includes(searchLower) ||
          (entry.date && format(new Date(entry.date), 'dd/MM/yyyy').toLowerCase().includes(searchLower)) ||
          reference.toLowerCase().includes(searchLower) // Recherche par référence
        );
      });
    }
    
    // Tri des entrées
    return result.sort((a, b) => {
      if (sortField === 'date') {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
      }
      
      if (sortField === 'amount') {
        return sortDirection === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
      
      const valueA = String(a[sortField] || '').toLowerCase();
      const valueB = String(b[sortField] || '').toLowerCase();
      return sortDirection === 'asc' 
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    });
  }, [entries, searchTerm, projects, sources, sortField, sortDirection]);
  
  // Calculer le nombre total de pages
  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  
  // Obtenir les entrées pour la page courante
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEntries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEntries, currentPage, itemsPerPage]);

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
      
      // Mettre à jour le solde du projet associé
      if (entry.projectId) {
        const projectRef = doc(db, 'projects', entry.projectId);
        const projectDoc = await getDoc(projectRef);
        
        if (projectDoc.exists()) {
          const projectData = projectDoc.data() as Project;
          const currentBalance = projectData.balance || 0;
          const currentTotalIncome = projectData.totalIncome || 0;
          
          // Mettre à jour le solde et le total des entrées
          await updateDoc(projectRef, {
            balance: currentBalance + entry.amount,
            totalIncome: currentTotalIncome + entry.amount,
            updatedAt: new Date().toISOString()
          });
          console.log(`Solde du projet ${entry.projectId} mis à jour: +${entry.amount} (nouveau solde: ${currentBalance + entry.amount})`);
        }
      }
      
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

  // Fonction pour commencer l'édition d'une entrée
  const handleEditStart = (entry: CashEntry) => {
    // Vérifier directement les droits d'édition pour éviter les problèmes de mise à jour
    const userId = localStorage.getItem('userId') || '';
    const currentUserId = localStorage.getItem('currentUserId') || '';
    const userRole = localStorage.getItem('userRole') || '';
    
    const isAdminCheck = localStorage.getItem('isAdmin') === 'true' || userRole === 'admin';
    const isDep12345Check = userId === 'Dep-12345' || currentUserId === 'Dep-12345';
    const isDep1234Check = userId === 'Dep-1234' || currentUserId === 'Dep-1234';
    const hasAccessEntriesCheck = localStorage.getItem('accessEntries') === 'true';
    
    // Vérifier les droits d'édition directement
    const hasEditRightsCheck = isAdminCheck || isDep12345Check || isDep1234Check || hasAccessEntriesCheck;
    
    console.log('CashInflow - Vérification directe des droits:');
    console.log('- isAdminCheck:', isAdminCheck);
    console.log('- isDep12345Check:', isDep12345Check);
    console.log('- isDep1234Check:', isDep1234Check);
    console.log('- hasAccessEntriesCheck:', hasAccessEntriesCheck);
    console.log('- hasEditRightsCheck:', hasEditRightsCheck);
    
    if (!hasEditRightsCheck) {
      console.log('CashInflow - Édition refusée: droits insuffisants');
      return;
    }
    
    setEditingEntryId(entry.id);
    setDate(entry.date);
    setAmount(entry.amount.toString());
    setSource(entry.source);
    setDescription(entry.description);
    setProjectId(entry.projectId);
    setIsEditing(true);
    setShowModal(true);
  };

  // Fonction pour annuler l'édition
  const handleEditCancel = () => {
    setEditingEntryId(null);
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setAmount('');
    setSource('');
    setDescription('');
    setProjectId('');
    setIsEditing(false);
    setError('');
    setShowModal(false);
  };

  // Fonction pour mettre à jour une entrée
  const handleUpdateEntry = async () => {
    if (!user || !projectId || !editingEntryId) return;

    try {
      // Récupérer l'entrée actuelle pour connaître l'ancien montant et projet
      const entryToUpdate = entries.find(entry => entry.id === editingEntryId);
      if (!entryToUpdate) {
        setError("Entrée introuvable");
        return;
      }

      const oldAmount = entryToUpdate.amount;
      const oldProjectId = entryToUpdate.projectId;
      const newAmount = parseFloat(amount);
      
      // 1. Restaurer le solde de l'ancien projet (si différent)
      if (oldProjectId) {
        const oldProjectRef = doc(db, 'projects', oldProjectId);
        const oldProjectDoc = await getDoc(oldProjectRef);
        
        if (oldProjectDoc.exists()) {
          const projectData = oldProjectDoc.data() as Project;
          const currentBalance = projectData.balance || 0;
          const currentTotalIncome = projectData.totalIncome || 0;
          
          // Soustraire l'ancien montant du solde et des entrées totales
          await updateDoc(oldProjectRef, {
            balance: currentBalance - oldAmount,
            totalIncome: Math.max(0, currentTotalIncome - oldAmount),
            updatedAt: new Date().toISOString()
          });
          console.log(`Restauration du solde du projet ${oldProjectId}: -${oldAmount} (nouveau solde: ${currentBalance - oldAmount})`);
        }
      }
      
      // 2. Ajouter le nouveau montant au projet sélectionné
      if (projectId) {
        const newProjectRef = doc(db, 'projects', projectId);
        const newProjectDoc = await getDoc(newProjectRef);
        
        if (newProjectDoc.exists()) {
          const projectData = newProjectDoc.data() as Project;
          const currentBalance = projectData.balance || 0;
          const currentTotalIncome = projectData.totalIncome || 0;
          
          // Ajouter le nouveau montant au solde et aux entrées totales
          await updateDoc(newProjectRef, {
            balance: currentBalance + newAmount,
            totalIncome: currentTotalIncome + newAmount,
            updatedAt: new Date().toISOString()
          });
          console.log(`Mise à jour du solde du projet ${projectId}: +${newAmount} (nouveau solde: ${currentBalance + newAmount})`);
        }
      }
      
      // 3. Mettre à jour l'entrée dans Firestore
      const entryRef = doc(db, 'cash_inflow', editingEntryId);
      await updateDoc(entryRef, {
        date,
        amount: newAmount,
        source,
        description,
        projectId,
        updatedAt: new Date().toISOString(),
      });

      // Mettre à jour l'entrée dans l'état local
      const updatedEntries = entries.map(entry => {
        if (entry.id === editingEntryId) {
          return {
            ...entry,
            date,
            amount: newAmount,
            source,
            description,
            projectId,
            updatedAt: new Date().toISOString(),
          };
        }
        return entry;
      });

      setEntries(updatedEntries);
      
      // Si c'est une entrée PCA, rafraîchir la dette PCA
      if (source === 'pca') {
        refreshPCADebt();
      }

      // Réinitialiser le formulaire et fermer la modal
      handleEditCancel();
      
    } catch (error) {
      console.error('Erreur lors de la mise à jour de l\'entrée:', error);
      setError('Erreur lors de la mise à jour de l\'entrée');
    }
  };

  // Fonction pour confirmer la suppression d'une entrée
  const handleDeleteConfirm = (id: string) => {
    // Vérifier directement les droits d'édition pour éviter les problèmes de mise à jour
    const userId = localStorage.getItem('userId') || '';
    const currentUserId = localStorage.getItem('currentUserId') || '';
    const userRole = localStorage.getItem('userRole') || '';
    
    const isAdminCheck = localStorage.getItem('isAdmin') === 'true' || userRole === 'admin';
    const isDep12345Check = userId === 'Dep-12345' || currentUserId === 'Dep-12345';
    const isDep1234Check = userId === 'Dep-1234' || currentUserId === 'Dep-1234';
    const hasAccessEntriesCheck = localStorage.getItem('accessEntries') === 'true';
    
    // Vérifier les droits d'édition directement
    const hasEditRightsCheck = isAdminCheck || isDep12345Check || isDep1234Check || hasAccessEntriesCheck;
    
    console.log('CashInflow - Vérification directe des droits pour suppression:');
    console.log('- isAdminCheck:', isAdminCheck);
    console.log('- isDep12345Check:', isDep12345Check);
    console.log('- isDep1234Check:', isDep1234Check);
    console.log('- hasAccessEntriesCheck:', hasAccessEntriesCheck);
    console.log('- hasEditRightsCheck:', hasEditRightsCheck);
    
    if (!hasEditRightsCheck) {
      console.log('CashInflow - Confirmation de suppression refusée: droits insuffisants');
      return;
    }
    setDeleteConfirmId(id);
  };

  // Fonction pour annuler la suppression
  const handleDeleteCancel = () => {
    setDeleteConfirmId(null);
  };

  // Fonction pour supprimer une entrée
  const handleDeleteEntry = async (id: string) => {
    // Vérifier directement les droits d'édition pour éviter les problèmes de mise à jour
    const userId = localStorage.getItem('userId') || '';
    const currentUserId = localStorage.getItem('currentUserId') || '';
    const userRole = localStorage.getItem('userRole') || '';
    
    const isAdminCheck = localStorage.getItem('isAdmin') === 'true' || userRole === 'admin';
    const isDep12345Check = userId === 'Dep-12345' || currentUserId === 'Dep-12345';
    const isDep1234Check = userId === 'Dep-1234' || currentUserId === 'Dep-1234';
    const hasAccessEntriesCheck = localStorage.getItem('accessEntries') === 'true';
    
    // Vérifier les droits d'édition directement
    const hasEditRightsCheck = isAdminCheck || isDep12345Check || isDep1234Check || hasAccessEntriesCheck;
    
    console.log('CashInflow - Vérification directe des droits pour suppression finale:');
    console.log('- isAdminCheck:', isAdminCheck);
    console.log('- isDep12345Check:', isDep12345Check);
    console.log('- isDep1234Check:', isDep1234Check);
    console.log('- hasAccessEntriesCheck:', hasAccessEntriesCheck);
    console.log('- hasEditRightsCheck:', hasEditRightsCheck);
    
    if (!hasEditRightsCheck) {
      console.log('CashInflow - Suppression refusée: droits insuffisants');
      return;
    }

    try {
      // Récupérer l'entrée avant de la supprimer pour pouvoir restaurer le solde
      const deletedEntry = entries.find(entry => entry.id === id);
      if (!deletedEntry) {
        setError("Entrée introuvable");
        return;
      }
      
      // 1. Restaurer le solde du projet (soustraire le montant de l'entrée)
      if (deletedEntry.projectId) {
        const projectRef = doc(db, 'projects', deletedEntry.projectId);
        const projectDoc = await getDoc(projectRef);
        
        if (projectDoc.exists()) {
          const projectData = projectDoc.data() as Project;
          const currentBalance = projectData.balance || 0;
          const currentTotalIncome = projectData.totalIncome || 0;
          
          // Soustraire le montant de l'entrée du solde et des entrées totales
          await updateDoc(projectRef, {
            balance: currentBalance - deletedEntry.amount,
            totalIncome: Math.max(0, currentTotalIncome - deletedEntry.amount),
            updatedAt: new Date().toISOString()
          });
          console.log(`Restauration du solde du projet ${deletedEntry.projectId} après suppression: -${deletedEntry.amount} (nouveau solde: ${currentBalance - deletedEntry.amount})`);
        }
      }

      // 2. Supprimer l'entrée de Firestore
      await deleteDoc(doc(db, 'entries', id));

      // 3. Supprimer l'entrée de l'état local
      const updatedEntries = entries.filter(entry => entry.id !== id);
      setEntries(updatedEntries);

      // Recalculer le total global
      const globalTotal = updatedEntries.reduce((sum, entry) => sum + entry.amount, 0);
      setGlobalTotalInflow(globalTotal);

      // Rafraîchir la dette PCA si nécessaire
      if (deletedEntry.source === 'pca') {
        refreshPCADebt();
      }

      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'entrée:', error);
      setError('Erreur lors de la suppression de l\'entrée');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Si on est en mode édition, mettre à jour l'entrée
    if (isEditing && editingEntryId) {
      await handleUpdateEntry();
      return;
    }
    
    // Sinon, créer une nouvelle entrée
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

  // Générer les numéros de page pour la pagination
  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages]);
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Entrées de fonds</h2>
      
      <div className="mb-4 flex justify-between items-center">
        <button
          onClick={() => {
            setEditingEntryId(null);
            setDate(format(new Date(), 'yyyy-MM-dd'));
            setAmount('');
            setSource('');
            setDescription('');
            setProjectId('');
            setIsEditing(false);
            setError('');
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une entrée
        </button>
      </div>
      
      {/* La barre de recherche est maintenant déplacée dans le tableau */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
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
          <h3 className="text-sm font-medium text-blue-800">Solde estimé (global)</h3>
          <p className="mt-2 text-2xl font-semibold text-blue-900">
            {formatPrice(globalTotalInflow - totalExpenses)}
          </p>
          <p className="mt-1 text-xs text-blue-600">
            Inclut toutes les dépenses (validées et non validées)
          </p>
        </div>
        <div className="bg-green-700 rounded-lg p-6">
          <h3 className="text-sm font-medium text-white">Solde réel (global)</h3>
          <p className="mt-2 text-2xl font-semibold text-white">
            {formatPrice(effectiveBalance)}
          </p>
          <p className="mt-1 text-xs text-green-100">
            Entrées moins dépenses validées uniquement
          </p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-yellow-800">Dette PCA (global)</h3>
          <p className="mt-2 text-2xl font-semibold text-yellow-900">
            {loading ? 'Calcul en cours...' : formatPrice(pcaDebt)}
          </p>
        </div>
      </div>

      {/* Modal pour le formulaire */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {isEditing ? 'Modifier l\'entrée' : 'Nouvelle entrée'}
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
                {error && (
                  <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-r" role="alert">
                    <div className="flex">
                      <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                      <span className="text-red-700">{error}</span>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="md:col-span-2">
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
                <div className="mt-6 flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={handleEditCancel}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {isEditing ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Mettre à jour
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Ajouter
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Barre de recherche intégrée au tableau */}
        <div className="p-4 bg-white border-b border-gray-200 flex">
          <div className="relative w-full">
            <input
              type="text"
              placeholder="Rechercher par description, projet, date, source ou montant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'date') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('date');
                    setSortDirection('desc');
                  }
                }}
              >
                <div className="flex items-center">
                  Date
                  {sortField === 'date' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Référence
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'source') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('source');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Source
                  {sortField === 'source' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projet</th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'description') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('description');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Description
                  {sortField === 'description' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'amount') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('amount');
                    setSortDirection('desc');
                  }
                }}
              >
                <div className="flex items-center justify-end">
                  Montant
                  {sortField === 'amount' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              {
                // Toujours afficher la colonne Actions pour tous les utilisateurs
                // Cela garantit que la colonne est visible quel que soit l'utilisateur
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              }
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedEntries.length > 0 ? paginatedEntries.map((entry) => {
              const project = projects.find(p => p.id === entry.projectId);
              return (
                <tr key={entry.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry.date && !isNaN(new Date(entry.date).getTime()) 
                      ? format(new Date(entry.date), 'dd/MM/yyyy')
                      : 'Date invalide'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {entry?.id?.substring(0, 8)?.toUpperCase() || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {entry.source ? (sources.find(s => s.id === entry.source)?.label || entry.source) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {project ? getProjectLabel(project) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{entry.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                    {formatPrice(entry.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right space-x-2">
                    {/* Toujours afficher la colonne des boutons d'action */}
                    {/* Les vérifications de droits se feront au niveau des handlers */}
                    {deleteConfirmId === entry.id ? (
                        <>
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            className="text-white bg-red-600 hover:bg-red-700 p-1 rounded-md"
                            title="Confirmer la suppression"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleDeleteCancel}
                            className="text-white bg-gray-500 hover:bg-gray-600 p-1 rounded-md"
                            title="Annuler"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEditStart(entry)}
                            className="text-white bg-blue-600 hover:bg-blue-700 p-1 rounded-md"
                            title="Modifier cette entrée"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteConfirm(entry.id)}
                            className="text-white bg-red-600 hover:bg-red-700 p-1 rounded-md"
                            title="Supprimer cette entrée"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-6 py-4 text-center text-gray-500">
                  {filteredEntries.length === 0 ? "Aucune entrée disponible" : "Aucune entrée ne correspond à votre recherche"}
                </td>
              </tr>
            )}
            {filteredEntries.length > 0 && (
              <tr className="bg-gray-50">
                <td colSpan={isAdmin ? 4 : 4} className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  Total
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  {formatPrice(filteredEntries.reduce((sum, entry) => sum + entry.amount, 0))}
                </td>
                {isAdmin && <td></td>}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-2">
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="border border-gray-300 rounded p-1 text-sm"
          >
            <option value={5}>5 par page</option>
            <option value={10}>10 par page</option>
            <option value={25}>25 par page</option>
            <option value={50}>50 par page</option>
          </select>
          <span className="text-sm text-gray-600">
            Affichage de {filteredEntries.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} à {Math.min(currentPage * itemsPerPage, filteredEntries.length)} sur {filteredEntries.length} entrées
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            className="border border-gray-300 rounded-md p-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          {pageNumbers.map(number => (
            <button
              key={number}
              className={`px-3 py-1 rounded-md ${currentPage === number ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`}
              onClick={() => setCurrentPage(number)}
            >
              {number}
            </button>
          ))}
          
          <button
            className="border border-gray-300 rounded-md p-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}