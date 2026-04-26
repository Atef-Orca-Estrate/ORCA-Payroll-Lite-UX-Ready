import { AuthProvider, ToastProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Shell from './components/Shell';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
