import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { Shield, UserX, Search, Edit2 } from 'lucide-react';

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

  const filteredUsers = users.filter(user => {
    const searchTermLower = searchTerm.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchTermLower) ||
      (user.displayName && user.displayName.toLowerCase().includes(searchTermLower))
    );
  });

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
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un utilisateur..."
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
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date de création</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredUsers.map((user) => (
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
    </div>
  );
}