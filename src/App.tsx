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
import ProjectDetails from './components/ProjectDetails';
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

// Route pour les utilisateurs avec des accès spécifiques
function RoleBasedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) {
  const { user, loading } = useAuth();
  const userRole = localStorage.getItem('userRole') || '';
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const hasEntriesAccess = localStorage.getItem('accessEntries') === 'true';
  const hasExpensesAccess = localStorage.getItem('accessExpenses') === 'true';
  
  // Ajouter des logs pour le débogage
  console.log('RoleBasedRoute - userRole:', userRole);
  console.log('RoleBasedRoute - isAdmin:', isAdmin);
  console.log('RoleBasedRoute - hasEntriesAccess:', hasEntriesAccess);
  console.log('RoleBasedRoute - hasExpensesAccess:', hasExpensesAccess);
  console.log('RoleBasedRoute - allowedRoles:', allowedRoles);
  console.log('RoleBasedRoute - path:', window.location.pathname);
  
  if (loading) {
    console.log('RoleBasedRoute - Chargement...');
    return <div>Chargement...</div>;
  }
  
  if (!user) {
    console.log('RoleBasedRoute - Utilisateur non authentifié, redirection vers /login');
    return <Navigate to="/login" />;
  }
  
  // Vérifier les accès spécifiques
  const path = window.location.pathname;
  
  // Les administrateurs ont accès à tout
  if (isAdmin || userRole === 'admin') {
    console.log('RoleBasedRoute - Accès administrateur accordé');
    return <Layout>{children}</Layout>;
  }
  
  // Vérifier les accès spécifiques en fonction du chemin
  if (path.includes('/dashboard')) {
    // Tout utilisateur authentifié a accès au tableau de bord
    console.log('RoleBasedRoute - Accès au tableau de bord accordé');
    return <Layout>{children}</Layout>;
  }
  
  // Accès aux entrées, historique des entrées et aux projets pour les utilisateurs avec Dep-1234
  if (hasEntriesAccess && (path.includes('/inflow') || path.includes('/projects') || path.includes('/closing'))) {
    console.log('RoleBasedRoute - Accès aux entrées/projets/clôture accordé');
    return <Layout>{children}</Layout>;
  }
  
  // Accès aux historiques pour les utilisateurs avec Dep-12345
  const hasHistoryAccess = localStorage.getItem('accessHistory') === 'true';
  if (hasHistoryAccess && (path.includes('/inflow/history') || path.includes('/expenses/history'))) {
    console.log('RoleBasedRoute - Accès aux historiques (entrées/dépenses) accordé');
    return <Layout>{children}</Layout>;
  }
  
  // Accès aux dépenses, articles, unités, fournisseurs pour les utilisateurs avec Exp-1234
  if (hasExpensesAccess && (path.includes('/expenses') || path.includes('/articles') || 
      path.includes('/units') || path.includes('/suppliers'))) {
    console.log('RoleBasedRoute - Accès aux dépenses/articles/unités/fournisseurs accordé');
    return <Layout>{children}</Layout>;
  }
  
  // Si on arrive ici, c'est que l'utilisateur n'a pas les droits nécessaires
  console.log('RoleBasedRoute - Accès refusé');
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
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
                <Projects />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
                <ProjectDetails />
              </RoleBasedRoute>
            }
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
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
                <Articles />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/units"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
                <Units />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
                <Suppliers />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/inflow"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
                <CashInflow />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
                <Expenses />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/expenses/history"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
                <ExpenseHistory />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/inflow/history"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
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
            path="/closing"
            element={
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
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