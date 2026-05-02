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

interface MatriculaOption {
  id: string;
  nome: string;
  matricula: string;
  vinculo_inicio: string | null;
  vinculo_fim: string | null;
  total_cotas: number | null;
  status: string;
}

const formatCpfInput = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const LoginPage = () => {
  const [cpf, setCpf] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMatricula, setReportMatricula] = useState('');
  const [reportMessage, setReportMessage] = useState('');

  // Multi-matrícula selection
  const [matriculaDialogOpen, setMatriculaDialogOpen] = useState(false);
  const [matriculas, setMatriculas] = useState<MatriculaOption[]>([]);
  const [selectingMatricula, setSelectingMatricula] = useState(false);

  const { login, selectMatricula } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(cpf.replace(/\D/g, ''), senha);
    setIsLoading(false);

    if (result.multiple_matriculas && result.matriculas) {
      setMatriculas(result.matriculas);
      setMatriculaDialogOpen(true);
      return;
    }

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

  const handleSelectMatricula = async (matriculaId: string) => {
    setSelectingMatricula(true);
    const result = await selectMatricula(cpf.replace(/\D/g, ''), senha, matriculaId);
    setSelectingMatricula(false);

    if (result.success) {
      setMatriculaDialogOpen(false);
      navigate('/dashboard');
    } else {
      setError(result.error || 'Erro ao selecionar matrícula.');
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
    <div className="h-screen flex flex-col lg:flex-row bg-background overflow-hidden">
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
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 lg:px-16 overflow-y-auto">
        <div className="w-full max-w-md space-y-8 my-auto">
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
                placeholder="000.000.000-00"
                value={cpf}
                onChange={(e) => setCpf(formatCpfInput(e.target.value))}
                required
                className="h-12 rounded-lg"
                maxLength={14}
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

      {/* Matrícula Selection Dialog */}
      <Dialog open={matriculaDialogOpen} onOpenChange={setMatriculaDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Selecionar Matrícula</DialogTitle>
            <DialogDescription>
              Seu CPF possui mais de uma matrícula vinculada. Selecione qual deseja acessar:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2 max-h-[400px] overflow-y-auto">
            {matriculas.map((m) => (
              <button
                key={m.id}
                onClick={() => handleSelectMatricula(m.id)}
                disabled={selectingMatricula}
                className="w-full text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{m.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Matrícula: <span className="font-mono font-medium text-foreground">{m.matricula}</span>
                    </p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    m.status === 'Validado' ? 'bg-green-100 text-green-700 border-green-200' :
                    m.status === 'Em Análise' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                    'bg-yellow-100 text-yellow-700 border-yellow-200'
                  }`}>
                    {m.status}
                  </span>
                </div>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Vínculo: {m.vinculo_inicio || '—'} a {m.vinculo_fim || '—'}</span>
                  <span>Cotas: {m.total_cotas ?? '—'}</span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
              <Label htmlFor="report-matricula">CPF ou Matrícula (se souber)</Label>
              <Input
                id="report-matricula"
                placeholder="Seu CPF ou matrícula"
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
