import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import FirstAccessInfoDialog from '@/components/FirstAccessInfoDialog';

const Index = () => {
  const { professor, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (professor) {
      navigate(professor.role === 'admin' ? '/admin' : '/dashboard');
    } else {
      navigate('/login');
    }
  }, [professor, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Carregando...</p>
      {!loading && !professor && <FirstAccessInfoDialog />}
    </div>
  );
};

export default Index;
