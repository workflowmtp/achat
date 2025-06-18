import React, { useState } from 'react';
import { format } from 'date-fns';
import { Save, AlertCircle } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './auth/AuthContext';
import { usePCADebt } from './usePCADebt'; // Importer le hook pour la dette PCA

export default function PCAReimbursement() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();
  const { pcaDebt, loading, refreshPCADebt } = usePCADebt(); // Utiliser le hook

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!amount || parseFloat(amount) <= 0) {
      setError('Le montant du remboursement doit être supérieur à 0');
      return;
    }

    const reimbursementAmount = parseFloat(amount);

    if (reimbursementAmount > pcaDebt) {
      setError('Le montant du remboursement ne peut pas être supérieur à la dette');
      return;
    }

    try {
      // 1. Enregistrer le remboursement
      await addDoc(collection(db, 'pca_reimbursements'), {
        amount: reimbursementAmount,
        description,
        userId: user ? user.uid : 'system', // Conserver l'utilisateur pour la traçabilité si disponible
        date: format(new Date(), 'yyyy-MM-dd'),
        createdAt: new Date().toISOString()
      });

      // 2. Créer une dépense pour le remboursement
      const expenseRef = await addDoc(collection(db, 'expenses'), {
        date: format(new Date(), 'yyyy-MM-dd'),
        description: `Remboursement PCA: ${description}`,
        projectId: 'pca_remboursement', // Projet spécifique pour les remboursements PCA
        userId: user ? user.uid : 'system', // Conserver l'utilisateur pour la traçabilité si disponible
        createdAt: new Date().toISOString()
      });
      
      // 3. Créer l'élément de dépense
      await addDoc(collection(db, 'expense_items'), {
        expenseId: expenseRef.id,
        designation: "Remboursement PCA",
        reference: "PCA-RMB",
        quantity: 1,
        unit: "FCFA",
        unitPrice: reimbursementAmount,
        supplier: "PCA",
        supplierId: "pca_internal", // Identifiant interne pour PCA
        amountGiven: reimbursementAmount, // Montant remis (égal au montant total car payé intégralement)
        beneficiary: "PCA",
        userId: user ? user.uid : 'system', // Conserver l'utilisateur pour la traçabilité si disponible
        createdAt: new Date().toISOString()
      });

      // 4. Ajouter une notification
      await addDoc(collection(db, 'notifications'), {
        message: `Remboursement PCA effectué: ${formatPrice(reimbursementAmount)}`,
        type: 'pca_reimbursement',
        read: false,
        createdAt: new Date().toISOString(),
        userId: user ? user.uid : 'system' // Conserver l'utilisateur pour la traçabilité si disponible
      });

      // 5. Rafraîchir le calcul de la dette PCA
      refreshPCADebt();

      // Réinitialiser le formulaire
      setAmount('');
      setDescription('');
      setSuccess('Remboursement enregistré avec succès');
    } catch (error) {
      console.error('Erreur lors du remboursement:', error);
      setError('Erreur lors du remboursement');
    }
  };

  const formatPrice = (amount: number) => {
    return amount.toLocaleString('fr-FR', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + ' FCFA';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold mb-6">Remboursement PCA</h2>

      <div className="mb-6 bg-yellow-50 p-4 rounded-lg">
        <p className="text-sm font-medium text-yellow-800">
          {loading ? 'Calcul de la dette PCA...' : `Dette PCA actuelle: ${formatPrice(pcaDebt)}`}
        </p>
      </div>

      {error && (
        <div className="mb-6 flex items-center bg-red-50 border-l-4 border-red-400 p-4 rounded-r" role="alert">
          <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border-l-4 border-green-400 p-4 rounded-r" role="alert">
          <span className="text-green-700">{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Montant du remboursement (FCFA)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            placeholder="0"
            min="0"
            max={pcaDebt}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="block w-full px-4 py-3 rounded-lg bg-blue-50 border border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            placeholder="Description du remboursement"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading || !amount || parseFloat(amount) <= 0 || parseFloat(amount) > pcaDebt}
          className="inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4 mr-2" />
          Enregistrer le remboursement
        </button>
      </form>
    </div>
  );
}