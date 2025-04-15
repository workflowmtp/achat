# Documentation de l'API Cash Inflow

Cette API permet de gérer les entrées de caisse dans l'application. Elle fournit des fonctions pour créer et récupérer des entrées de caisse.

## Installation

L'API est déjà intégrée dans le projet. Elle utilise Firebase Firestore comme base de données.

## Fonctions disponibles

### createCashInflow

Crée une nouvelle entrée de caisse.

```typescript
interface CashInflow {
  date: string;
  amount: number;
  source: string;
  description: string;
  projectId: string;
  userId: string;
}

const createCashInflow = async (
  data: Omit<CashInflow, 'userId'>, 
  userId: string
): Promise<{ 
  success: boolean; 
  id: string; 
  message: string; 
}>;
```

#### Paramètres

- `data`: Les données de l'entrée de caisse
  - `date`: Date de l'entrée (format: 'YYYY-MM-DD')
  - `amount`: Montant en FCFA
  - `source`: Source des fonds ('rebus' ou 'bank')
  - `description`: Description de l'entrée
  - `projectId`: ID du projet associé
- `userId`: ID de l'utilisateur créant l'entrée

#### Retour

- `success`: `true` si l'opération a réussi
- `id`: ID de l'entrée créée
- `message`: Message de confirmation

#### Exemple d'utilisation

```typescript
import { createCashInflow } from '../api/cashInflow';

try {
  const result = await createCashInflow({
    date: '2024-03-15',
    amount: 50000,
    source: 'bank',
    description: 'Versement initial',
    projectId: 'project123'
  }, 'user456');

  if (result.success) {
    console.log(`Entrée créée avec l'ID: ${result.id}`);
  }
} catch (error) {
  console.error('Erreur:', error);
}
```

### getCashInflowsByProject

Récupère toutes les entrées de caisse pour un projet spécifique.

```typescript
const getCashInflowsByProject = async (
  projectId: string, 
  userId: string
): Promise<CashInflow[]>;
```

#### Paramètres

- `projectId`: ID du projet
- `userId`: ID de l'utilisateur

#### Retour

Un tableau d'objets `CashInflow` contenant toutes les entrées du projet.

#### Exemple d'utilisation

```typescript
import { getCashInflowsByProject } from '../api/cashInflow';

try {
  const entries = await getCashInflowsByProject('project123', 'user456');
  
  entries.forEach(entry => {
    console.log(`Date: ${entry.date}`);
    console.log(`Montant: ${entry.amount} FCFA`);
    console.log(`Description: ${entry.description}`);
    console.log('---');
  });
} catch (error) {
  console.error('Erreur:', error);
}
```

## Exemple d'intégration complète

Voici un exemple complet d'utilisation de l'API dans un composant React :

```typescript
import React, { useState } from 'react';
import { createCashInflow, getCashInflowsByProject } from '../api/cashInflow';

function CashInflowManager({ projectId, userId }) {
  const [entries, setEntries] = useState([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const result = await createCashInflow({
        date: new Date().toISOString().split('T')[0],
        amount: parseFloat(amount),
        source: 'bank',
        description,
        projectId
      }, userId);

      if (result.success) {
        // Rafraîchir la liste des entrées
        const updatedEntries = await getCashInflowsByProject(projectId, userId);
        setEntries(updatedEntries);
        
        // Réinitialiser le formulaire
        setAmount('');
        setDescription('');
      }
    } catch (error) {
      console.error('Erreur:', error);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Montant"
          required
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          required
        />
        <button type="submit">Ajouter</button>
      </form>

      <div>
        <h3>Entrées de caisse</h3>
        {entries.map(entry => (
          <div key={entry.id}>
            <p>Date: {entry.date}</p>
            <p>Montant: {entry.amount} FCFA</p>
            <p>Description: {entry.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CashInflowManager;
```

## Gestion des erreurs

L'API utilise un système de gestion d'erreurs basé sur les exceptions. Toutes les fonctions peuvent lancer une erreur en cas de problème. Il est recommandé d'utiliser un bloc try/catch pour gérer ces erreurs.

## Sécurité

- L'API vérifie automatiquement l'authentification de l'utilisateur
- Les données sont validées avant d'être enregistrées
- Chaque entrée est liée à un utilisateur spécifique
- Les requêtes sont limitées aux données de l'utilisateur connecté

## Bonnes pratiques

1. Toujours gérer les erreurs avec try/catch
2. Valider les données côté client avant l'envoi
3. Utiliser les types TypeScript pour la sécurité du typage
4. Mettre à jour l'interface utilisateur après chaque opération réussie