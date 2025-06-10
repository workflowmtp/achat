import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Calendar, Download, Filter } from 'lucide-react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
}

interface CashEntry {
  id: string;
  date: string;
  amount: number;
  source: string;
  description: string;
  projectId: string;
}

interface ExpenseItem {
  id: string;
  articleId: string;
  designation: string;
  reference: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  supplier: string;
  supplierId: string;
  amountGiven: number;
  expenseId: string;
}

interface Expense {
  id: string;
  date: string;
  description: string;
  projectId: string;
  reference: string;
  items: ExpenseItem[];
  totalAmount: number;
}

const ProjectDetails = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  
  // États pour les données
  const [project, setProject] = useState<Project | null>(null);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // États pour les filtres
  const [startDate, setStartDate] = useState<string>(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd')); // Premier jour du mois
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd')); // Aujourd'hui
  
  // Statistiques
  const [totalInflow, setTotalInflow] = useState<number>(0);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [balance, setBalance] = useState<number>(0);
  
  // Récupérer les détails du projet
  const fetchProjectDetails = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);
      
      if (projectSnap.exists()) {
        const projectData = projectSnap.data() as Omit<Project, 'id'>;
        setProject({
          id: projectId,
          ...projectData
        });
      } else {
        setError('Projet non trouvé');
      }
    } catch (err) {
      setError('Erreur lors de la récupération des détails du projet');
      console.error(err);
    }
  }, [projectId]);
  
  // Récupérer les entrées et dépenses du projet
  const fetchProjectData = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Récupérer les entrées de fonds
      const cashQuery = query(
        collection(db, 'cash_entries'),
        where('projectId', '==', projectId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      
      const cashSnapshot = await getDocs(cashQuery);
      const cashData = cashSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashEntry));
      setCashEntries(cashData);
      
      // Récupérer les dépenses
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('projectId', '==', projectId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      
      const expensesSnapshot = await getDocs(expensesQuery);
      const expensesData = expensesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(expensesData);
      
      setLoading(false);
    } catch (err) {
      setError('Erreur lors de la récupération des données du projet');
      setLoading(false);
      console.error(err);
    }
  }, [projectId, startDate, endDate]);

  // Charger les données au chargement du composant et lorsque les filtres changent
  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
      fetchProjectData();
    }
  }, [projectId, fetchProjectDetails, fetchProjectData]);

  // Calculer les statistiques lorsque les données changent
  useEffect(() => {
    const inflowSum = cashEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const expensesSum = expenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
    
    setTotalInflow(inflowSum);
    setTotalExpenses(expensesSum);
    setBalance(inflowSum - expensesSum);
  }, [cashEntries, expenses]);
  
  // Générer un rapport PDF
  const generatePDF = useCallback(() => {
    if (!project) return;
    
    const doc = new jsPDF();
    
    // Titre
    doc.setFontSize(18);
    doc.text(`Rapport du projet: ${project.name}`, 14, 20);
    
    // Informations du projet
    doc.setFontSize(12);
    doc.text(`Période: ${format(parseISO(startDate), 'dd/MM/yyyy')} - ${format(parseISO(endDate), 'dd/MM/yyyy')}`, 14, 30);
    doc.text(`Description: ${project.description || 'Aucune description'}`, 14, 40);
    doc.text(`Solde: ${balance.toLocaleString()} FCFA`, 14, 50);
    
    // Tableau des entrées
    doc.setFontSize(14);
    doc.text('Entrées de fonds', 14, 65);
    
    if (cashEntries.length > 0) {
      const entriesTableData = cashEntries.map(entry => [
        format(parseISO(entry.date), 'dd/MM/yyyy'),
        entry.source,
        entry.description,
        `${entry.amount.toLocaleString()} FCFA`
      ]);
      
      (doc as any).autoTable({
        startY: 70,
        head: [['Date', 'Source', 'Description', 'Montant']],
        body: entriesTableData,
      });
    } else {
      doc.setFontSize(12);
      doc.text('Aucune entrée pour cette période', 14, 75);
    }
    
    // Tableau des dépenses
    const currentY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : 100;
    
    doc.setFontSize(14);
    doc.text('Dépenses', 14, currentY);
    
    if (expenses.length > 0) {
      const expensesTableData = expenses.map(expense => [
        format(parseISO(expense.date), 'dd/MM/yyyy'),
        expense.reference,
        expense.description,
        `${expense.totalAmount.toLocaleString()} FCFA`
      ]);
      
      (doc as any).autoTable({
        startY: currentY + 5,
        head: [['Date', 'Référence', 'Description', 'Montant']],
        body: expensesTableData,
      });
    } else {
      doc.setFontSize(12);
      doc.text('Aucune dépense pour cette période', 14, currentY + 10);
    }
    
    // Résumé financier
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 15 : currentY + 30;
    
    doc.setFontSize(14);
    doc.text('Résumé financier', 14, finalY);
    
    doc.setFontSize(12);
    doc.text(`Total des entrées: ${totalInflow.toLocaleString()} FCFA`, 14, finalY + 10);
    doc.text(`Total des dépenses: ${totalExpenses.toLocaleString()} FCFA`, 14, finalY + 20);
    doc.text(`Solde: ${balance.toLocaleString()} FCFA`, 14, finalY + 30);
    
    // Enregistrer le PDF
    doc.save(`rapport_projet_${project.name}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  }, [project, startDate, endDate, cashEntries, expenses, totalInflow, totalExpenses, balance]);
  
  // Fonction pour retourner à la liste des projets
  const goBack = useCallback(() => {
    navigate('/projects');
  }, [navigate]);
  
  // Fonction pour appliquer les filtres de date
  const applyDateFilter = useCallback(() => {
    fetchProjectData();
  }, [fetchProjectData]);
  
  return (
    <div className="container mx-auto px-4 py-8">
      {loading && <div className="text-center">Chargement des données...</div>}
      
      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
      
      {project && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <button
              onClick={goBack}
              className="flex items-center px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
            >
              <ArrowLeft className="mr-2" size={18} />
              Retour
            </button>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Informations du projet</h2>
            <p><strong>Description:</strong> {project.description || 'Aucune description'}</p>
            <p><strong>Date de début:</strong> {format(parseISO(project.startDate), 'dd/MM/yyyy')}</p>
            {project.endDate && (
              <p><strong>Date de fin:</strong> {format(parseISO(project.endDate), 'dd/MM/yyyy')}</p>
            )}
          </div>
          
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Filtrer par période</h2>
              <div className="flex space-x-2">
                <button
                  onClick={applyDateFilter}
                  className="flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  <Filter className="mr-2" size={18} />
                  Filtrer
                </button>
                <button
                  onClick={generatePDF}
                  className="flex items-center px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  <Download className="mr-2" size={18} />
                  Exporter PDF
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
                <div className="flex items-center">
                  <Calendar className="mr-2" size={18} />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border rounded px-3 py-2 w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
                <div className="flex items-center">
                  <Calendar className="mr-2" size={18} />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border rounded px-3 py-2 w-full"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-700 mb-2">Total des entrées</h3>
              <p className="text-2xl font-bold">{totalInflow.toLocaleString()} FCFA</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-700 mb-2">Total des dépenses</h3>
              <p className="text-2xl font-bold">{totalExpenses.toLocaleString()} FCFA</p>
            </div>
            <div className={`${balance >= 0 ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'} rounded-lg p-4`}>
              <h3 className={`text-lg font-semibold ${balance >= 0 ? 'text-green-700' : 'text-orange-700'} mb-2`}>Solde</h3>
              <p className="text-2xl font-bold">{balance.toLocaleString()} FCFA</p>
            </div>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Entrées de fonds</h2>
            {cashEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-4 border-b text-left">Date</th>
                      <th className="py-2 px-4 border-b text-left">Source</th>
                      <th className="py-2 px-4 border-b text-left">Description</th>
                      <th className="py-2 px-4 border-b text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-2 px-4 border-b">{format(parseISO(entry.date), 'dd/MM/yyyy')}</td>
                        <td className="py-2 px-4 border-b">{entry.source}</td>
                        <td className="py-2 px-4 border-b">{entry.description}</td>
                        <td className="py-2 px-4 border-b text-right">{entry.amount.toLocaleString()} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="py-2 px-4 border-t font-semibold" colSpan={3}>Total</td>
                      <td className="py-2 px-4 border-t text-right font-semibold">{totalInflow.toLocaleString()} FCFA</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 italic">Aucune entrée de fonds pour cette période</p>
            )}
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Dépenses</h2>
            {expenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="py-2 px-4 border-b text-left">Date</th>
                      <th className="py-2 px-4 border-b text-left">Référence</th>
                      <th className="py-2 px-4 border-b text-left">Description</th>
                      <th className="py-2 px-4 border-b text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((expense) => (
                      <tr key={expense.id}>
                        <td className="py-2 px-4 border-b">{format(parseISO(expense.date), 'dd/MM/yyyy')}</td>
                        <td className="py-2 px-4 border-b">{expense.reference}</td>
                        <td className="py-2 px-4 border-b">{expense.description}</td>
                        <td className="py-2 px-4 border-b text-right">{expense.totalAmount.toLocaleString()} FCFA</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="py-2 px-4 border-t font-semibold" colSpan={3}>Total</td>
                      <td className="py-2 px-4 border-t text-right font-semibold">{totalExpenses.toLocaleString()} FCFA</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 italic">Aucune dépense pour cette période</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ProjectDetails;
