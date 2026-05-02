import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, Shield } from 'lucide-react';
import logoSeduc from '@/assets/logo-seduc-azul.png';

const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await loginAdmin(email, senha);
    setIsLoading(false);

    if (result.success) {
      const stored = localStorage.getItem('fundef_session');
      if (stored) {
        const session = JSON.parse(stored);
        const role = session.professor?.role;
        navigate(role === 'juridico' ? '/juridico' : '/admin');
      } else {
        navigate('/admin');
      }
    } else {
      setError(result.error || 'Erro ao fazer login.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Subtle gradient header bar */}
      <div className="h-1.5 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">
          {/* Logo & Header */}
          <div className="flex flex-col items-center space-y-6">
            <img
              src={logoSeduc}
              alt="SEDUC Parnaíba"
              className="h-14 object-contain"
            />
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full">
                <Shield className="w-3.5 h-3.5" />
                ÁREA RESTRITA
              </div>
              <h1 className="text-2xl font-bold text-foreground">Acesso Administrativo</h1>
              <p className="text-muted-foreground text-sm">
                Painel exclusivo para administradores e equipe jurídica.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">credenciais</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="text-sm font-medium">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-lg"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-senha" className="text-sm font-medium">
                Senha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="admin-senha"
                type="password"
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="h-12 rounded-lg"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-lg text-base font-semibold"
              disabled={isLoading}
            >
              {isLoading ? 'Autenticando...' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Utilize o e-mail e senha fornecidos pela administração do sistema.
          </p>
        </div>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba
        </footer>
      </div>
    </div>
  );
};

export default AdminLoginPage;
