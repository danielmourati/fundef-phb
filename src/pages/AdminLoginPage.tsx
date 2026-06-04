import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import logoSeduc from '@/assets/logo-seduc-azul.png';


const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, senha);
    setIsLoading(false);
    if (result.success) {
      const stored = localStorage.getItem('fundef_session');
      const role = stored ? JSON.parse(stored).professor?.role : null;
      if (role === 'admin') navigate('/admin');
      else if (role === 'juridico') navigate('/juridico');
      else {
        setError('Esta tela é restrita para Admin e Jurídico.');
      }
    } else {
      setError(result.error || 'E-mail ou senha incorretos.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center space-y-4">
          <img src={logoSeduc} alt="SEDUC Parnaíba" className="h-12 object-contain" />
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">Acesso Restrito</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Administração / Jurídico</h1>
            <p className="text-muted-foreground mt-1 text-sm">Entre com seu e-mail institucional</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail <span className="text-destructive">*</span></Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.gov.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-12 rounded-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha">Senha <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="senha"
                type={showPassword ? "text" : "password"}
                placeholder="Sua senha"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="h-12 rounded-lg pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full h-12 rounded-lg text-base font-semibold" disabled={isLoading}>
            {isLoading ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="text-sm text-primary hover:underline"
          >
            Sou professor — acessar com CPF
          </button>
        </div>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba
        </footer>
      </div>
    </div>
  );
};

export default AdminLoginPage;
