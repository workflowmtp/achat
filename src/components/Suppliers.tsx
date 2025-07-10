import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, AlertCircle, Pencil, X, Save, Search, ChevronLeft, ChevronRight, ArrowDown, ArrowUp } from 'lucide-react';
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
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  // Sorting
  const [sortField, setSortField] = useState<keyof Supplier>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchSuppliers = useCallback(async () => {
    if (!user) return;

    try {
      const suppliersRef = collection(db, 'suppliers');
      const snapshot = await getDocs(suppliersRef);
      const suppliersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Supplier[];
      
      // Vérifier si l'utilisateur a accès aux dépenses
      const hasExpensesAccess = localStorage.getItem('accessExpenses') === 'true';
      
      // Si admin ou utilisateur avec accès aux dépenses, afficher tous les fournisseurs, sinon filtrer par userId
      const filteredSuppliers = (isAdmin || hasExpensesAccess)
        ? suppliersList 
        : suppliersList.filter(supplier => supplier.userId === user.uid);
        
      console.log('Affichage des fournisseurs pour utilisateur avec accès aux dépenses:', hasExpensesAccess);
        
      setSuppliers(filteredSuppliers);
    } catch (err) {
      console.error("Erreur lors de la récupération des fournisseurs:", err);
      setError("Erreur lors de la récupération des fournisseurs");
    }
  }, [user, isAdmin]);
  
  useEffect(() => {
    if (user) {
      fetchSuppliers();
    }
  }, [user, fetchSuppliers]);

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
      setEditingSupplier(null);
      setName('');
      setEmail('');
      setPhone('');
      setAddress('');
      setDescription('');
      setShowModal(false);
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
    setShowModal(true);
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
    setShowModal(false);
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

  // Filtrer les fournisseurs selon le terme de recherche
  const filteredSuppliers = suppliers.filter(supplier => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(searchTermLower) ||
      (supplier.email && supplier.email.toLowerCase().includes(searchTermLower)) ||
      (supplier.phone && supplier.phone.toLowerCase().includes(searchTermLower)) ||
      (supplier.address && supplier.address.toLowerCase().includes(searchTermLower)) ||
      (supplier.description && supplier.description.toLowerCase().includes(searchTermLower))
    );
  });
  
  // Trier les fournisseurs
  const sortedSuppliers = [...filteredSuppliers].sort((a, b) => {
    const fieldA = a[sortField] || '';
    const fieldB = b[sortField] || '';
    
    if (sortDirection === 'asc') {
      return fieldA.localeCompare(fieldB);
    } else {
      return fieldB.localeCompare(fieldA);
    }
  });
  
  // Calculer les indices pour la pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = sortedSuppliers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(sortedSuppliers.length / itemsPerPage);
  
  // Fonction pour changer de page
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);
  
  // Fonction pour changer le tri
  const handleSort = (field: keyof Supplier) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Générer les numéros de page pour la pagination
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    pageNumbers.push(i);
  }
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Gestion des Fournisseurs</h2>

      <div className="mb-4 flex justify-between items-center">
        <button
          onClick={() => {
            setEditingSupplier(null);
            setName('');
            setEmail('');
            setPhone('');
            setAddress('');
            setDescription('');
            setError('');
            setSuccess('');
            setShowModal(true);
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un fournisseur
        </button>
      </div>

      {/* Modal pour le formulaire */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {editingSupplier ? 'Modifier le fournisseur' : 'Ajouter un nouveau fournisseur'}
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
                      rows={3}
                      className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="Description du fournisseur"
                    />
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
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full md:w-1/2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher par nom, email, téléphone..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-blue-50"
            />
            <Search className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
          </div>
          
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <span className="text-sm text-gray-600">Afficher</span>
            <select 
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1); // Revenir à la première page lors du changement
              }}
              className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span className="text-sm text-gray-600">par page</span>
          </div>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  Nom
                  {sortField === 'name' && (
                    sortDirection === 'asc' ? 
                    <ArrowUp className="h-4 w-4 ml-1" /> : 
                    <ArrowDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('email')}
              >
                <div className="flex items-center">
                  Email
                  {sortField === 'email' && (
                    sortDirection === 'asc' ? 
                    <ArrowUp className="h-4 w-4 ml-1" /> : 
                    <ArrowDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('phone')}
              >
                <div className="flex items-center">
                  Téléphone
                  {sortField === 'phone' && (
                    sortDirection === 'asc' ? 
                    <ArrowUp className="h-4 w-4 ml-1" /> : 
                    <ArrowDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('address')}
              >
                <div className="flex items-center">
                  Adresse
                  {sortField === 'address' && (
                    sortDirection === 'asc' ? 
                    <ArrowUp className="h-4 w-4 ml-1" /> : 
                    <ArrowDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  {searchTerm ? 'Aucun fournisseur trouvé pour cette recherche.' : 'Aucun fournisseur disponible.'}
                </td>
              </tr>
            ) : (
              currentItems.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{supplier.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{supplier.email || '—'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{supplier.phone || '—'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{supplier.address || '—'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => handleEdit(supplier)}
                      className="text-blue-600 hover:text-blue-900 focus:outline-none"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(supplier.id)}
                      className="text-red-600 hover:text-red-900 focus:outline-none ml-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        {filteredSuppliers.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between">
            <div className="text-sm text-gray-700 mb-2 sm:mb-0">
              Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, filteredSuppliers.length)} sur {filteredSuppliers.length} fournisseurs
            </div>
            
            <div className="flex space-x-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center px-2 py-2 rounded-md border ${
                  currentPage === 1 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-white text-gray-500 hover:bg-blue-50'
                } text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              {pageNumbers.map(number => (
                <button
                  key={number}
                  onClick={() => paginate(number)}
                  className={`relative inline-flex items-center px-4 py-2 rounded-md border ${
                    currentPage === number
                    ? 'z-10 bg-blue-600 text-white'
                    : 'bg-white text-gray-500 hover:bg-blue-50'
                  } text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
                >
                  {number}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center px-2 py-2 rounded-md border ${
                  currentPage === totalPages 
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                  : 'bg-white text-gray-500 hover:bg-blue-50'
                } text-sm font-medium focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500`}
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
