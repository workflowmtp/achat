import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Save, Search } from 'lucide-react';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
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

interface Expense {
  id: string;
  date: string;
  description: string;
  projectId: string;
  reference: string;
  items: ExpenseItem[];
  userId: string;
}

function Expenses() {
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

  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchArticles();
      fetchSuppliers();
    }
  }, [user]);

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

  const fetchSuppliers = async () => {
    if (!user) return;
    
    try {
      const suppliersRef = collection(db, 'suppliers');
      const q = query(suppliersRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const suppliersList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Supplier[];
      setSuppliers(suppliersList);
    } catch (error) {
      console.error('Erreur lors de la récupération des fournisseurs:', error);
    }
  };

  const fetchArticles = async () => {
    if (!user) return;
    
    try {
      const articlesRef = collection(db, 'articles');
      const q = query(articlesRef, where('userId', '==', user.uid));
      const snapshot = await getDocs(q);
      const articlesList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Article[];
      setArticles(articlesList);
    } catch (error) {
      console.error('Erreur lors de la récupération des articles:', error);
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
      setProjects([]);
    }
  };

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

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || items.length === 0 || !projectId) return;

    try {
      // Générer une référence unique pour cette dépense
      const expenseReference = await generateExpenseReference();
      
      const expenseData = {
        date,
        description,
        projectId,
        reference: expenseReference, // Ajouter la référence
        userId: user.uid,
        createdAt: new Date().toISOString()
      };

      const expenseRef = await addDoc(collection(db, 'expenses'), expenseData);

      const itemsPromises = items.map(item => {
        const { id, ...itemData } = item;
        return addDoc(collection(db, 'expense_items'), {
          ...itemData,
          expenseId: expenseRef.id,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
      });

      await Promise.all(itemsPromises);
      
      // Réinitialiser les champs après enregistrement
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setDescription('');
      setProjectId('');
      setItems([]);
      
      // Informer l'utilisateur que la dépense a été créée
      alert(`Dépense enregistrée avec succès! Référence: ${expenseReference}`);
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
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-bold mb-4">Nouvelle dépense</h3>
          
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

          <div className="mt-6">
            <button
              type="submit"
              disabled={items.length === 0}
              className="inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4 mr-2" />
              Enregistrer la dépense
            </button>
          </div>
        </form>

        <div>
          <PCAReimbursement />
        </div>
      </div>
    </div>
  );
}

export default Expenses;