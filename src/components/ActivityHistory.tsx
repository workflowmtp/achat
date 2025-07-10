import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { Filter, Eye, X } from 'lucide-react';
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
  entityData: any;
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
  
  // États pour la pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);
  const [searchTerm, setSearchTerm] = useState<string>('');
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
  
  // Contexte d'authentification utilisé pour la vérification des droits
  useAuth();
  
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
      console.log('Accès non autorisé à l\'historique des activités - utilisateur non admin');
      setError('Accès non autorisé');
      setLoading(false);
      return;
    }
    
    try {
      console.log('Début du chargement des logs d\'activité');
      setLoading(true);
      const logsRef = query(
        collection(db, 'activity_logs'),
        orderBy('timestamp', 'desc')
      );
      
      console.log('Requête Firestore préparée pour collection activity_logs');
      const snapshot = await getDocs(logsRef);
      console.log(`Nombre de documents récupérés: ${snapshot.docs.length}`);
      
      const logsList = snapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`Log trouvé - ID: ${doc.id}, Type: ${data.activityType}, Entité: ${data.entityType}, Date: ${data.timestamp}`);
        return {
          ...data,
          id: doc.id
        };
      }) as ActivityLog[];
      
      // Compter les types d'activités
      const activityTypeCounts = logsList.reduce((acc, log) => {
        const key = `${log.activityType}_${log.entityType}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('Statistiques des logs récupérés:', activityTypeCounts);
      
      // Vérifier spécifiquement les logs de mise à jour de dépenses
      const updateExpenseLogs = logsList.filter(
        log => log.activityType === ActivityType.UPDATE && log.entityType === EntityType.EXPENSE
      );
      console.log(`Nombre de logs de mise à jour de dépenses: ${updateExpenseLogs.length}`);
      if (updateExpenseLogs.length > 0) {
        console.log('Exemple de log de mise à jour de dépense:', updateExpenseLogs[0]);
      }
      
      setActivityLogs(logsList);
      setFilteredLogs(logsList);
      setLoading(false);
      console.log('Chargement des logs terminé avec succès');
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
    
    // Filtre par terme de recherche
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.userName?.toLowerCase().includes(term) ||
        log.details?.toLowerCase().includes(term) ||
        log.projectName?.toLowerCase().includes(term) ||
        (log.entityData && typeof log.entityData === 'object' && 
          Object.values(log.entityData).some(value => 
            typeof value === 'string' && value.toLowerCase().includes(term)
          )
        )
      );
    }
    
    // Filtre par date
    if (startDate) {
      filtered = filtered.filter(log => log.timestamp >= startDate);
    }
    
    if (endDate) {
      filtered = filtered.filter(log => log.timestamp <= endDate);
    }
    
    // Tri des résultats
    filtered.sort((a, b) => {
      if (sortField === 'timestamp') {
        return sortDirection === 'asc' 
          ? a.timestamp.localeCompare(b.timestamp) 
          : b.timestamp.localeCompare(a.timestamp);
      }
      return 0;
    });
    
    setFilteredLogs(filtered);
  }, [activityLogs, selectedProject, selectedUser, selectedEntityType, selectedActivityType, startDate, endDate, sortField, sortDirection, searchTerm]);
  
  // Fonction pour trier les logs
  const handleSort = (field: string) => {
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
  }, [fetchProjects, fetchUsers, fetchActivityLogs, isAdmin]);
  
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
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Historique des activités</h2>
      
      {/* Filtres */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-500 mr-2" />
          <h3 className="font-medium">Filtres</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Filtre par projet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projet</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous les projets</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          
          {/* Filtre par utilisateur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Utilisateur</label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous les utilisateurs</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.displayName}</option>
              ))}
            </select>
          </div>
          
          {/* Filtre par type d'entité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type d'entité</label>
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous les types</option>
              <option value={EntityType.EXPENSE}>Dépense</option>
              <option value={EntityType.EXPENSE_ITEM}>Item de dépense</option>
              <option value={EntityType.CASH_INFLOW}>Entrée de caisse</option>
              <option value={EntityType.PROJECT}>Projet</option>
              <option value={EntityType.SUPPLIER}>Fournisseur</option>
              <option value={EntityType.UNIT}>Unité</option>
              <option value={EntityType.USER}>Utilisateur</option>
              <option value={EntityType.CLOSURE}>Clôture</option>
            </select>
          </div>
          
          {/* Filtre par type d'activité */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type d'activité</label>
            <select
              value={selectedActivityType}
              onChange={(e) => setSelectedActivityType(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous les types</option>
              <option value={ActivityType.CREATE}>Création</option>
              <option value={ActivityType.UPDATE}>Modification</option>
              <option value={ActivityType.DELETE}>Suppression</option>
            </select>
          </div>
          
          {/* Filtre par date de début */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Filtre par date de fin */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        
        {/* Champ de recherche */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Recherche</label>
          <div className="flex">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher dans l'historique..."
              className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={() => setSearchTerm('')}
              className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              setSelectedProject('');
              setSelectedUser('');
              setSelectedEntityType('');
              setSelectedActivityType('');
              setStartDate('');
              setEndDate('');
              setSortField('timestamp');
              setSortDirection('desc');
              setSearchTerm('');
              setCurrentPage(1);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Réinitialiser les filtres
          </button>
        </div>
      </div>
      
      {/* Tableau des logs */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-4 text-center">
            <p>Chargement des données...</p>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">
            <p>{error}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-4 text-center">
            <p>Aucune activité trouvée.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('timestamp')}
                  >
                    Date/Heure
                    {sortField === 'timestamp' && (
                      <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Utilisateur
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entité
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Détails
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map(log => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.userName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.activityType === ActivityType.CREATE && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Création
                        </span>
                      )}
                      {log.activityType === ActivityType.UPDATE && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                          Modification
                        </span>
                      )}
                      {log.activityType === ActivityType.DELETE && (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          Suppression
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.entityType === EntityType.EXPENSE && 'Dépense'}
                      {log.entityType === EntityType.EXPENSE_ITEM && 'Item de dépense'}
                      {log.entityType === EntityType.CASH_INFLOW && 'Entrée de caisse'}
                      {log.entityType === EntityType.PROJECT && 'Projet'}
                      {log.entityType === EntityType.SUPPLIER && 'Fournisseur'}
                      {log.entityType === EntityType.UNIT && 'Unité'}
                      {log.entityType === EntityType.USER && 'Utilisateur'}
                      {log.entityType === EntityType.CLOSURE && 'Clôture'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.details || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-900 mr-2"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Contrôles de pagination */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm text-gray-700 mr-2">
                  Afficher
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-sm text-gray-700 ml-2">
                  éléments par page
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">
                  Page {currentPage} sur {Math.ceil(filteredLogs.length / itemsPerPage)}
                </span>
                <div className="flex space-x-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 border rounded ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredLogs.length / itemsPerPage)))}
                    disabled={currentPage >= Math.ceil(filteredLogs.length / itemsPerPage)}
                    className={`px-3 py-1 border rounded ${currentPage >= Math.ceil(filteredLogs.length / itemsPerPage) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal pour afficher les détails d'un log */}
      {selectedLog && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-medium">
                Détails de l'activité
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Date/Heure</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {format(new Date(selectedLog.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Utilisateur</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedLog.userName}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Type d'activité</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {selectedLog.activityType === ActivityType.CREATE && 'Création'}
                    {selectedLog.activityType === ActivityType.UPDATE && 'Modification'}
                    {selectedLog.activityType === ActivityType.DELETE && 'Suppression'}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Type d'entité</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {selectedLog.entityType === EntityType.EXPENSE && 'Dépense'}
                    {selectedLog.entityType === EntityType.EXPENSE_ITEM && 'Item de dépense'}
                    {selectedLog.entityType === EntityType.CASH_INFLOW && 'Entrée de caisse'}
                    {selectedLog.entityType === EntityType.PROJECT && 'Projet'}
                    {selectedLog.entityType === EntityType.SUPPLIER && 'Fournisseur'}
                    {selectedLog.entityType === EntityType.UNIT && 'Unité'}
                    {selectedLog.entityType === EntityType.USER && 'Utilisateur'}
                    {selectedLog.entityType === EntityType.CLOSURE && 'Clôture'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Détails</dt>
                  <dd className="mt-1 text-sm text-gray-900">{selectedLog.details || '-'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Détails des articles</dt>
                  <dd className="mt-1 text-sm text-gray-900 bg-gray-50 p-4 rounded overflow-auto max-h-60">
                    {selectedLog.entityType === EntityType.EXPENSE_ITEM ? (
                      <div className="border rounded-md p-3 bg-white">
                        <h4 className="font-medium mb-2">Article de dépense</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500">Désignation:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.designation || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Référence:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.reference || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Quantité:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.quantity || '0'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Unité:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.unit || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Prix unitaire:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.unitPrice?.toLocaleString('fr-FR') || '0'} FCFA</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Fournisseur:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.supplier || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Montant total:</span>
                            <span className="ml-2 font-medium">
                              {(selectedLog.entityData?.unitPrice * selectedLog.entityData?.quantity)?.toLocaleString('fr-FR') || '0'} FCFA
                            </span>
                          </div>
                          {selectedLog.entityData?.beneficiary && (
                            <div>
                              <span className="text-gray-500">Bénéficiaire:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.beneficiary}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : selectedLog.entityType === EntityType.EXPENSE && selectedLog.entityData?.items?.length > 0 ? (
                      <div>
                        <h4 className="font-medium mb-2">Dépense: {selectedLog.entityData?.reference || '-'}</h4>
                        <p className="mb-2"><span className="text-gray-500">Description:</span> {selectedLog.entityData?.description || '-'}</p>
                        <p className="mb-3"><span className="text-gray-500">Date:</span> {selectedLog.entityData?.date ? format(new Date(selectedLog.entityData.date), 'dd/MM/yyyy') : '-'}</p>
                        
                        <h5 className="font-medium mb-2">Articles:</h5>
                        <div className="space-y-3">
                          {selectedLog.entityData.items.map((item: { designation?: string; reference?: string; quantity?: number; unitPrice?: number; beneficiary?: string }, index: number) => (
                            <div key={index} className="border rounded-md p-2 bg-white">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <span className="text-gray-500">Désignation:</span>
                                  <span className="ml-2 font-medium">{item.designation || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Référence:</span>
                                  <span className="ml-2 font-medium">{item.reference || '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Quantité:</span>
                                  <span className="ml-2 font-medium">{item.quantity || '0'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Prix unitaire:</span>
                                  <span className="ml-2 font-medium">{item.unitPrice?.toLocaleString('fr-FR') || '0'} FCFA</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">Montant:</span>
                                  <span className="ml-2 font-medium">
                                    {((item.unitPrice || 0) * (item.quantity || 0)).toLocaleString('fr-FR')} FCFA
                                  </span>
                                </div>
                                {item.beneficiary && (
                                  <div>
                                    <span className="text-gray-500">Bénéficiaire:</span>
                                    <span className="ml-2 font-medium">{item.beneficiary}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-3 font-medium text-right">
                          <span className="text-gray-500">Montant total:</span>
                          <span className="ml-2">
                            {selectedLog.entityData.items.reduce((sum: number, item: { unitPrice?: number; quantity?: number }) => 
                              sum + ((item.unitPrice || 0) * (item.quantity || 0)), 0).toLocaleString('fr-FR')} FCFA
                          </span>
                        </div>
                      </div>
                    ) : selectedLog.entityType === EntityType.CASH_INFLOW ? (
                      <div className="border rounded-md p-3 bg-white">
                        <h4 className="font-medium mb-2">Entrée de caisse</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500">Montant:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.amount?.toLocaleString('fr-FR') || '0'} FCFA</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Date:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.date ? format(new Date(selectedLog.entityData.date), 'dd/MM/yyyy') : '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Source:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.source || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Description:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.description || '-'}</span>
                          </div>
                        </div>
                      </div>
                    ) : selectedLog.entityType === EntityType.PROJECT ? (
                      <div className="border rounded-md p-3 bg-white">
                        <h4 className="font-medium mb-2">Projet</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500">Nom du projet:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.name || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Identifiant:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.id || '-'}</span>
                          </div>
                          {selectedLog.entityData?.description && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Description:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.description}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.budget && (
                            <div>
                              <span className="text-gray-500">Budget:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.budget.toLocaleString('fr-FR')} FCFA</span>
                            </div>
                          )}
                          {selectedLog.entityData?.startDate && (
                            <div>
                              <span className="text-gray-500">Date de début:</span>
                              <span className="ml-2 font-medium">{format(new Date(selectedLog.entityData.startDate), 'dd/MM/yyyy')}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.endDate && (
                            <div>
                              <span className="text-gray-500">Date de fin:</span>
                              <span className="ml-2 font-medium">{format(new Date(selectedLog.entityData.endDate), 'dd/MM/yyyy')}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.status && (
                            <div>
                              <span className="text-gray-500">Statut:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.status}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : selectedLog.entityType === EntityType.SUPPLIER ? (
                      <div className="border rounded-md p-3 bg-white">
                        <h4 className="font-medium mb-2">Fournisseur</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500">Nom:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.name || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Identifiant:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.id || '-'}</span>
                          </div>
                          {selectedLog.entityData?.contact && (
                            <div>
                              <span className="text-gray-500">Contact:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.contact}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.email && (
                            <div>
                              <span className="text-gray-500">Email:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.email}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.phone && (
                            <div>
                              <span className="text-gray-500">Téléphone:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.phone}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.address && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Adresse:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : selectedLog.entityType === EntityType.UNIT ? (
                      <div className="border rounded-md p-3 bg-white">
                        <h4 className="font-medium mb-2">Unité</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500">Nom:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.name || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Identifiant:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.id || '-'}</span>
                          </div>
                          {selectedLog.entityData?.abbreviation && (
                            <div>
                              <span className="text-gray-500">Abréviation:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.abbreviation}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.description && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Description:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.description}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : selectedLog.entityType === EntityType.USER ? (
                      <div className="border rounded-md p-3 bg-white">
                        <h4 className="font-medium mb-2">Utilisateur</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500">Nom d'utilisateur:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.displayName || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Identifiant:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.id || '-'}</span>
                          </div>
                          {selectedLog.entityData?.email && (
                            <div>
                              <span className="text-gray-500">Email:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.email}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.role && (
                            <div>
                              <span className="text-gray-500">Rôle:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.role}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.createdAt && (
                            <div>
                              <span className="text-gray-500">Créé le:</span>
                              <span className="ml-2 font-medium">{format(new Date(selectedLog.entityData.createdAt), 'dd/MM/yyyy HH:mm')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : selectedLog.entityType === EntityType.CLOSURE ? (
                      <div className="border rounded-md p-3 bg-white">
                        <h4 className="font-medium mb-2">Clôture</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-gray-500">Période:</span>
                            <span className="ml-2 font-medium">{selectedLog.entityData?.period || '-'}</span>
                          </div>
                          {selectedLog.entityData?.date && (
                            <div>
                              <span className="text-gray-500">Date de clôture:</span>
                              <span className="ml-2 font-medium">{format(new Date(selectedLog.entityData.date), 'dd/MM/yyyy')}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.closedBy && (
                            <div>
                              <span className="text-gray-500">Clôturé par:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.closedBy}</span>
                            </div>
                          )}
                          {selectedLog.entityData?.totalExpenses !== undefined && (
                            <div>
                              <span className="text-gray-500">Total des dépenses:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.totalExpenses.toLocaleString('fr-FR')} FCFA</span>
                            </div>
                          )}
                          {selectedLog.entityData?.totalInflows !== undefined && (
                            <div>
                              <span className="text-gray-500">Total des entrées:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.totalInflows.toLocaleString('fr-FR')} FCFA</span>
                            </div>
                          )}
                          {selectedLog.entityData?.notes && (
                            <div className="col-span-2">
                              <span className="text-gray-500">Notes:</span>
                              <span className="ml-2 font-medium">{selectedLog.entityData.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white p-3 rounded border">
                        <p className="text-sm text-gray-500 mb-2">Données brutes de l'entité:</p>
                        <pre className="text-xs">{JSON.stringify(selectedLog.entityData, null, 2)}</pre>
                      </div>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivityHistory;
