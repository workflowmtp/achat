import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { format, isValid } from 'date-fns';
import { Plus, Trash2, AlertCircle, Pencil, X, Save, Search, BarChart, ChevronDown, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
// Navigation gérée par window.location.href

interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  userId: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showStatsMenu, setShowStatsMenu] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const { user } = useAuth();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  // Navigation directe via window.location.href
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  
  // Sorting
  const [sortField, setSortField] = useState<keyof Project>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const fetchProjects = useCallback(async () => {
    try {
      const projectsRef = collection(db, 'projects');
      let projectQuery;
      
      // Vérifier si l'utilisateur a accès aux entrées (Dep-1234)
      const hasEntriesAccess = localStorage.getItem('accessEntries') === 'true';
      
      if (isAdmin || hasEntriesAccess) {
        // Admin et utilisateurs avec accès aux entrées voient tous les projets
        projectQuery = query(projectsRef);
        console.log('Affichage de tous les projets pour admin ou utilisateur avec accès aux entrées');
      } else {
        // Les autres utilisateurs ne voient que leurs propres projets
        projectQuery = query(
          projectsRef,
          where('userId', '==', user?.uid)
        );
        console.log('Affichage uniquement des projets de l\'utilisateur:', user?.uid);
      }
      
      const snapshot = await getDocs(projectQuery);
      const projectsList = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || 'Sans nom',
          description: data.description || '',
          userId: data.userId || user?.uid || '',
          startDate: data.startDate || '',
          endDate: data.endDate || '',
          status: data.status || 'active'
        };
      }) as Project[];
      setProjects(projectsList);
    } catch (err) {
      console.error("Erreur lors de la récupération des projets:", err);
      setError("Erreur lors de la récupération des projets");
      // En cas d'erreur, définir une liste vide pour éviter les problèmes d'affichage
      setProjects([]);
    }
  }, [isAdmin, user]);

  // Appeler fetchProjects au chargement du composant
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const validateDates = () => {
    if (!startDate) {
      setError("La date de début est obligatoire");
      return false;
    }

    if (endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        setError("La date de fin doit être supérieure ou égale à la date de début");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError("Le nom du projet est obligatoire");
      return;
    }

    if (!validateDates()) {
      return;
    }

    try {
      if (editingProject) {
        const projectRef = doc(db, 'projects', editingProject.id);
        await updateDoc(projectRef, {
          name,
          description,
          startDate,
          ...(endDate ? { endDate } : {}),
          updatedAt: new Date().toISOString()
        });

        setProjects(projects.map(project => 
          project.id === editingProject.id 
            ? { ...project, name, description, startDate, endDate }
            : project
        ));
        setEditingProject(null);
      } else {
        const projectsRef = collection(db, 'projects');
        await addDoc(projectsRef, {
          name,
          description,
          startDate,
          ...(endDate ? { endDate } : {}),
          userId: user?.uid,
          createdAt: new Date().toISOString()
        });
        
        fetchProjects();
      }

      setName('');
      setDescription('');
      setStartDate(format(new Date(), 'yyyy-MM-dd'));
      setEndDate('');
      setShowModal(false);
    } catch (err) {
      console.error("Erreur lors de l'opération sur le projet:", err);
      setError("Erreur lors de l'opération sur le projet");
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setName(project.name);
    setDescription(project.description || '');
    setStartDate(project.startDate);
    setEndDate(project.endDate || '');
    setShowModal(true);
  };

  const handleCancelEdit = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate('');
    setError('');
    setShowModal(false);
  };

  const navigateToProjectStats = useCallback((projectId: string) => {
    console.log('Projects - Navigation vers les détails du projet', {
      id: projectId,
      method: 'window.location redirect',
      target: `/project-detail/${projectId}`,
      timestamp: new Date().toISOString()
    });
    
    // Débug: Vérifier que le projet existe avant de naviguer
    const checkProjectExists = async () => {
      try {
        const projectRef = doc(db, 'projects', projectId);
        const projectSnap = await getDoc(projectRef);
        
        console.log('Projects - Vérification de l\'existence du projet:', {
          id: projectId,
          exists: projectSnap.exists(),
          data: projectSnap.exists() ? projectSnap.data() : null
        });
        
        if (projectSnap.exists()) {
          // Le projet existe, procéder à la navigation
          console.log('Projects - Le projet existe dans Firestore, navigation en cours...');
          // Utiliser la nouvelle page HTML autonome pour les détails du projet
          const projectDetailUrl = `/project-details.html?id=${projectId}`;
          console.log('Redirection vers page HTML autonome:', projectDetailUrl);
          
          window.location.href = projectDetailUrl;
        } else {
          console.error('Projects - Le projet n\'existe pas dans Firestore, impossible de naviguer');
          alert('Erreur: Ce projet n\'existe pas ou a été supprimé');
        }
      } catch (error) {
        console.error('Projects - Erreur lors de la vérification de l\'existence du projet:', error);
        // Tenter la navigation malgré l'erreur avec la page HTML autonome
        const projectDetailUrl = `/project-details.html?id=${projectId}`;
        console.log('Tentative de redirection malgré erreur vers la page HTML autonome:', projectDetailUrl);
        
        window.location.href = projectDetailUrl;
      }
    };
    
    // Exécuter la vérification
    checkProjectExists();
  }, []);

  const handleDelete = useCallback(async (projectId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
        setProjects(prevProjects => prevProjects.filter(project => project.id !== projectId));
      } catch (error) {
        console.error('Erreur lors de la suppression du projet:', error);
        setError('Erreur lors de la suppression du projet');
      }
    }
  }, []);

  // Filtrage, tri et pagination
  const filteredProjects = useMemo(() => {
    // Filtrage par recherche
    let result = [...projects];
    
    if (searchTerm) {
      const searchTermLower = searchTerm.toLowerCase();
      result = result.filter(project => {
        if (!project || !project.name) return false;
        
        return (
          project.name.toLowerCase().includes(searchTermLower) ||
          (project.description && project.description.toLowerCase().includes(searchTermLower))
        );
      });
    }
    
    // Tri
    result.sort((a, b) => {
      const fieldA = String(a[sortField] || '').toLowerCase();
      const fieldB = String(b[sortField] || '').toLowerCase();
      
      if (sortDirection === 'asc') {
        return fieldA.localeCompare(fieldB);
      } else {
        return fieldB.localeCompare(fieldA);
      }
    });
    
    return result;
  }, [projects, searchTerm, sortField, sortDirection]);
  
  // Pagination
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  
  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages]);
  
  const paginatedProjects = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProjects.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProjects, currentPage, itemsPerPage]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Gestion des projets</h1>
      
      <div className="mb-8 flex justify-between items-center">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher un projet..."
            className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => {
              setEditingProject(null);
              setName('');
              setDescription('');
              setStartDate(format(new Date(), 'yyyy-MM-dd'));
              setEndDate('');
              setError('');
              setShowModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un projet
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowStatsMenu(!showStatsMenu)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md flex items-center"
            >
              <BarChart className="w-4 h-4 mr-2" />
              Statistiques par projet
              <ChevronDown className="w-4 h-4 ml-2" />
            </button>
            
            {showStatsMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg z-10">
                <div className="py-1">
                  <div className="px-4 py-2 text-sm text-gray-700 font-medium border-b">
                    Sélectionner un projet
                  </div>
                  {projects.length > 0 ? (
                    <div className="max-h-60 overflow-y-auto">
                      {projects.map(project => (
                        <button
                          key={project.id}
                          onClick={() => {
                            navigateToProjectStats(project.id);
                            setShowStatsMenu(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-purple-100 hover:text-purple-900"
                        >
                          {project.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-2 text-sm text-gray-500">
                      Aucun projet disponible
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal pour le formulaire de projet */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-800">
                {editingProject ? 'Modifier le projet' : 'Ajouter un nouveau projet'}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium mb-1">
                      Nom du projet <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-500 ml-1">(obligatoire)</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500 focus:ring-2 transition duration-150 ease-in-out"
                      placeholder="Nom du projet"
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
                      placeholder="Description du projet"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium mb-1">
                      Date de début <span className="text-red-500">*</span>
                      <span className="text-xs text-gray-500 ml-1">(obligatoire)</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500 focus:ring-2 transition duration-150 ease-in-out"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium mb-1">
                      Date de fin
                      <span className="text-xs text-gray-500 ml-1">(optionnel)</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500 focus:ring-2 transition duration-150 ease-in-out"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Si spécifiée, la date de fin doit être supérieure ou égale à la date de début
                    </p>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-4 mt-8">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                  >
                    Annuler
                  </button>
                  
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {editingProject ? 'Mettre à jour' : 'Enregistrer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
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
                placeholder="Rechercher un projet par nom ou description..."
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
          <thead className="bg-blue-50">
            <tr>
              <th 
                className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'name') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('name');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Nom
                  {sortField === 'name' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'description') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('description');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Description
                  {sortField === 'description' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'startDate') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('startDate');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Date de début
                  {sortField === 'startDate' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => {
                  if (sortField === 'endDate') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField('endDate');
                    setSortDirection('asc');
                  }
                }}
              >
                <div className="flex items-center">
                  Date de fin
                  {sortField === 'endDate' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </span>
                  )}
                </div>
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedProjects.map((project) => (
              <tr key={project.id} className="hover:bg-blue-50 transition duration-150 ease-in-out">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{project.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{project.description || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {project.startDate && isValid(new Date(project.startDate)) 
                    ? format(new Date(project.startDate), 'dd/MM/yyyy') 
                    : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {project.endDate && isValid(new Date(project.endDate)) 
                    ? format(new Date(project.endDate), 'dd/MM/yyyy') 
                    : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-4">
                  <button
                    onClick={() => navigateToProjectStats(project.id)}
                    title="Voir les détails"
                    className="text-green-600 hover:text-green-900 transition duration-150 ease-in-out inline-flex items-center"
                  >
                    <BarChart className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(project)}
                    title="Modifier"
                    className="text-blue-600 hover:text-blue-900 transition duration-150 ease-in-out inline-flex items-center"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    title="Supprimer"
                    className="text-red-600 hover:text-red-900 transition duration-150 ease-in-out inline-flex items-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredProjects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                  {searchTerm ? 'Aucun projet ne correspond à votre recherche' : 'Aucun projet n\'a été créé'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {filteredProjects.length > 0 && (
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
                Affichage de <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> à <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredProjects.length)}</span> sur <span className="font-medium">{filteredProjects.length}</span> projets
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