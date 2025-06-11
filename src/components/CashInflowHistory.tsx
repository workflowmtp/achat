import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { Download } from 'lucide-react';

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
  const { user } = useAuth();
  
  const sources = [
    { id: 'rebus', label: 'Compte des rebus' },
    { id: 'bank', label: 'Compte bancaire' },
    { id: 'pca', label: 'Compte PCA' },
    { id: 'granule', label: 'Vente Granule' },
    { id: 'espece', label: 'Vente d\'espèce client' }
  ];

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

  // Fonction pour filtrer les entrées avec useCallback
  const filterEntries = useCallback(() => {
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
    
    setFilteredEntries(filtered);
  }, [entries, startDate, endDate, selectedProject, selectedSource]);

  // Appliquer les filtres lorsque les critères changent
  useEffect(() => {
    filterEntries();
  }, [startDate, endDate, selectedProject, selectedSource, filterEntries]);

  // Fonction pour réinitialiser les filtres
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedProject('');
    setSelectedSource('');
    setFilteredEntries(entries);
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
  const totalAmount = filteredEntries.reduce((sum, entry) => sum + entry.amount, 0);

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
          Nombre d'entrées: {filteredEntries.length}
        </p>
      </div>
      
      {/* Tableau des entrées */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montant (DH)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Projet</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEntries.length > 0 ? (
                filteredEntries.map(entry => {
                  const project = projects.find(p => p.id === entry.projectId);
                  const source = sources.find(s => s.id === entry.source);
                  
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(entry.date), 'dd/MM/yyyy')}
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
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    Aucune entrée trouvée
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
