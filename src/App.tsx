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
import Closing from './components/Closing';
import Users from './components/Users';

// Route pour les utilisateurs avec des rôles spécifiques (admin, user)
function RoleBasedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles: string[] }) {
  const { user, loading } = useAuth();
  const userRole = localStorage.getItem('userRole') || '';
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  
  if (loading) {
    return <div>Chargement...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  // Vérifier si l'utilisateur est administrateur
  // Les administrateurs ont accès à tout
  if (isAdmin || userRole === 'admin') {
    console.log('Accès administrateur accordé');
    return <Layout>{children}</Layout>;
  }
  
  // Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
  if (!allowedRoles.includes(userRole)) {
    console.log('Accès refusé pour le rôle:', userRole);
    // Rediriger l'utilisateur standard vers le tableau de bord
    return <Navigate to="/dashboard" />;
  }
  
  return <Layout>{children}</Layout>;
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
              <RoleBasedRoute allowedRoles={['admin', 'user']}>
                <Dashboard />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <Projects />
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
              <RoleBasedRoute allowedRoles={['admin']}>
                <Articles />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/units"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
                <Units />
              </RoleBasedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <RoleBasedRoute allowedRoles={['admin']}>
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