import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { Download, Filter, Eye, X } from 'lucide-react';
import { ActivityType, EntityType } from '../utils/activityLogger';

// Interface pour les logs d'activité
interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  activityType: ActivityType;
  entityType: EntityType;
  entityId: string;
  entityData: Record<string, unknown>;
  details?: string;
  projectId?: string;
  projectName?: string;
}

// Interface pour les projets
interface Project {
  id: string;
  name: string;
}

// Interface pour les utilisateurs
interface User {
  id: string;
  displayName: string;
  email: string;
}

const ActivityHistory: React.FC = () => {
  // États pour les données
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  // États pour les filtres
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('');
  const [selectedActivityType, setSelectedActivityType] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // États pour le tri
  const [sortField, setSortField] = useState<string>('timestamp');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // États pour l'affichage des détails
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  
  // États pour le chargement et les erreurs
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const { user: currentUser } = useAuth();
  
  // Vérification des droits d'administration
  const userRole = localStorage.getItem('userRole') || '';
  const isAdmin = localStorage.getItem('isAdmin') === 'true' || userRole === 'admin';
  
  // Fonction pour charger les projets
  const fetchProjects = useCallback(async () => {
    try {
      const projectsRef = collection(db, 'projects');
      const snapshot = await getDocs(projectsRef);
      const projectsList = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      }));
      setProjects(projectsList);
    } catch (error) {
      console.error('Erreur lors du chargement des projets:', error);
      setError('Erreur lors du chargement des projets');
    }
  }, []);
  
  // Fonction pour charger les utilisateurs
  const fetchUsers = useCallback(async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const usersList = snapshot.docs.map(doc => ({
        id: doc.id,
        displayName: doc.data().displayName || doc.data().email,
        email: doc.data().email
      }));
      setUsers(usersList);
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
      setError('Erreur lors du chargement des utilisateurs');
    }
  }, []);
  
  // Fonction pour charger les logs d'activité
  const fetchActivityLogs = useCallback(async () => {
    if (!isAdmin) {
      setError('Accès non autorisé');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const logsRef = query(
        collection(db, 'activity_logs'),
        orderBy('timestamp', 'desc')
      );
      
      const snapshot = await getDocs(logsRef);
      const logsList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as ActivityLog[];
      
      setActivityLogs(logsList);
      setFilteredLogs(logsList);
      setLoading(false);
    } catch (error) {
      console.error('Erreur lors du chargement des logs d\'activité:', error);
      setError('Erreur lors du chargement des logs d\'activité');
      setLoading(false);
    }
  }, [isAdmin]);
  
  // Fonction pour appliquer les filtres
  const applyFilters = useCallback(() => {
    let filtered = [...activityLogs];
    
    // Filtre par projet
    if (selectedProject) {
      filtered = filtered.filter(log => log.projectId === selectedProject);
    }
    
    // Filtre par utilisateur
    if (selectedUser) {
      filtered = filtered.filter(log => log.userId === selectedUser);
    }
    
    // Filtre par type d'entité
    if (selectedEntityType) {
      filtered = filtered.filter(log => log.entityType === selectedEntityType);
    }
    
    // Filtre par type d'activité
    if (selectedActivityType) {
      filtered = filtered.filter(log => log.activityType === selectedActivityType);
    }
    
    // Filtre par date de début
    if (startDate) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        const filterDate = new Date(startDate);
        return logDate >= filterDate;
      });
    }
    
    // Filtre par date de fin
    if (endDate) {
      filtered = filtered.filter(log => {
        const logDate = new Date(log.timestamp);
        const filterDate = new Date(endDate);
        filterDate.setHours(23, 59, 59, 999); // Fin de journée
        return logDate <= filterDate;
      });
    }
    
    // Appliquer le tri
    filtered.sort((a, b) => {
      const valueA = a[sortField as keyof ActivityLog];
      const valueB = b[sortField as keyof ActivityLog];
      
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB) 
          : valueB.localeCompare(valueA);
      }
      
      // Par défaut, tri par date
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });
    
    setFilteredLogs(filtered);
  }, [activityLogs, selectedProject, selectedUser, selectedEntityType, 
      selectedActivityType, startDate, endDate, sortField, sortDirection]);
  
  // Fonction pour exporter les logs en CSV
  const exportToCSV = () => {
    const headers = [
      'Date', 'Utilisateur', 'Type d\'activité', 'Type d\'entité', 
      'ID Entité', 'Détails', 'Projet'
    ];
    
    const csvRows = [
      headers.join(','),
      ...filteredLogs.map(log => {
        const timestamp = format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss');
        const values = [
          timestamp,
          log.userName,
          log.activityType,
          log.entityType,
          log.entityId,
          log.details?.replace(/,/g, ';'),
          log.projectName
        ];
        return values.join(',');
      })
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `activity_logs_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Fonction pour afficher les détails d'un log
  const viewLogDetails = (log: ActivityLog) => {
    setSelectedLog(log);
  };
  
  // Fonction pour fermer la vue détaillée
  const closeDetails = () => {
    setSelectedLog(null);
  };
  
  // Fonction pour changer le tri
  const handleSortChange = (field: string) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // Effet pour charger les données initiales
  useEffect(() => {
    if (isAdmin) {
      fetchProjects();
      fetchUsers();
      fetchActivityLogs();
    }
  }, [isAdmin, fetchProjects, fetchUsers, fetchActivityLogs]);
  
  // Effet pour appliquer les filtres lorsque les critères changent
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);
  
  // Rendu conditionnel si l'utilisateur n'est pas admin
  if (!isAdmin) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Historique des activités</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>Vous n'avez pas les droits nécessaires pour accéder à cette page.</p>
        </div>
      </div>
    );
  }
  
  // Rendu conditionnel pendant le chargement
  if (loading) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Historique des activités</h2>
        <div className="flex items-center justify-center p-8">
          <p>Chargement en cours...</p>
        </div>
      </div>
    );
  }
  
  // Rendu conditionnel en cas d'erreur
  if (error) {
    return (
      <div className="p-4">
        <h2 className="text-xl font-bold mb-4">Historique des activités</h2>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  // Rendu de la vue détaillée d'un log
  if (selectedLog) {
    const timestamp = format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss');
    return (
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Détails de l'activité</h2>
          <button 
            onClick={closeDetails}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded inline-flex items-center"
          >
            <X size={16} className="mr-2" />
            Fermer
          </button>
        </div>
        
        <div className="bg-white shadow-md rounded p-4 mb-4">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="font-bold">Date:</p>
              <p>{timestamp}</p>
            </div>
            <div>
              <p className="font-bold">Utilisateur:</p>
              <p>{selectedLog.userName}</p>
            </div>
            <div>
              <p className="font-bold">Type d'activité:</p>
              <p>{selectedLog.activityType}</p>
            </div>
            <div>
              <p className="font-bold">Type d'entité:</p>
              <p>{selectedLog.entityType}</p>
            </div>
            <div>
              <p className="font-bold">ID de l'entité:</p>
              <p>{selectedLog.entityId}</p>
            </div>
            <div>
              <p className="font-bold">Projet:</p>
              <p>{selectedLog.projectName || 'Non spécifié'}</p>
            </div>
          </div>
          
          <div className="mb-4">
            <p className="font-bold">Détails:</p>
            <p>{selectedLog.details || 'Aucun détail'}</p>
          </div>
          
          <div>
            <p className="font-bold">Données de l'entité:</p>
            <pre className="bg-gray-100 p-2 rounded overflow-auto max-h-96">
              {JSON.stringify(selectedLog.entityData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }
  
  // Rendu principal
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Historique des activités</h2>
      
      {/* Filtres */}
      <div className="bg-white shadow-md rounded p-4 mb-4">
        <div className="flex items-center mb-2">
          <Filter size={20} className="mr-2" />
          <h3 className="font-bold">Filtres</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projet</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">Tous les projets</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateur</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">Tous les utilisateurs</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.displayName || user.email}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type d'entité</label>
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">Tous les types</option>
              {Object.values(EntityType).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type d'activité</label>
            <select
              value={selectedActivityType}
              onChange={(e) => setSelectedActivityType(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="">Toutes les activités</option>
              {Object.values(ActivityType).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex justify-between mb-4">
        <div>
          <span className="text-sm text-gray-600">{filteredLogs.length} résultats</span>
        </div>
        <button
          onClick={exportToCSV}
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded inline-flex items-center"
        >
          <Download size={16} className="mr-2" />
          Exporter CSV
        </button>
      </div>
      
      {/* Tableau des logs */}
      <div className="bg-white shadow-md rounded overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('timestamp')}
              >
                Date {sortField === 'timestamp' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('userName')}
              >
                Utilisateur {sortField === 'userName' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('activityType')}
              >
                Action {sortField === 'activityType' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => handleSortChange('entityType')}
              >
                Entité {sortField === 'entityType' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Détails
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  Aucune activité trouvée avec les filtres actuels
                </td>
              </tr>
            ) : (
              filteredLogs.map(log => {
                const timestamp = format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm');
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{timestamp}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.userName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.activityType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{log.entityType}</td>
                    <td className="px-6 py-4 text-sm text-gray-900 truncate max-w-xs">{log.details}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => viewLogDetails(log)}
                        className="text-blue-600 hover:text-blue-900 inline-flex items-center"
                      >
                        <Eye size={16} className="mr-1" />
                        Détails
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ActivityHistory;
