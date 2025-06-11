import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Save, X, AlertCircle } from 'lucide-react';
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
  const { user } = useAuth();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    if (user) {
      fetchArticles();
      fetchUnits();
    }
  }, [user]);

  const fetchUnits = async () => {
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
  };

  const fetchArticles = async () => {
    try {
      const articlesRef = collection(db, 'articles');
      const snapshot = await getDocs(articlesRef);
      const articlesList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Article[];
      
      // Vérifier si l'utilisateur a accès aux dépenses
      const hasExpensesAccess = localStorage.getItem('accessExpenses') === 'true';
      
      // Si admin ou utilisateur avec accès aux dépenses, afficher tous les articles, sinon filtrer par userId
      const filteredArticles = (isAdmin || hasExpensesAccess)
        ? articlesList 
        : articlesList.filter(article => article.userId === user?.uid);
      
      console.log('Affichage des articles pour utilisateur avec accès aux dépenses:', hasExpensesAccess);
        
      setArticles(filteredArticles.sort((a, b) => b.reference.localeCompare(a.reference)));
    } catch (err) {
      console.error("Erreur lors de la récupération des articles:", err);
      setError("Erreur lors de la récupération des articles");
    }
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!designation.trim() || !unit) {
      setError("Le nom de l'article et l'unité sont obligatoires");
      return;
    }

    try {
      if (editingArticle) {
        // Mode édition
        await updateDoc(doc(db, 'articles', editingArticle.id), {
          designation,
          reference: editingArticle.reference,
          unit,
          updatedAt: new Date().toISOString()
        });

        setArticles(articles.map(article => 
          article.id === editingArticle.id 
            ? { ...article, designation, unit }
            : article
        ));
        setEditingArticle(null);
      } else {
        // Mode création
        const newReference = await generateReference();
        if (!newReference) {
          setError("Erreur lors de la génération de la référence");
          return;
        }

        const articlesRef = collection(db, 'articles');
        const docRef = await addDoc(articlesRef, {
          designation,
          reference: newReference,
          unit,
          userId: user?.uid,
          createdAt: new Date().toISOString()
        });

        setArticles([...articles, {
          id: docRef.id,
          designation,
          reference: newReference,
          unit,
          userId: user?.uid || ''
        }]);
      }

      // Reset form
      setDesignation('');
      setReference('');
      setUnit('');
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
  };

  const handleCancelEdit = () => {
    setEditingArticle(null);
    setDesignation('');
    setReference('');
    setUnit('');
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

      <form onSubmit={handleSubmit} className="mb-8 bg-white rounded-lg shadow-lg p-8">
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
              Référence
            </label>
            <input
              type="text"
              value={reference}
              disabled
              className="block w-full px-4 py-3 rounded-lg bg-gray-100 border border-gray-300 text-gray-500"
              placeholder="Générée automatiquement"
            />
            <p className="mt-1 text-sm text-gray-500">La référence sera générée automatiquement</p>
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

        <div className="mt-6 flex space-x-4">
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
          {editingArticle && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <X className="h-4 w-4 mr-2" />
              Annuler
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Désignation</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Référence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unité</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {articles.map((article) => (
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
            {articles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                  Aucun article n'a été créé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

