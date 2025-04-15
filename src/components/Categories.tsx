import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';

interface Category {
  id: string;
  name: string;
  description: string;
  userId: string;
}

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchCategories();
  }, [user]);

  const fetchCategories = async () => {
    if (!user) return;
    
    try {
      const categoriesRef = collection(db, 'categories');
      const snapshot = await getDocs(categoriesRef);
      const categoriesList = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Category))
        .filter(category => category.userId === user.uid);
      setCategories(categoriesList);
    } catch (err) {
      console.error("Erreur lors de la récupération des catégories:", err);
      setError("Erreur lors de la récupération des catégories");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError("Le nom de la catégorie est obligatoire");
      return;
    }

    try {
      const categoriesRef = collection(db, 'categories');
      await addDoc(categoriesRef, {
        name,
        description,
        userId: user?.uid,
        createdAt: new Date().toISOString()
      });

      // Reset form
      setName('');
      setDescription('');
      
      // Refresh categories list
      fetchCategories();
    } catch (err) {
      console.error("Erreur lors de la création de la catégorie:", err);
      setError("Erreur lors de la création de la catégorie");
    }
  };

  const handleDelete = async (categoryId: string) => {
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
      fetchCategories();
    } catch (err) {
      console.error("Erreur lors de la suppression de la catégorie:", err);
      setError("Erreur lors de la suppression de la catégorie");
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Gestion des Catégories</h2>

      <form onSubmit={handleSubmit} className="mb-8 bg-white rounded-lg shadow-lg p-8">
        {error && (
          <div className="mb-6 flex items-center bg-red-50 border-l-4 border-red-400 p-4 rounded-r" role="alert">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="block text-sm font-medium mb-1">
              Nom de la catégorie <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-1">(obligatoire)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500 focus:ring-2 transition duration-150 ease-in-out"
              placeholder="Nom de la catégorie"
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium mb-1">
              Description
              <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500 focus:ring-2 transition duration-150 ease-in-out"
              placeholder="Description de la catégorie"
            />
          </div>
        </div>

        <div className="mt-8">
          <button
            type="submit"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            <Plus className="w-5 h-5 mr-2" />
            Créer la catégorie
          </button>
        </div>
      </form>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-blue-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {categories.map((category) => (
              <tr key={category.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{category.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{category.description || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="text-red-600 hover:text-red-900 transition duration-150 ease-in-out"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                  Aucune catégorie n'a été créée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}