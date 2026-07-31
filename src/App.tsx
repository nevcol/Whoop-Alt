import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Clients } from './pages/Clients';
import { ClientDetail } from './pages/ClientDetail';
import { Invoices } from './pages/Invoices';
import { InvoiceEditor } from './pages/InvoiceEditor';
import { InvoiceDetail } from './pages/InvoiceDetail';
import { Estimates } from './pages/Estimates';
import { EstimateEditor } from './pages/EstimateEditor';
import { EstimateDetail } from './pages/EstimateDetail';
import { Services } from './pages/Services';
import { SettingsPage } from './pages/Settings';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<InvoiceEditor />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="invoices/:id/edit" element={<InvoiceEditor />} />
        <Route path="estimates" element={<Estimates />} />
        <Route path="estimates/new" element={<EstimateEditor />} />
        <Route path="estimates/:id" element={<EstimateDetail />} />
        <Route path="estimates/:id/edit" element={<EstimateEditor />} />
        <Route path="services" element={<Services />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
