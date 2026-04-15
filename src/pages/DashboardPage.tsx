import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { LogOut, User, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const STEPS = ['Pendente', 'Em Análise', 'Validado'] as const;

const stepColors: Record<string, { active: string; dot: string }> = {
  'Pendente': { active: 'text-yellow-600', dot: 'bg-yellow-500' },
  'Em Análise': { active: 'text-blue-600', dot: 'bg-blue-500' },
  'Validado': { active: 'text-green-600', dot: 'bg-green-500' },
};

const DashboardPage = () => {
  const { professor, token, logout } = useAuth();
  const navigate = useNavigate();
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!professor) return null;

  if (professor.role === 'admin') {
    navigate('/admin');
    return null;
  }

  if (professor.role === 'juridico') {
    navigate('/juridico');
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const currentStepIndex = STEPS.indexOf(professor.status as typeof STEPS[number]);

  const formatCpf = (cpf: string) => cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

  const handleContestacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo || !descricao || !whatsapp) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('professor-api?action=create_contestacao', {
        body: { motivo, descricao, whatsapp },
        headers: { Authorization: `Bearer ${token}` },
      });

      if (error || (data && data.error)) {
        toast.error(data?.error || 'Erro ao enviar contestação.');
      } else {
        toast.success('Contestação enviada com sucesso!');
        setMotivo('');
        setDescricao('');
        setWhatsapp('');
        setSheetOpen(false);
      }
    } catch {
      toast.error('Erro de conexão.');
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-md">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">FUNDEF - Precatórios</h1>
            <p className="text-xs opacity-80">SEDUC Parnaíba</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:bg-primary/80">
            <LogOut className="w-4 h-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-5 pb-20">
        {/* Greeting */}
        <div className="flex items-center gap-3 pt-2">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Bem-vindo(a)</p>
            <p className="font-semibold text-lg leading-tight">{professor.nome}</p>
          </div>
        </div>

        {/* Main Card */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {/* Header row */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Matrícula</p>
                <p className="text-2xl font-bold tracking-tight">{professor.matricula}</p>
              </div>
              <Badge className={`${
                professor.status === 'Validado' ? 'bg-green-100 text-green-700 border-green-200' :
                professor.status === 'Em Análise' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                'bg-yellow-100 text-yellow-700 border-yellow-200'
              } border text-xs font-semibold`}>
                {professor.status}
              </Badge>
            </div>

            <div className="border-t mx-5" />

            {/* Data grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Vínculo Início</p>
                <p className="font-medium text-sm">{professor.vinculo_inicio || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Vínculo Fim</p>
                <p className="font-medium text-sm">{professor.vinculo_fim || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">CPF</p>
                <p className="font-medium text-sm">{formatCpf(professor.cpf)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total de Cotas</p>
                <p className="font-medium text-sm">{professor.total_cotas ?? '—'} meses</p>
              </div>
            </div>

            <div className="border-t mx-5" />

            {/* Stepper */}
            <div className="px-5 py-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Situação do Processo</p>
              <div className="flex items-center">
                {STEPS.map((step, i) => {
                  const isActive = i <= currentStepIndex;
                  const isCurrent = i === currentStepIndex;
                  const colors = stepColors[step];
                  return (
                    <div key={step} className="flex items-center flex-1 last:flex-none">
                      <div className="flex flex-col items-center gap-1.5 min-w-[60px]">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                          isCurrent
                            ? `${colors.dot} text-white border-transparent shadow-md`
                            : isActive
                              ? `${colors.dot} text-white border-transparent opacity-70`
                              : 'bg-muted border-border text-muted-foreground'
                        }`}>
                          {i + 1}
                        </div>
                        <span className={`text-[11px] font-medium ${isCurrent ? colors.active : isActive ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                          {step}
                        </span>
                      </div>
                      {i < STEPS.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-1 mt-[-18px] rounded ${isActive && i < currentStepIndex ? 'bg-primary/40' : 'bg-border'}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contestar button + explanation */}
        <div className="space-y-2">
          <Button
            onClick={() => setSheetOpen(true)}
            variant="outline"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/5"
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Contestar Dados
          </Button>
          <p className="text-xs text-muted-foreground text-center px-4">
            Caso identifique alguma divergência nos seus dados, clique acima para abrir uma contestação. Nossa equipe jurídica analisará e retornará pelo contato informado.
          </p>
        </div>
      </main>

      {/* Contestação Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Abrir Contestação</SheetTitle>
            <SheetDescription>
              Preencha os dados abaixo para registrar sua contestação. Todos os campos são obrigatórios.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleContestacao} className="space-y-4 mt-6">
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo *</Label>
              <Select value={motivo} onValueChange={setMotivo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Divergência de período">Divergência de período</SelectItem>
                  <SelectItem value="Divergência de cotas">Divergência de cotas</SelectItem>
                  <SelectItem value="Dados cadastrais incorretos">Dados cadastrais incorretos</SelectItem>
                  <SelectItem value="Outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Textarea
                id="descricao"
                placeholder="Descreva brevemente sua contestação..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                maxLength={500}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp / Telefone *</Label>
              <Input
                id="whatsapp"
                placeholder="(86) 99999-9999"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? 'Enviando...' : 'Enviar Contestação'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-xs text-muted-foreground border-t bg-background">
        Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba
      </footer>
    </div>
  );
};

export default DashboardPage;
