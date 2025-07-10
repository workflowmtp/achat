import { useEffect, useState } from 'react';

/**
 * Force la mise à jour des droits utilisateur dans le localStorage
 * Cette fonction est utile pour s'assurer que les droits sont correctement définis
 * @param userId ID de l'utilisateur à vérifier
 */
export const forceUserRights = (userId: string) => {
  // Si l'utilisateur est Dep-12345, lui donner les droits d'édition
  if (userId === 'Dep-12345') {
    localStorage.setItem('userId', userId);
    localStorage.setItem('hasEditRights', 'true');
    console.log('UserRoleHelper - Droits d\'utilisateur Dep-12345 forcés dans localStorage');
  }
  
  // Si l'utilisateur est Exp-1234, lui donner les droits de visualisation
  if (userId === 'Exp-1234') {
    localStorage.setItem('userId', userId);
    localStorage.setItem('hasViewRights', 'true');
    console.log('UserRoleHelper - Droits d\'utilisateur Exp-1234 forcés dans localStorage');
  }
};

/**
 * Hook personnalisé pour vérifier si un utilisateur a des droits d'édition spécifiques
 * @returns {Object} Objet contenant des informations sur les droits de l'utilisateur
 */
export const useUserRights = () => {
  const [userRights, setUserRights] = useState({
    isAdmin: false,
    isDep12345: false,
    isDep1234: false,
    isExp1234: false,
    hasEditRights: false,
    hasViewRights: false,
    userId: '',
  });

  useEffect(() => {
    // Récupérer les informations utilisateur depuis localStorage
    const userRole = localStorage.getItem('userRole') || '';
    const userId = localStorage.getItem('userId') || '';
    const currentUserId = localStorage.getItem('currentUserId') || '';
    
    // Vérifier les différents rôles et droits
    const isAdmin = localStorage.getItem('isAdmin') === 'true' || userRole === 'admin';
    const isDep12345 = userId === 'Dep-12345' || currentUserId === 'Dep-12345';
    const isDep1234 = userId === 'Dep-1234' || currentUserId === 'Dep-1234';
    const isExp1234 = userId === 'Exp-1234' || currentUserId === 'Exp-1234';
    
    // Vérifier le droit d'accès aux entrées
    const hasAccessEntries = localStorage.getItem('accessEntries') === 'true';
    
    // Définir les droits spécifiques
    // Tous les utilisateurs avec accessEntries ont aussi les droits d'édition
    const hasEditRights = isAdmin || isDep12345 || isDep1234 || hasAccessEntries;
    const hasViewRights = isAdmin || isExp1234;
    
    // Mettre à jour l'état
    setUserRights({
      isAdmin,
      isDep12345,
      isDep1234,
      isExp1234,
      hasEditRights,
      hasViewRights,
      userId: userId || currentUserId,
    });
    
    // Si l'utilisateur est Dep-12345 ou Dep-1234, forcer la mise à jour des droits
    if (isDep12345 || isDep1234) {
      localStorage.setItem('hasEditRights', 'true');
    }
    
    // Si l'utilisateur est Exp-1234, forcer la mise à jour des droits
    if (isExp1234) {
      localStorage.setItem('hasViewRights', 'true');
    }
    
    // Journaliser les informations pour le débogage
    console.log('UserRoleHelper - userRole:', userRole);
    console.log('UserRoleHelper - userId:', userId);
    console.log('UserRoleHelper - currentUserId:', currentUserId);
    console.log('UserRoleHelper - isAdmin:', isAdmin);
    console.log('UserRoleHelper - isDep12345:', isDep12345);
    console.log('UserRoleHelper - isExp1234:', isExp1234);
    console.log('UserRoleHelper - hasEditRights:', hasEditRights);
    console.log('UserRoleHelper - hasViewRights:', hasViewRights);
  }, []);

  return userRights;
};

/**
 * Vérifie si l'utilisateur actuel est Dep-12345, Dep-1234, a le droit accessEntries ou a des droits d'admin
 * @returns {boolean} True si l'utilisateur a des droits d'édition
 */
export const hasEditRights = (): boolean => {
  const userRole = localStorage.getItem('userRole') || '';
  const userId = localStorage.getItem('userId') || '';
  const currentUserId = localStorage.getItem('currentUserId') || '';
  
  const isAdmin = localStorage.getItem('isAdmin') === 'true' || userRole === 'admin';
  const isDep12345 = userId === 'Dep-12345' || currentUserId === 'Dep-12345';
  const isDep1234 = userId === 'Dep-1234' || currentUserId === 'Dep-1234';
  
  // Vérifier le droit d'accès aux entrées
  const hasAccessEntries = localStorage.getItem('accessEntries') === 'true';
  
  // Forcer la mise à jour des droits dans localStorage pour Dep-12345, Dep-1234 et utilisateurs avec accessEntries
  if (isDep12345 || isDep1234 || hasAccessEntries) {
    localStorage.setItem('hasEditRights', 'true');
    console.log('UserRoleHelper - Droits d\'utilisateur forcés dans localStorage (hasEditRights=true)');
  }
  
  return isAdmin || isDep12345 || isDep1234 || hasAccessEntries;
};

/**
 * Vérifie si l'utilisateur actuel est Exp-1234 ou a des droits d'admin
 * @returns {boolean} True si l'utilisateur a des droits de visualisation
 */
export const hasViewRights = (): boolean => {
  const userRole = localStorage.getItem('userRole') || '';
  const userId = localStorage.getItem('userId') || '';
  const currentUserId = localStorage.getItem('currentUserId') || '';
  
  const isAdmin = localStorage.getItem('isAdmin') === 'true' || userRole === 'admin';
  const isExp1234 = userId === 'Exp-1234' || currentUserId === 'Exp-1234';
  
  return isAdmin || isExp1234;
};
