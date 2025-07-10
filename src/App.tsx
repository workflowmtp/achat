import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/auth/AuthContext';
import Login from './components/auth/Login';
import AdminLogin from './components/auth/AdminLogin';
import AdminRegister from './components/auth/AdminRegister';
import ResetPassword from './components/auth/ResetPassword';
import Register from './components/auth/Register';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';

import Categories from './components/Categories';
import Articles from './components/Articles';
import Units from './components/Units';
import Suppliers from './components/Suppliers';
import CashInflow from './components/CashInflow';
import Expenses from './components/Expenses';
import ExpenseHistory from './components/ExpenseHistory';
import CashInflowHistory from './components/CashInflowHistory';
import ActivityHistory from './components/ActivityHistory';
import Closing from './components/Closing';
import Users from './components/Users';
import PCAReimbursement from './components/PCAReimbursement';
import ProjectDetail from './components/ProjectDetail';

// Route pour les utilisateurs avec des accès spécifiques
function RoleBasedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) {
  const { user, loading } = useAuth();
  const userRole = localStorage.getItem('userRole') || '';
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const hasEntriesAccess = localStorage.getItem('accessEntries') === 'true';
  const hasExpensesAccess = localStorage.getItem('accessExpenses') === 'true';
  
  const path = window.location.pathname;
  
  // Logs de débogage améliorés
  console.log('RoleBasedRoute - Détail complet', {
    path,
    userRole,
    isAdmin,
    hasEntriesAccess,
    hasExpensesAccess,
    allowedRoles,
    rawIsAdmin: localStorage.getItem('isAdmin'),
    rawUserRole: localStorage.getItem('userRole'),
    user: user ? 'Authentifié' : 'Non authentifié',
    loading
  });
  
  if (loading) {
    console.log('RoleBasedRoute - Chargement...');
    return <div>Chargement...</div>;
  }
  
  if (!user) {
    console.log('RoleBasedRoute - Utilisateur non authentifié, redirection vers /login');
    return <Navigate to="/login" />;
  }
  
  // IMPORTANT: Traitement spécial pour les détails du projet
  if (path.includes('/project-detail/')) {
    console.log('RoleBasedRoute - Page de détail du projet détectée:', path);
    // Autoriser l'accès à tous les utilisateurs authentifiés aux détails du projet
    return <Layout>{children}</Layout>;
  }
  
  // Les administrateurs ont accès à tout
  if (isAdmin || userRole === 'admin') {
    console.log('RoleBasedRoute - Accès administrateur accordé');
    return <Layout>{children}</Layout>;
  }
  
  // Vérification basée sur les rôles autorisés
  const hasAccess = allowedRoles.some(role => {
    switch (role) {
      case 'admin':
        return isAdmin || userRole === 'admin';
      case 'user':
        return true; // Tout utilisateur connecté
      case 'entries':
        return hasEntriesAccess;
      case 'expenses':
        return hasExpensesAccess;
      default:
        return false;
    }
  });
  
  console.log('RoleBasedRoute - Résultat de vérification d\'accès:', hasAccess);
  
  if (hasAccess) {
    return <Layout>{children}</Layout>;
  }
  
  // Si on arrive ici, c'est que l'utilisateur n'a pas les droits nécessaires
  console.log('RoleBasedRoute - Accès refusé, redirection vers dashboard');
  // Rediriger l'utilisateur standard vers le tableau de bord
  return <Navigate to="/dashboard" />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/register" element={<AdminRegister />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'entries', 'expenses']}>
                <Dashboard />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'entries']}>
                <Projects />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'entries']}>
                <ProjectDetail />
              </RoleBasedRoute>
            }
          />
          {/* Route spéciale pour le détail du projet - pas de vérification de rôle */}
          <Route
            path="/project-detail/:projectId"
            element={ <RoleBasedRoute allowedRoles={['admin', 'entries']}><ProjectDetail /></RoleBasedRoute>}
          />
          <Route
            path="/categories"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <Categories />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/articles"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'expenses']}>
                <Articles />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/units"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'expenses']}>
                <Units />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'expenses']}>
                <Suppliers />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/inflow"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'entries']}>
                <CashInflow />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'expenses']}>
                <Expenses />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/expenses/history"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'expenses',"entries"]}>
                <ExpenseHistory />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/inflow/history"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'entries','expenses']}>
                <CashInflowHistory />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/activity-history"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <ActivityHistory />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/pca-reimbursement"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'expenses']}>
                <PCAReimbursement />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/closing"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'entries']}>
                <Closing />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <Users />
              </RoleBasedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;