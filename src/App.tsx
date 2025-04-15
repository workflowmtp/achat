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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Chargement...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return <Layout>{children}</Layout>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div>Chargement...</div>;
  }
  
  const isAdmin = user?.getIdTokenResult()
    .then((idTokenResult) => idTokenResult.claims.admin)
    .catch(() => false);
  
  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" />;
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
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/projects"
            element={
              <PrivateRoute>
                <Projects />
              </PrivateRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <PrivateRoute>
                <Categories />
              </PrivateRoute>
            }
          />
          <Route
            path="/articles"
            element={
              <PrivateRoute>
                <Articles />
              </PrivateRoute>
            }
          />
          <Route
            path="/units"
            element={
              <AdminRoute>
                <Units />
              </AdminRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <PrivateRoute>
                <Suppliers />
              </PrivateRoute>
            }
          />
          <Route
            path="/inflow"
            element={
              <PrivateRoute>
                <CashInflow />
              </PrivateRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <PrivateRoute>
                <Expenses />
              </PrivateRoute>
            }
          />
          <Route
            path="/expenses/history"
            element={<Layout><ExpenseHistory /></Layout>}
          />
          <Route
            path="/closing"
            element={
              <AdminRoute>
                <Closing />
              </AdminRoute>
            }
          />
          <Route
            path="/users"
            element={
              <AdminRoute>
                <Users />
              </AdminRoute>
            }
          />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;