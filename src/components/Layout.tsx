import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Wallet, Receipt, PiggyBank, BarChart3, FolderKanban, LogOut, Package, Bell, History, Ruler, Users, UserCog } from 'lucide-react';
import { useAuth } from './auth/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

interface Notification {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
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

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user, fetchNotifications]);

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
          // Ajouter aussi l'historique des dépenses, même si l'utilisateur n'a pas accès aux dépenses
          userTabs.push({ id: 'expense-history', label: 'Historique Dépenses', icon: History, path: '/expenses/history' });
        }
      }
      
      if (hasExpensesAccess) {
        userTabs.push({ id: 'expenses', label: 'Dépenses', icon: Receipt, path: '/expenses' });
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Gestion de Caisse</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex space-x-4 mb-8 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.id}
                to={tab.path}
                className={`flex items-center px-4 py-2 rounded-lg whitespace-nowrap ${
                  location.pathname === tab.path
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                } transition-colors duration-200`}
              >
                <Icon className="w-5 h-5 mr-2" />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </div>
  );
}