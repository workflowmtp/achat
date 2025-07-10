import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Pencil, Trash2, Save, X, AlertCircle, Search, ChevronLeft, ChevronRight, ArrowDown, ArrowUp } from 'lucide-react';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';

interface Article {
  id: string;
  designation: string;
  reference: string;
  unit: string;
  userId: string;
}

interface Unit {
  id: string;
  name: string;
  description: string;
}

export default function Articles() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [designation, setDesignation] = useState('');
  const [reference, setReference] = useState('');
  const [unit, setUnit] = useState('');
  const [error, setError] = useState('');
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  // Sorting
  const [sortField, setSortField] = useState<keyof Article>('designation');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Filtrage, tri et pagination
  const filteredArticles = useMemo(() => {
    // Filtrage par recherche
    let result = [...articles];
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(article => 
        article.designation.toLowerCase().includes(searchLower) ||
        article.reference.toLowerCase().includes(searchLower) ||
        article.unit.toLowerCase().includes(searchLower)
      );
    }
    
    // Tri
    result.sort((a, b) => {
      const fieldA = a[sortField].toLowerCase();
      const fieldB = b[sortField].toLowerCase();
      
      if (sortDirection === 'asc') {
        return fieldA.localeCompare(fieldB);
      } else {
        return fieldB.localeCompare(fieldA);
      }
    });
    
    return result;
  }, [articles, searchTerm, sortField, sortDirection]);
  
  // Pagination
  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
  
  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages]);
  
  const paginatedArticles = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredArticles.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredArticles, currentPage, itemsPerPage]);

  const fetchUnits = useCallback(async () => {
    try {
      const unitsRef = collection(db, 'units');
      const snapshot = await getDocs(unitsRef);
      const unitsList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Unit[];
      setUnits(unitsList);
    } catch (err) {
      console.error("Erreur lors de la récupération des unités:", err);
      setError("Erreur lors de la récupération des unités");
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    if (!user) return;
    
    try {
      const articlesRef = collection(db, 'articles');
      const snapshot = await getDocs(articlesRef);
      const articlesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Article[];
      
      console.log('Articles récupérés de Firebase:', articlesList);
      console.log('User connecté:', user);
      console.log('User ID:', user?.uid);
      console.log('Est admin:', isAdmin);
      
      // Récupérer l'ID utilisateur depuis localStorage
      const userId = localStorage.getItem('userId') || '';
      console.log('User ID from localStorage:', userId);
      
      // Afficher tous les articles sans filtrage pour déboguer
      // Commentez cette ligne et décommentez le bloc suivant après débogage
      const filteredArticles = articlesList;
      
      /* Filtrage original - à réactiver après débogage
      const filteredArticles = isAdmin || userId === 'Exp-1234'
        ? articlesList
        : articlesList.filter(article => {
            console.log('Article userId:', article.userId, 'User uid:', user.uid);
            return article.userId === user.uid;
          });
      */
      
      console.log('Articles filtrés:', filteredArticles);
      setArticles(filteredArticles);
    } catch (err) {
      console.error("Erreur lors de la récupération des articles:", err);
      setError("Erreur lors de la récupération des articles");
    }
  }, [user, isAdmin]);
  
  useEffect(() => {
    if (user) {
      fetchArticles();
      fetchUnits();
    }
  }, [user, fetchArticles, fetchUnits]);

  // Cette fonction n'est plus utilisée car la référence est maintenant saisie manuellement
  // Conservée pour référence future si besoin
  /*
  const generateReference = async () => {
    if (!designation) return '';
    
    try {
      // Get the first letter of each word in the designation
      const prefix = designation
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .slice(0, 3);

      // Get all articles with this prefix
      const articlesRef = collection(db, 'articles');
      const snapshot = await getDocs(articlesRef);
      
      // Filter articles with matching prefix and find highest number
      const matchingRefs = snapshot.docs
        .map(doc => doc.data().reference)
        .filter(ref => ref.startsWith(prefix))
        .map(ref => parseInt(ref.slice(-3)) || 0);

      const nextNum = matchingRefs.length > 0 
        ? Math.max(...matchingRefs) + 1 
        : 1;

      return `${prefix}${nextNum.toString().padStart(3, '0')}`;
    } catch (err) {
      console.error("Erreur lors de la génération de la référence:", err);
      return '';
    }
  };
  */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!designation.trim() || !unit) {
      setError("Le nom de l'article et l'unité sont obligatoires");
      return;
    }

    if (!reference.trim()) {
      setError("La référence de l'article est obligatoire");
      return;
    }

    try {
      if (editingArticle) {
        // Mode édition
        await updateDoc(doc(db, 'articles', editingArticle.id), {
          designation,
          reference, // Utiliser la référence saisie manuellement
          unit,
          updatedAt: new Date().toISOString()
        });

        setArticles(articles.map(article => 
          article.id === editingArticle.id 
            ? { ...article, designation, reference, unit }
            : article
        ));
        setEditingArticle(null);
      } else {
        // Mode création - utiliser la référence saisie manuellement
        const articlesRef = collection(db, 'articles');
        const docRef = await addDoc(articlesRef, {
          designation,
          reference, // Utiliser la référence saisie manuellement
          unit,
          userId: user?.uid,
          createdAt: new Date().toISOString()
        });

        setArticles([...articles, {
          id: docRef.id,
          designation,
          reference, // Utiliser la référence saisie manuellement
          unit,
          userId: user?.uid || ''
        }]);
      }

      // Reset form
      setDesignation('');
      setReference('');
      setUnit('');
      setShowModal(false);
    } catch (err) {
      console.error("Erreur lors de l'opération sur l'article:", err);
      setError("Erreur lors de l'opération sur l'article");
    }
  };

  const handleEdit = (article: Article) => {
    setEditingArticle(article);
    setDesignation(article.designation);
    setReference(article.reference);
    setUnit(article.unit);
    setShowModal(true);
  };

  const handleCancelEdit = () => {
    setEditingArticle(null);
    setDesignation('');
    setReference('');
    setUnit('');
    setShowModal(false);
  };

  const handleDelete = async (articleId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) return;

    try {
      await deleteDoc(doc(db, 'articles', articleId));
      setArticles(articles.filter(article => article.id !== articleId));
    } catch (err) {
      console.error("Erreur lors de la suppression de l'article:", err);
      setError("Erreur lors de la suppression de l'article");
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Gestion des Articles</h2>
      
      <div className="mb-4 flex justify-between items-center">
        <button
          onClick={() => {
            setEditingArticle(null);
            setDesignation('');
            setReference('');
            setUnit('');
            setError('');
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un article
        </button>
      </div>

      {/* Modal pour le formulaire */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {editingArticle ? 'Modifier l\'article' : 'Ajouter un nouvel article'}
              </h3>
              <button
                onClick={handleCancelEdit}
                className="text-gray-500 hover:text-gray-700 focus:outline-none"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="mb-6 flex items-center bg-red-50 border-l-4 border-red-400 p-4 rounded-r" role="alert">
                    <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
                    <span className="text-red-700">{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Désignation <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                      className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Nom de l'article"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Référence <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Entrez une référence unique"
                      required
                    />
                    <p className="mt-1 text-sm text-gray-500">Saisissez une référence unique pour cet article</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unité <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      required
                    >
                      <option value="">Sélectionner une unité</option>
                      {units.map((u) => (
                        <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {editingArticle ? (
                      <>
                        <Save className="h-4 w-4 mr-2" />
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

      <div className="mb-4 flex items-center">
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Rechercher un article..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <Search className="h-5 w-5" />
          </div>
        </div>
        <div className="ml-4">
          <select
            value={itemsPerPage}
            onChange={(e) => setItemsPerPage(Number(e.target.value))}
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={5}>5 par page</option>
            <option value={10}>10 par page</option>
            <option value={20}>20 par page</option>
            <option value={50}>50 par page</option>
          </select>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'designation') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('designation');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Désignation
                  {sortField === 'designation' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'reference') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('reference');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Référence
                  {sortField === 'reference' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'unit') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('unit');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Unité
                  {sortField === 'unit' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedArticles.map((article: Article) => (
              <tr key={article.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{article.designation}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{article.reference}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{article.unit}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(article)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(article.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredArticles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  {searchTerm ? "Aucun article ne correspond à votre recherche" : "Aucun article n'a été créé"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {filteredArticles.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => setCurrentPage(currentPage > 1 ? currentPage - 1 : 1)}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Précédent
            </button>
            <button
              onClick={() => setCurrentPage(currentPage < totalPages ? currentPage + 1 : totalPages)}
              disabled={currentPage === totalPages}
              className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Suivant
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Affichage de <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> à <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredArticles.length)}</span> sur <span className="font-medium">{filteredArticles.length}</span> articles
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(currentPage > 1 ? currentPage - 1 : 1)}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <span className="sr-only">Précédent</span>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                {pageNumbers.map((number: number) => (
                  <button
                    key={number}
                    onClick={() => setCurrentPage(number)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === number ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                  >
                    {number}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(currentPage < totalPages ? currentPage + 1 : totalPages)}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                  <span className="sr-only">Suivant</span>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
