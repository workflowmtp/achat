import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Pencil, Save, X } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';

interface Unit {
  id: string;
  name: string;
  description: string;
  userId: string;
}

export default function Units() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchUnits();
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError("Le nom de l'unité est obligatoire");
      return;
    }

    try {
      if (editingUnit) {
        // Update existing unit
        const unitRef = doc(db, 'units', editingUnit.id);
        await updateDoc(unitRef, {
          name,
          description,
          updatedAt: new Date().toISOString()
        });

        setUnits(units.map(unit => 
          unit.id === editingUnit.id 
            ? { ...unit, name, description }
            : unit
        ));
        setEditingUnit(null);
      } else {
        // Create new unit
        const unitsRef = collection(db, 'units');
        await addDoc(unitsRef, {
          name,
          description,
          userId: user?.uid,
          createdAt: new Date().toISOString()
        });
        
        fetchUnits();
      }

      // Reset form
      setName('');
      setDescription('');
    } catch (err) {
      console.error("Erreur lors de l'opération sur l'unité:", err);
      setError("Erreur lors de l'opération sur l'unité");
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setName(unit.name);
    setDescription(unit.description || '');
    setError('');
  };

  const handleCancelEdit = () => {
    setEditingUnit(null);
    setName('');
    setDescription('');
    setError('');
  };

  const handleDelete = async (unitId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette unité ?')) return;
    
    try {
      await deleteDoc(doc(db, 'units', unitId));
      fetchUnits();
    } catch (err) {
      console.error("Erreur lors de la suppression de l'unité:", err);
      setError("Erreur lors de la suppression de l'unité");
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Gestion des Unités</h2>

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
              Nom de l'unité <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 ml-1">(obligatoire)</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500 focus:ring-2 transition duration-150 ease-in-out"
              placeholder="Nom de l'unité"
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
              placeholder="Description de l'unité"
            />
          </div>
        </div>

        <div className="mt-8 flex space-x-4">
          <button
            type="submit"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            {editingUnit ? (
              <>
                <Save className="w-5 h-5 mr-2" />
                Mettre à jour l'unité
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Créer l'unité
              </>
            )}
          </button>
          {editingUnit && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
            >
              <X className="w-5 h-5 mr-2" />
              Annuler
            </button>
          )}
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
            {units.map((unit) => (
              <tr key={unit.id} className="hover:bg-gray-50 transition duration-150 ease-in-out">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{unit.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{unit.description || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                  <button
                    onClick={() => handleEdit(unit)}
                    className="text-blue-600 hover:text-blue-900 transition duration-150 ease-in-out inline-flex items-center"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(unit.id)}
                    className="text-red-600 hover:text-red-900 transition duration-150 ease-in-out inline-flex items-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {units.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                  Aucune unité n'a été créée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}