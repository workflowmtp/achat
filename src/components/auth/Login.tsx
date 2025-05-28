import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Mail, LogIn, ShieldCheck } from 'lucide-react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!email || !password) {
      setError('Veuillez remplir tous les champs obligatoires');
      setLoading(false);
      return;
    }

    if (!accessCode) {
      setError('Le code d\'accès est obligatoire');
      setLoading(false);
      return;
    }

    try {
      // Connexion avec Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Déterminer le rôle et les accès en fonction du code saisi
      const ADMIN_CODE = "Admin12345"; // Code administrateur unique
      const USER_CODE = "User1234";    // Code utilisateur unique
      
      let userRole = '';
      let isAdmin = false;

      // Attribution des rôles basée uniquement sur le code d'accès
      if (accessCode === ADMIN_CODE) {
        // Administrateur unique avec accès complet
        isAdmin = true;
        userRole = 'admin';
        localStorage.setItem('isAdmin', 'true');
        console.log('Connexion administrateur réussie');
      } else if (accessCode === USER_CODE) {
        // Utilisateur standard avec accès limité
        userRole = 'user';
        localStorage.removeItem('isAdmin');
        console.log('Connexion utilisateur réussie');
      } else {
        setError('Code d\'accès invalide. Utilisez Admin12345 pour l\'administrateur ou User1234 pour l\'utilisateur.');
        setLoading(false);
        return;
      }
      
      // Stocker le rôle dans le stockage local pour contrôler l'accès aux menus
      localStorage.setItem('userRole', userRole);
      
      // Mise à jour optionnelle du rôle dans Firestore
      // Ceci est facultatif si vous préférez déterminer les accès uniquement via le code
      try {
        const userRef = doc(db, 'users', userCredential.user.uid);
        
        // Créer un objet avec les données utilisateur
        const userData = {
          role: userRole,
          isAdmin: isAdmin,
          lastLogin: new Date().toISOString(),
          email: email,
          displayName: email.split('@')[0], // Utiliser la partie avant @ comme nom d'affichage par défaut
          createdAt: new Date().toISOString()
        };
        
        try {
          // Essayer de mettre à jour le document
          await updateDoc(userRef, {
            role: userRole,
            isAdmin: isAdmin,
            lastLogin: new Date().toISOString()
          });
        } catch (updateErr: Error) {
          // Si le document n'existe pas, le créer avec setDoc
          if (updateErr.message && updateErr.message.includes('No document to update')) {
            await setDoc(userRef, userData);
            console.log('Profil utilisateur créé avec succès');
          } else {
            throw updateErr; // Relancer d'autres types d'erreurs
          }
        }
      } catch (err) {
        console.warn('Impossible de mettre à jour ou créer le profil utilisateur', err);
        // Continuer même si la mise à jour échoue
      }
      
      // Redirection basée sur le rôle
      if (userRole === 'pca') {
        // Rediriger les utilisateurs PCA directement vers l'historique des dépenses
        navigate('/expenses/history');
      } else if (userRole === 'cash_inflow') {
        // Rediriger les utilisateurs cash_inflow directement vers la page des entrées
        navigate('/inflow');
      } else {
        // Redirection vers le tableau de bord pour les autres rôles
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Erreur de connexion:', err);
      setError('Email ou mot de passe incorrect');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <LogIn className="w-12 h-12 text-blue-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Connexion au système
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Ou{' '}
          <Link to="/register" className="font-medium text-blue-600 hover:text-blue-500">
            créez un nouveau compte
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Adresse email <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md bg-blue-50"
                  placeholder="vous@exemple.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md bg-blue-50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700">
                Code d'accès
                <span className="text-xs text-gray-500 ml-1">(requis pour les administrateurs et certains rôles)</span>
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ShieldCheck className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="accessCode"
                  name="accessCode"
                  type="text"
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md bg-blue-50"
                  placeholder="Entrez votre code d'accès"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Le code d'accès détermine vos droits dans le système
              </p>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
              >
                <LogIn className="h-5 w-5 mr-2" />
                {loading ? 'Connexion en cours...' : 'Se connecter'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Besoin d'aide ?</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link
                to="/reset-password"
                className="font-medium text-blue-600 hover:text-blue-500"
              >
                Mot de passe oublié?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}