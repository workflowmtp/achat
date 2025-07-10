import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { Shield, UserX, Search, Edit2, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';

interface User {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  role?: string;
  createdAt: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const { user: currentUser } = useAuth();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const auth = getAuth();
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  // Sorting
  const [sortField, setSortField] = useState<keyof User>('displayName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Liste des rôles disponibles
  const availableRoles = [
    { id: '', label: 'Aucun rôle spécifique' },
    { id: 'cash_inflow', label: 'Gestion des entrées' },
    { id: 'expenses', label: 'Gestion des dépenses' },
    { id: 'inventory', label: 'Gestion des inventaires' },
    { id: 'projects', label: 'Gestion des projets' }
  ];

  useEffect(() => {
    if (currentUser && isAdmin) {
      fetchUsers();
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      // Get users from Firestore only
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      
      const firestoreUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || '',
        displayName: doc.data().displayName || '',
        isAdmin: doc.data().isAdmin || false,
        role: doc.data().role || '',
        createdAt: doc.data().createdAt || new Date().toISOString()
      }));

      setUsers(firestoreUsers);
    } catch (error) {
      console.error('Erreur lors de la récupération des utilisateurs:', error);
      setError('Erreur lors de la récupération des utilisateurs');
    }
  };

  const handleToggleAdmin = async (userId: string, isCurrentlyAdmin: boolean) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        isAdmin: !isCurrentlyAdmin,
        updatedAt: new Date().toISOString()
      });

      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, isAdmin: !isCurrentlyAdmin }
          : user
      ));

      setSuccess(`Droits d'administrateur ${!isCurrentlyAdmin ? 'accordés' : 'retirés'} avec succès`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la modification des droits:', error);
      setError('Erreur lors de la modification des droits');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ? Cette action est irréversible.')) {
      return;
    }

    try {
      // Delete from Firestore only
      await deleteDoc(doc(db, 'users', userId));
      
      setUsers(users.filter(user => user.id !== userId));
      setSuccess('Utilisateur supprimé avec succès');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la suppression de l\'utilisateur:', error);
      setError('Erreur lors de la suppression de l\'utilisateur');
    }
  };

  const handleEditRole = (userId: string, currentRole: string = '') => {
    setEditingUserId(userId);
    setSelectedRole(currentRole);
  };

  const handleSaveRole = async (userId: string) => {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: selectedRole,
        updatedAt: new Date().toISOString()
      });

      setUsers(users.map(user => 
        user.id === userId 
          ? { ...user, role: selectedRole }
          : user
      ));

      setSuccess('Rôle mis à jour avec succès');
      setEditingUserId(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Erreur lors de la modification du rôle:', error);
      setError('Erreur lors de la modification du rôle');
    }
  };

  const cancelEditRole = () => {
    setEditingUserId(null);
    setSelectedRole('');
  };

  // Filtrage, tri et pagination
  const filteredUsers = useMemo(() => {
    // Filtrage par recherche
    let result = [...users];
    
    if (searchTerm) {
      const searchTermLower = searchTerm.toLowerCase();
      result = result.filter(user => {
        return (
          user.email.toLowerCase().includes(searchTermLower) ||
          (user.displayName && user.displayName.toLowerCase().includes(searchTermLower))
        );
      });
    }
    
    // Tri
    result.sort((a, b) => {
      let fieldA: any = a[sortField];
      let fieldB: any = b[sortField];
      
      // Gestion des valeurs nulles ou undefined
      if (fieldA === undefined || fieldA === null) fieldA = '';
      if (fieldB === undefined || fieldB === null) fieldB = '';
      
      // Convertir en chaîne pour la comparaison
      fieldA = String(fieldA).toLowerCase();
      fieldB = String(fieldB).toLowerCase();
      
      if (sortDirection === 'asc') {
        return fieldA.localeCompare(fieldB);
      } else {
        return fieldB.localeCompare(fieldA);
      }
    });
    
    return result;
  }, [users, searchTerm, sortField, sortDirection]);
  
  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  
  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages]);
  
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredUsers.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredUsers, currentPage, itemsPerPage]);

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Accès non autorisé. Cette section est réservée aux administrateurs.</p>
      </div>
    );
  }

  const getRoleLabel = (roleId: string) => {
    const role = availableRoles.find(r => r.id === roleId);
    return role ? role.label : 'Aucun rôle';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Gestion des Utilisateurs</h2>

      {error && (
        <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-r" role="alert">
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border-l-4 border-green-400 p-4 rounded-r" role="alert">
          <span className="text-green-700">{success}</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="relative flex-grow mr-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher un utilisateur..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            </div>
            <div>
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
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'displayName') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('displayName');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Nom
                  {sortField === 'displayName' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'email') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('email');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Email
                  {sortField === 'email' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'role') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('role');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Rôle
                  {sortField === 'role' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'createdAt') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('createdAt');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Date de création
                  {sortField === 'createdAt' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'isAdmin') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('isAdmin');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center justify-center">
                  Statut
                  {sortField === 'isAdmin' && (
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
            {paginatedUsers.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {user.displayName || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {editingUserId === user.id ? (
                    <div className="flex items-center space-x-2">
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 px-2 py-1 text-sm"
                      >
                        {availableRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSaveRole(user.id)}
                        className="p-1 text-green-600 hover:text-green-900"
                        title="Enregistrer"
                      >
                        ✓
                      </button>
                      <button
                        onClick={cancelEditRole}
                        className="p-1 text-red-600 hover:text-red-900"
                        title="Annuler"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span>{getRoleLabel(user.role || '')}</span>
                      <button
                        onClick={() => handleEditRole(user.id, user.role)}
                        className="p-1 text-blue-600 hover:text-blue-900 ml-2"
                        title="Modifier le rôle"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.isAdmin 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.isAdmin ? 'Administrateur' : 'Utilisateur'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                  <button
                    onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                    className={`text-blue-600 hover:text-blue-900 ${
                      user.isAdmin ? 'hover:text-red-600' : 'hover:text-green-600'
                    }`}
                    title={user.isAdmin ? 'Retirer les droits admin' : 'Donner les droits admin'}
                  >
                    <Shield className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="text-red-600 hover:text-red-900"
                    title="Supprimer l'utilisateur"
                  >
                    <UserX className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  {searchTerm ? 'Aucun utilisateur ne correspond à votre recherche' : 'Aucun utilisateur trouvé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {filteredUsers.length > 0 && (
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
                Affichage de <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> à <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> sur <span className="font-medium">{filteredUsers.length}</span> utilisateurs
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
                {pageNumbers.map((number) => (
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