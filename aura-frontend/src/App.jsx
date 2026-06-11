import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Segments from './pages/Segments';
import Campaigns from './pages/Campaigns';
import AiAssistant from './pages/AiAssistant';
import { useAppStore } from './store/useAppStore';

const pages = {
  '/dashboard': Dashboard,
  '/customers': Customers,
  '/segments': Segments,
  '/campaigns': Campaigns,
  '/ai': AiAssistant
};

export default function App() {
  const route = useAppStore((state) => state.route);
  const Page = pages[route] || Dashboard;
  return (
    <Layout>
      <Page />
    </Layout>
  );
}
