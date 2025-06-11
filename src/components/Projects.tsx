import React, { useState, useEffect, useCallback } from 'react';
import { format, isValid } from 'date-fns';
import { Plus, Trash2, AlertCircle, Pencil, X, Save, Search, Info } from 'lucide-react';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { useNavigate } from 'react-router-dom';

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
  const { user } = useAuth();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const navigate = useNavigate();

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
  };

  const handleCancelEdit = () => {
    setEditingProject(null);
    setName('');
    setDescription('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate('');
    setError('');
  };

  const handleDelete = async (projectId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;
    
    try {
      await deleteDoc(doc(db, 'projects', projectId));
      fetchProjects();
    } catch (err) {
      console.error("Erreur lors de la suppression du projet:", err);
      setError("Erreur lors de la suppression du projet");
    }
  };

  const filteredProjects = projects.filter(project => {
    if (!project || !project.name) return false;
    
    const searchTermLower = searchTerm.toLowerCase();
    return (
      project.name.toLowerCase().includes(searchTermLower) ||
      (project.description && project.description.toLowerCase().includes(searchTermLower))
    );
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Gestion des Projets</h2>

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

        <div className="mt-8 flex space-x-4">
          <button
            type="submit"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 ease-in-out"
          >
            {editingProject ? (
              <>
                <Save className="w-5 h-5 mr-2" />
                Mettre à jour le projet
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Créer le projet
              </>
            )}
          </button>
          {editingProject && (
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
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un projet par nom ou description..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
          </div>
        </div>

        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-blue-50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date de début</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date de fin</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredProjects.map((project) => (
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
                    onClick={() => navigate(`/projects/${project.id}`)}
                    title="Voir les détails"
                    className="text-green-600 hover:text-green-900 transition duration-150 ease-in-out inline-flex items-center"
                  >
                    <Info className="w-4 h-4" />
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
    </div>
  );
}