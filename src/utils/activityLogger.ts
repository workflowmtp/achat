import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';

// Types d'activités
export enum ActivityType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

// Types d'entités
export enum EntityType {
  EXPENSE = 'expense',
  EXPENSE_ITEM = 'expense_item',
  CASH_INFLOW = 'cash_inflow'
}

// Interface pour les logs d'activité
export interface ActivityLog {
  id?: string;
  timestamp: string;
  userId: string;
  userName: string;
  activityType: ActivityType;
  entityType: EntityType;
  entityId: string;
  entityData: any; // Contient une copie des données de l'entité au moment de l'action
  details?: string;
  projectId?: string;
  projectName?: string;
}

/**
 * Enregistre une activité dans la collection activity_logs
 * @param userId ID de l'utilisateur qui effectue l'action
 * @param userName Nom de l'utilisateur qui effectue l'action
 * @param activityType Type d'activité (création, modification, suppression)
 * @param entityType Type d'entité (dépense, item de dépense, entrée de caisse)
 * @param entityId ID de l'entité concernée
 * @param entityData Données de l'entité au moment de l'action
 * @param details Détails supplémentaires (optionnel)
 * @param projectId ID du projet concerné (optionnel)
 * @param projectName Nom du projet concerné (optionnel)
 * @returns L'ID du log d'activité créé
 */
export const logActivity = async (
  userId: string,
  userName: string,
  activityType: ActivityType,
  entityType: EntityType,
  entityId: string,
  entityData: any,
  details?: string,
  projectId?: string,
  projectName?: string
): Promise<string> => {
  try {
    const activityLog: ActivityLog = {
      timestamp: new Date().toISOString(),
      userId,
      userName,
      activityType,
      entityType,
      entityId,
      entityData,
      details,
      projectId,
      projectName
    };

    const docRef = await addDoc(collection(db, 'activity_logs'), activityLog);
    console.log(`Activité enregistrée avec succès: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'activité:', error);
    throw error;
  }
};
