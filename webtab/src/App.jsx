import { AuthProvider, ToastProvider } from './context/AuthContext';
import Shell from './components/Shell';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AuthProvider>
  );
}
