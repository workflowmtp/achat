import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Wallet, Receipt, PiggyBank, BarChart3, FolderKanban, LogOut, Package, Bell, History, Ruler, Users, UserCog, CreditCard, BarChart, ChevronDown } from 'lucide-react';
import { useAuth } from './auth/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  userId: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProjectStats, setShowProjectStats] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const userRole = localStorage.getItem('userRole') || '';
  const hasEntriesAccess = localStorage.getItem('accessEntries') === 'true';
  const hasExpensesAccess = localStorage.getItem('accessExpenses') === 'true';
  const hasHistoryAccess = localStorage.getItem('accessHistory') === 'true';

  // Définir fetchNotifications avec useCallback pour éviter les re-rendus inutiles
  const fetchNotifications = React.useCallback(async () => {
    if (!user) return;

    try {
      const cashInflowRef = collection(db, 'cash_inflow');
      const q = query(
        cashInflowRef,
        where('userId', '==', user.uid),
        where('source', '==', 'pca')
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        setNotifications([{
          id: 'pca-notification',
          message: 'Remboursement PCA en attente',
          read: false,
          createdAt: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des notifications:', error);
    }
  }, [user]);

  // Récupérer la liste des projets
  const fetchProjects = React.useCallback(async () => {
    if (!user) return;

    try {
      const projectsRef = collection(db, 'projects');
      let projectQuery;
      
      if (isAdmin || hasEntriesAccess) {
        // Admin et utilisateurs avec accès aux entrées voient tous les projets
        projectQuery = query(projectsRef);
      } else {
        // Les autres utilisateurs ne voient que leurs propres projets
        projectQuery = query(
          projectsRef,
          where('userId', '==', user.uid)
        );
      }

      const snapshot = await getDocs(projectQuery);
      const projectsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      
      setProjects(projectsList);
    } catch (error) {
      console.error('Erreur lors de la récupération des projets:', error);
    }
  }, [user, isAdmin, hasEntriesAccess]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchProjects();
    }
  }, [user, fetchNotifications, fetchProjects]);

  // Only show relevant tabs based on user role and access permissions
  const getTabs = () => {
    // Vérifier si l'utilisateur est administrateur (Admin12345)
    if (isAdmin || userRole === 'admin') {
      console.log('Chargement des onglets administrateur');
      // Administrateur - accès complet
      return [
        { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3, path: '/dashboard' },
        { id: 'projects', label: 'Projets', icon: FolderKanban, path: '/projects' },
        { id: 'articles', label: 'Articles', icon: Package, path: '/articles' },
        { id: 'units', label: 'Unités', icon: Ruler, path: '/units' },
        { id: 'users', label: 'Utilisateurs', icon: UserCog, path: '/users' },
        { id: 'suppliers', label: 'Fournisseurs', icon: Users, path: '/suppliers' },
        { id: 'inflow', label: 'Entrées', icon: Wallet, path: '/inflow' },
        { id: 'inflow-history', label: 'Historique Entrées', icon: History, path: '/inflow/history' },
        { id: 'pca-reimbursement', label: 'Remboursement PCA', icon: CreditCard, path: '/pca-reimbursement' },
        { id: 'expenses', label: 'Dépenses', icon: Receipt, path: '/expenses' },
        { id: 'expense-history', label: 'Historique Dépenses', icon: History, path: '/expenses/history' },
        { id: 'activity-history', label: 'Historique Activités', icon: BarChart3, path: '/activity-history' },
        { id: 'closing', label: 'Clôture', icon: PiggyBank, path: '/closing' },
      ];
    } else if (userRole === 'user') {
      // Utilisateur standard - accès limité en fonction des permissions
      console.log('Chargement des onglets utilisateur standard');
      console.log('hasEntriesAccess:', hasEntriesAccess);
      console.log('hasExpensesAccess:', hasExpensesAccess);
      
      // Commencer par le tableau de bord qui est toujours accessible
      const userTabs = [
        { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3, path: '/dashboard' },
      ];
      
      // Ajouter les onglets en fonction des permissions
      if (hasEntriesAccess) {
        userTabs.push({ id: 'inflow', label: 'Entrées', icon: Wallet, path: '/inflow' });
        userTabs.push({ id: 'closing', label: 'Clôture', icon: PiggyBank, path: '/closing' });
        userTabs.push({ id: 'projects', label: 'Projets', icon: FolderKanban, path: '/projects' });
        
        // Ajouter l'historique des entrées si l'utilisateur a accès à l'historique
        if (hasHistoryAccess) {
          userTabs.push({ id: 'inflow-history', label: 'Historique Entrées', icon: History, path: '/inflow/history' });
          userTabs.push({ id: 'expense-history', label: 'Historique Dépenses', icon: History, path: '/expenses/history' });
          // Ne pas ajouter l'historique des dépenses ici, il sera ajouté dans la section hasExpensesAccess si nécessaire
        }
      }
      
      if (hasExpensesAccess) {
        userTabs.push({ id: 'expenses', label: 'Dépenses', icon: Receipt, path: '/expenses' });
       userTabs.push({ id: 'pca-reimbursement', label: 'Remboursement PCA', icon: CreditCard, path: '/pca-reimbursement' });
        // Suppression du doublon d'historique des dépenses
        userTabs.push({ id: 'inflow-history', label: 'Historique Entrées', icon: History, path: '/inflow/history' });
        userTabs.push({ id: 'expense-history', label: 'Historique Dépenses', icon: History, path: '/expenses/history' });
       
        userTabs.push({ id: 'articles', label: 'Articles', icon: Package, path: '/articles' });
        userTabs.push({ id: 'units', label: 'Unités', icon: Ruler, path: '/units' });
        userTabs.push({ id: 'suppliers', label: 'Fournisseurs', icon: Users, path: '/suppliers' });
      }
      
      return userTabs;
    } else if (userRole === 'dashboard_only') {
      // Utilisateur avec accès uniquement au tableau de bord (PCAA)
      console.log('Chargement des onglets utilisateur tableau de bord uniquement');
      
      // Uniquement le tableau de bord est accessible
      return [
        { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3, path: '/dashboard' },
      ];
    } else {
      // Utilisateur sans rôle spécifique - accès minimal
      console.log('Utilisateur sans rôle spécifique');
      return [
        { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3, path: '/dashboard' },
      ];
    }
  };

  const tabs = getTabs();

  // La fonction fetchNotifications a été déplacée avant le useEffect

  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('userRole');
    localStorage.removeItem('accessEntries');
    localStorage.removeItem('accessExpenses');
    navigate('/login');
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  // Rediriger vers la page appropriée si l'utilisateur tente d'accéder à une page non autorisée
  useEffect(() => {
    // Permettre l'accès à la page de connexion
    if (location.pathname === '/login' || location.pathname === '/register' || location.pathname === '/reset-password') {
      return;
    }
    
    // Vérifier si le chemin actuel est accessible
    const currentPath = tabs.find(tab => tab.path === location.pathname);
    
    if (!currentPath) {
      // Si la page n'est pas accessible, rediriger vers la première page autorisée
      if (tabs.length > 0) {
        navigate(tabs[0].path);
      } else {
        // Si aucune page n'est autorisée, rediriger vers la connexion
        navigate('/login');
      }
    }
  }, [location.pathname, tabs, navigate]);

  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [pageTitle, setPageTitle] = useState('');
  
  // Gestion responsive de la sidebar
  useEffect(() => {
    const handleResize = () => {
      // Sur mobile, fermer la sidebar par défaut
      setSidebarOpen(window.innerWidth >= 768);
    };
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Appliquer au chargement initial
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Dépendance vide pour n'exécuter qu'au montage
  
  // Déterminer le titre de la page en fonction du chemin actuel
  useEffect(() => {
    const currentTab = tabs.find(tab => tab.path === location.pathname);
    if (currentTab) {
      setPageTitle(currentTab.label);
    } else if (location.pathname.includes('/project-detail/')) {
      setPageTitle('Statistiques du Projet');
    } else {
      setPageTitle('Gestion de Caisse');
    }
  }, [location.pathname, tabs]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar - sur mobile: absolue et pleine largeur, sur desktop: fixe avec largeur définie */}
      <div 
        className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
          fixed top-0 left-0 h-full 
          md:w-64 w-3/4 max-w-xs
          bg-blue-800 text-white 
          transition-transform duration-300 ease-in-out 
          overflow-y-auto z-50`
        }>
        {/* Logo et titre de l'application */}
        <div className="flex items-center justify-between p-4 border-b border-blue-700">
          <h1 className="font-bold text-lg">Gestion de Caisse</h1>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="p-1 rounded-full hover:bg-blue-700 focus:outline-none md:hidden"
          >
            {/* Icône X pour fermer sur mobile */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Menu de navigation */}
        <div className="flex-grow overflow-y-auto py-4">
          <div className="space-y-1 px-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.id}
                  to={tab.path}
                  onClick={() => window.innerWidth < 768 && setSidebarOpen(false)}
                  className={`flex items-center px-3 py-3 rounded-lg ${
                    location.pathname === tab.path
                      ? 'bg-blue-900 text-white'
                      : 'text-blue-100 hover:bg-blue-700'
                  } transition-colors duration-200`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="ml-3">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
        
        {/* Pied de la sidebar */}
        <div className="mt-auto"></div>
      </div>

      {/* Overlay pour fermer la sidebar sur mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden" 
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        ></div>
      )}
      
      {/* Contenu principal avec titre de page - toujours pleine largeur sur mobile, avec marge sur desktop */}
      <div className="flex-1 md:ml-64 transition-all duration-300 ease-in-out">
        {/* Barre de titre de la page avec éléments à droite */}
        <div className="bg-white shadow-sm h-16 flex justify-between items-center px-3 md:px-6 sticky top-0 z-30">
          <div className="flex items-center space-x-4">
            {/* Bouton menu hamburger sur mobile */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-md md:hidden focus:outline-none hover:bg-gray-100"
              aria-label="Menu principal"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Menu des notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && notifications.length > 0 && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-1 z-50">
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50 ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <p className="text-sm text-gray-900">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Menu des statistiques par projet */}
            <div className="relative">
              <button
                onClick={() => setShowProjectStats(!showProjectStats)}
                className="flex items-center p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                <BarChart className="h-6 w-6 mr-1" />
                <span className="hidden md:inline">Stats Projets</span>
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>

              {showProjectStats && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg py-1 z-50">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-700 font-medium border-b">
                      Statistiques par projet
                    </div>
                    {projects.length > 0 ? (
                      <div className="max-h-60 overflow-y-auto">
                        {projects.map(project => (
                          <button
                            key={project.id}
                            onClick={() => {
                              navigate(`/project-detail/${project.id}`);
                              setShowProjectStats(false);
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

            <span className="text-gray-700">
              {isAdmin ? '👑 Admin: ' : userRole === 'cash_inflow' ? '💰 Caissier: ' : userRole === 'expenses' ? '📊 Comptable: ' : userRole === 'pca' ? '📊 PCA: ' : 'Utilisateur: '}
              {user?.displayName || 'Utilisateur'}
            </span>
            
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Déconnexion
            </button>
          </div>
        </div>
        
        {/* Contenu de la page avec marges optimisées */}
        <div className="p-2 sm:p-3 md:p-5 max-w-full">
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-4 md:p-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}