import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, MessageCircle } from 'lucide-react';
import loginImage from '@/assets/login-education.jpg';
import logoSeduc from '@/assets/logo-seduc-azul.png';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';

const LoginPage = () => {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMatricula, setReportMatricula] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(cpf, senha);
    setIsLoading(false);

    if (result.success) {
      const stored = localStorage.getItem('fundef_session');
      if (stored) {
        const session = JSON.parse(stored);
        const role = session.professor?.role;
        navigate(role === 'admin' ? '/admin' : role === 'juridico' ? '/juridico' : '/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error || 'Erro ao fazer login.');
    }
  };

  const handleReport = () => {
    toast({
      title: 'Relatório enviado',
      description: 'Sua solicitação foi registrada. A equipe de suporte entrará em contato.',
    });
    setReportOpen(false);
    setReportMatricula('');
    setReportMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={loginImage}
          alt="Professores em sala de aula"
          className="absolute inset-0 w-full h-full object-cover"
          width={960}
          height={1080}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/40 to-primary/20" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <h2 className="text-3xl font-bold mb-3">FUNDEF - Precatórios</h2>
          <p className="text-lg text-white/90 max-w-md">
            Sistema de Gestão e Consulta de Precatórios da SEDUC Parnaíba.
          </p>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="flex flex-col items-center space-y-6">
            <img
              src={logoSeduc}
              alt="SEDUC Parnaíba"
              className="h-16 object-contain"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Bem-vindo(a) 👋</h1>
              <p className="text-muted-foreground mt-1">Informe seus dados para acessar o sistema</p>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">acesso ao sistema</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="cpf" className="text-sm font-medium">
                CPF <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cpf"
                placeholder="Digite seu CPF (somente números)"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                required
                className="h-12 rounded-lg"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha" className="text-sm font-medium">
                Senha <span className="text-destructive">*</span>
              </Label>
              <Input
                id="senha"
                type="password"
                placeholder="Data de nascimento (DDMMAAAA)"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="h-12 rounded-lg"
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
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          {/* Report button */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1.5 font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              Não consegue acessar? Reportar problema
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            A senha padrão é sua data de nascimento (somente números).
          </p>
        </div>

        <footer className="mt-12 text-center text-xs text-muted-foreground">
          Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba
        </footer>
      </div>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reportar problema de acesso</DialogTitle>
            <DialogDescription>
              Preencha as informações abaixo para que a equipe de suporte possa ajudá-lo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="report-matricula">Matrícula (se souber)</Label>
              <Input
                id="report-matricula"
                placeholder="Sua matrícula"
                value={reportMatricula}
                onChange={(e) => setReportMatricula(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-msg">Descreva o problema</Label>
              <Textarea
                id="report-msg"
                placeholder="Ex: Não consigo acessar, esqueci minha senha..."
                value={reportMessage}
                onChange={(e) => setReportMessage(e.target.value)}
                rows={4}
              />
            </div>
            <Button onClick={handleReport} className="w-full" disabled={!reportMessage.trim()}>
              Enviar relatório
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LoginPage;
