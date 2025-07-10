import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { Download, Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
}

interface CashEntry {
  id: string;
  date: string;
  amount: number;
  source: string;
  description: string;
  projectId: string;
  userId: string;
  createdAt?: string;
}

export default function CashInflowHistory() {
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<CashEntry[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedSource, setSelectedSource] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // États pour la recherche, pagination et tri
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortField, setSortField] = useState<keyof CashEntry>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { user } = useAuth();
  
  const sources = useMemo(() => [
    { id: 'rebus', label: 'Compte des rebus' },
    { id: 'bank', label: 'Compte bancaire' },
    { id: 'pca', label: 'Compte PCA' },
    { id: 'granule', label: 'Vente Granule' },
    { id: 'espece', label: 'Vente d\'espèce client' }
  ], []);

  // Fonction pour récupérer les projets
  const fetchProjects = useCallback(async () => {
    try {
      const projectsRef = collection(db, 'projects');
      const snapshot = await getDocs(projectsRef);
      const projectsList = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        description: doc.data().description || ''
      }));
      setProjects(projectsList);
    } catch (error) {
      console.error('Erreur lors de la récupération des projets:', error);
      setError('Erreur lors de la récupération des projets');
    }
  }, []);

  // Fonction pour récupérer les entrées de caisse
  const fetchEntries = useCallback(async () => {
    if (!user) return;
    
    try {
      const entriesRef = collection(db, 'cash_inflow');
      const snapshot = await getDocs(entriesRef);
      const entriesList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as CashEntry[];

      // Trier les entrées par date (du plus récent au moins récent)
      entriesList.sort((a, b) => {
        // D'abord essayer de comparer par la date stockée
        const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateComparison !== 0) return dateComparison;
        
        // Si dates identiques, utiliser createdAt comme critère secondaire
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        
        return 0;
      });

      setEntries(entriesList);
      setFilteredEntries(entriesList);
    } catch (error) {
      console.error('Erreur lors de la récupération des entrées:', error);
      setError('Erreur lors de la récupération des entrées');
    }
  }, [user]);

  // Initialisation
  useEffect(() => {
    if (user) {
      fetchProjects();
      fetchEntries();
    }
  }, [user, fetchProjects, fetchEntries]);

  // Filtrer les entrées avec useMemo incluant recherche et tri
  const filteredSortedEntries = useMemo(() => {
    let filtered = [...entries];
    
    // Filtrer par date de début
    if (startDate) {
      filtered = filtered.filter(entry => entry.date >= startDate);
    }
    
    // Filtrer par date de fin
    if (endDate) {
      filtered = filtered.filter(entry => entry.date <= endDate);
    }
    
    // Filtrer par projet
    if (selectedProject) {
      filtered = filtered.filter(entry => entry.projectId === selectedProject);
    }
    
    // Filtrer par source
    if (selectedSource) {
      filtered = filtered.filter(entry => entry.source === selectedSource);
    }
    
    // Filtrer par terme de recherche
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(entry => {
        const project = projects.find(p => p.id === entry.projectId);
        const source = sources.find(s => s.id === entry.source);
        return (
          entry.description?.toLowerCase().includes(searchLower) ||
          String(entry.amount).includes(searchLower) ||
          (project?.name?.toLowerCase().includes(searchLower)) ||
          (source?.label?.toLowerCase().includes(searchLower)) ||
          (entry.date && format(new Date(entry.date), 'dd/MM/yyyy').includes(searchTerm))
        );
      });
    }
    
    // Version simplifiée du tri
    return filtered.sort((a, b) => {
      if (sortField === 'date') {
        try {
          const dateA = a.date ? new Date(a.date).getTime() : 0;
          const dateB = b.date ? new Date(b.date).getTime() : 0;
          return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
        } catch (error) {
          console.error("Erreur de tri de date", error);
          return 0;
        }
      }
      
      if (sortField === 'amount') {
        try {
          const amountA = a.amount || 0;
          const amountB = b.amount || 0;
          return sortDirection === 'asc' ? amountA - amountB : amountB - amountA;
        } catch (error) {
          console.error("Erreur de tri de montant", error);
          return 0;
        }
      }
      
      try {
        const valueA = String(a[sortField] || '').toLowerCase();
        const valueB = String(b[sortField] || '').toLowerCase();
        return sortDirection === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      } catch (error) {
        console.error("Erreur de tri", error);
        return 0;
      }
    });
  }, [entries, startDate, endDate, selectedProject, selectedSource, searchTerm, projects, sources, sortField, sortDirection]);

  // Mettre à jour filteredEntries quand filteredSortedEntries change
  useEffect(() => {
    setFilteredEntries(filteredSortedEntries);
  }, [filteredSortedEntries]);
  
  // Obtenir les entrées pour la page courante
  const paginatedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSortedEntries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSortedEntries, currentPage, itemsPerPage]);
  
  // Calculer le nombre total de pages
  const totalPages = Math.ceil(filteredSortedEntries.length / itemsPerPage);
  
  // Générer les numéros de page pour la pagination
  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages]);

  // Fonction pour réinitialiser les filtres
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedProject('');
    setSelectedSource('');
    setSearchTerm('');
    setCurrentPage(1);
  };
  
  // Fonction pour trier les données
  const handleSort = (field: keyof CashEntry) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Retour à la première page lors d'un changement de tri
  };
  
  // Obtenir l'icône de tri pour une colonne
  const getSortIcon = (field: keyof CashEntry) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />;
  };

  // Fonction pour exporter les données en CSV
  const exportToCSV = () => {
    try {
      // Créer les en-têtes du CSV
      const headers = ['Date', 'Montant', 'Source', 'Description', 'Projet'];
      
      // Créer les lignes de données
      const csvData = filteredEntries.map(entry => {
        const project = projects.find(p => p.id === entry.projectId);
        const source = sources.find(s => s.id === entry.source);
        
        return [
          format(new Date(entry.date), 'dd/MM/yyyy'),
          entry.amount.toString(),
          source ? source.label : entry.source,
          entry.description,
          project ? project.name : 'Projet inconnu'
        ];
      });
      
      // Combiner les en-têtes et les données
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.join(','))
      ].join('\n');
      
      // Créer un blob et un lien de téléchargement
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.setAttribute('href', url);
      link.setAttribute('download', `entrees_caisse_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`);
      link.style.visibility = 'hidden';
      
      // Ajouter le lien au DOM, cliquer dessus, puis le supprimer
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess('Exportation CSV réussie !');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      setError('Erreur lors de l\'exportation des données');
      setTimeout(() => setError(''), 3000);
    }
  };

  // Calculer le total des entrées filtrées
  const totalAmount = filteredSortedEntries.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Historique des entrées de caisse</h1>
      
      {/* Messages d'erreur et de succès */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      {/* Barre de recherche */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Rechercher par description, projet, source, montant ou date..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Retour à la première page lors d'une recherche
            }}
          />
        </div>
      </div>
      
      {/* Filtres */}
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Filtres</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Projet</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Tous les projets</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Toutes les sources</option>
              {sources.map(source => (
                <option key={source.id} value={source.id}>{source.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-between mt-4">
          <button
            onClick={resetFilters}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded"
          >
            Réinitialiser les filtres
          </button>
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded flex items-center"
          >
            <Download size={18} className="mr-2" /> Exporter en CSV
          </button>
        </div>
      </div>
      
      {/* Résumé */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <p className="text-lg font-semibold">
          Total des entrées filtrées: <span className="text-blue-700">{totalAmount.toFixed(2)} DH</span>
        </p>
        <p className="text-sm text-gray-600">
          Nombre d'entrées: {filteredSortedEntries.length}
        </p>
      </div>
      
      {/* Tableau des entrées */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('date')}
                >
                  <div className="flex items-center">
                    Date
                    <span className="ml-1">{getSortIcon('date')}</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Référence
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('amount')}
                >
                  <div className="flex items-center">
                    Montant (DH)
                    <span className="ml-1">{getSortIcon('amount')}</span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('source')}
                >
                  <div className="flex items-center">
                    Source
                    <span className="ml-1">{getSortIcon('source')}</span>
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('description')}
                >
                  <div className="flex items-center">
                    Description
                    <span className="ml-1">{getSortIcon('description')}</span>
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projet</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedEntries.length > 0 ? (
                paginatedEntries.map(entry => {
                  const project = projects.find(p => p.id === entry.projectId);
                  const source = sources.find(s => s.id === entry.source);
                  
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(entry.date), 'dd/MM/yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry?.id?.substring(0, 8)?.toUpperCase() || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        {entry.amount.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {source ? source.label : entry.source}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {entry.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {project ? project.name : 'Projet inconnu'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                    Aucune entrée trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {filteredSortedEntries.length > 0 && (
          <div className="py-4 px-6 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center mb-4 sm:mb-0">
              <span className="text-sm text-gray-700">
                Affichage de <span className="font-medium">{((currentPage - 1) * itemsPerPage) + 1}</span> à <span className="font-medium">
                  {Math.min(currentPage * itemsPerPage, filteredSortedEntries.length)}</span> sur <span className="font-medium">{filteredSortedEntries.length}</span> entrées
              </span>
              
              <div className="ml-4">
                <select
                  className="border border-gray-300 rounded-md text-sm pl-2 pr-7 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1); // Retour à la première page lors du changement d'éléments par page
                  }}
                >
                  {[5, 10, 25, 50].map(value => (
                    <option key={value} value={value}>
                      {value} par page
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              <button
                className={`px-3 py-1 rounded-md ${currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                aria-label="Page précédente"
              >
                <ChevronLeft size={18} />
              </button>
              
              {pageNumbers.map(number => (
                <button
                  key={number}
                  className={`px-3 py-1 rounded-md ${currentPage === number ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'}`}
                  onClick={() => setCurrentPage(number)}
                >
                  {number}
                </button>
              ))}
              
              <button
                className={`px-3 py-1 rounded-md ${currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-200'}`}
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                aria-label="Page suivante"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
