import React, { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Pencil, X, Save, Search } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  description: string;
  userId: string;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    if (user) {
      fetchSuppliers();
    }
  }, [user]);

  const fetchSuppliers = async () => {
    if (!user) return;
    
    try {
      const suppliersRef = collection(db, 'suppliers');
      const snapshot = await getDocs(suppliersRef);
      const suppliersList = snapshot.docs
        .map(doc => ({ ...doc.data(), id: doc.id } as Supplier));
      
      // Filtrer les fournisseurs si non admin
      const filteredSuppliers = isAdmin 
        ? suppliersList 
        : suppliersList.filter(supplier => supplier.userId === user.uid);
        
      setSuppliers(filteredSuppliers);
    } catch (err) {
      console.error("Erreur lors de la récupération des fournisseurs:", err);
      setError("Erreur lors de la récupération des fournisseurs");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError("Le nom du fournisseur est obligatoire");
      return;
    }

    try {
      if (editingSupplier) {
        const supplierRef = doc(db, 'suppliers', editingSupplier.id);
        await updateDoc(supplierRef, {
          name,
          email,
          phone,
          address,
          description,
          updatedAt: new Date().toISOString()
        });

        setSuppliers(suppliers.map(supplier => 
          supplier.id === editingSupplier.id 
            ? { ...supplier, name, email, phone, address, description }
            : supplier
        ));
        setSuccess('Fournisseur mis à jour avec succès');
      } else {
        const suppliersRef = collection(db, 'suppliers');
        const docRef = await addDoc(suppliersRef, {
          name,
          email,
          phone,
          address,
          description,
          userId: user?.uid,
          createdAt: new Date().toISOString()
        });

        const newSupplier = {
          id: docRef.id,
          name,
          email,
          phone,
          address,
          description,
          userId: user?.uid || ''
        };
        
        setSuppliers([...suppliers, newSupplier]);
        setSuccess('Fournisseur ajouté avec succès');
      }

      // Reset form
      handleCancelEdit();
    } catch (err) {
      console.error("Erreur lors de l'opération sur le fournisseur:", err);
      setError("Erreur lors de l'opération sur le fournisseur");
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setName(supplier.name);
    setEmail(supplier.email || '');
    setPhone(supplier.phone || '');
    setAddress(supplier.address || '');
    setDescription(supplier.description || '');
    setError('');
    setSuccess('');
  };

  const handleCancelEdit = () => {
    setEditingSupplier(null);
    setName('');
    setEmail('');
    setPhone('');
    setAddress('');
    setDescription('');
    setError('');
    setSuccess('');
  };

  const handleDelete = async (supplierId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) return;
    
    try {
      await deleteDoc(doc(db, 'suppliers', supplierId));
      setSuppliers(suppliers.filter(supplier => supplier.id !== supplierId));
      setSuccess('Fournisseur supprimé avec succès');
    } catch (err) {
      console.error("Erreur lors de la suppression du fournisseur:", err);
      setError("Erreur lors de la suppression du fournisseur");
    }
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(searchTermLower) ||
      supplier.email.toLowerCase().includes(searchTermLower) ||
      supplier.phone.toLowerCase().includes(searchTermLower) ||
      supplier.address.toLowerCase().includes(searchTermLower) ||
      supplier.description.toLowerCase().includes(searchTermLower)
    );
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Gestion des Fournisseurs</h2>

      <form onSubmit={handleSubmit} className="mb-8 bg-white rounded-lg shadow-lg p-8">
        {error && (
          <div className="mb-6 flex items-center bg-red-50 border-l-4 border-red-400 p-4 rounded-r" role="alert">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-r" role="alert">
            <span className="text-green-700">{success}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du fournisseur <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              placeholder="Nom du fournisseur"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
              <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              placeholder="email@exemple.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Téléphone
              <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              placeholder="+237 6XX XX XX XX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Adresse
              <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              placeholder="Adresse du fournisseur"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
              <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
              placeholder="Description ou notes sur le fournisseur"
              rows={3}
            />
          </div>
        </div>

        <div className="mt-6 flex space-x-4">
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {editingSupplier ? (
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
          {editingSupplier && (
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
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un fournisseur..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adresse</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredSuppliers.map((supplier) => (
              <tr key={supplier.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{supplier.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.email || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.phone || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.address || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.description || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleEdit(supplier)}
                    className="text-blue-600 hover:text-blue-900 mr-4"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredSuppliers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  {searchTerm ? 'Aucun fournisseur ne correspond à votre recherche' : 'Aucun fournisseur n\'a été créé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}