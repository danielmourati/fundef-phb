import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
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
import { LogOut, User, AlertTriangle, Bell, Check, FileText, Lock, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { maskPhone } from '@/lib/masks';


interface Message {
  id: string;
  title: string;
  content: string;
  created_at: string;
  read: boolean;
}

interface Contestacao {
  id: string;
  motivo: string;
  descricao: string;
  status: string;
  created_at: string;
  protocolo: string | null;
  resposta: string | null;
}

const DashboardPage = () => {
  const { professor, token, logout, matriculas, setMatriculaAtiva, requiresPasswordChange } = useAuth();
  const navigate = useNavigate();
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contestacoes, setContestacoes] = useState<Contestacao[]>([]);
  const [activeSection, setActiveSection] = useState<'dados' | 'mensagens' | 'contestacoes'>('dados');

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!professor) return;
    if (professor.role === 'admin') { navigate('/admin'); return; }
    if (professor.role === 'juridico') { navigate('/juridico'); return; }
    if (token) {
      fetchMessages();
      fetchContestacoes();
    }
  }, [professor?.id, token]);

  if (!professor) return null;
  if (professor.role === 'admin' || professor.role === 'juridico') return null;

  const fetchMessages = async () => {
    const { data } = await supabase.functions.invoke('professor-api?action=messages', {
      method: 'GET',
      headers: authHeaders,
    });
    if (data && Array.isArray(data)) setMessages(data);
  };

  const fetchContestacoes = async () => {
    const { data } = await supabase.functions.invoke('professor-api?action=contestacoes', {
      method: 'GET',
      headers: authHeaders,
    });
    if (data && Array.isArray(data)) setContestacoes(data);
  };

  const markAsRead = async (messageId: string) => {
    await supabase.functions.invoke('professor-api?action=mark_read', {
      method: 'POST',
      headers: authHeaders,
      body: { message_id: messageId },
    });
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, read: true } : m));
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatCpf = (cpf: string) => cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const formatDate = (value: string | null | undefined) => {
    if (!value) return '—';
    const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
    const digits = value.replace(/\D/g, '');
    if (digits.length === 8) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    return value;
  };
  const unreadCount = messages.filter(m => !m.read).length;

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
        headers: authHeaders,
      });

      if (error || (data && data.error)) {
        toast.error(data?.error || 'Erro ao enviar contestação.');
      } else {
        toast.success(`Contestação enviada! Protocolo: ${data?.protocolo || 'gerado'}`);
        setMotivo('');
        setDescricao('');
        setWhatsapp('');
        setSheetOpen(false);
        fetchContestacoes();
      }
    } catch {
      toast.error('Erro de conexão.');
    }

    setSubmitting(false);
  };

  const contestStatusColor = (status: string) => {
    switch (status) {
      case 'Deferido': return 'bg-green-100 text-green-700 border-green-200';
      case 'Indeferido': return 'bg-red-100 text-red-700 border-red-200';
      case 'Pendente': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  if (requiresPasswordChange) {
    const isLengthOk = newPassword.length >= 8;
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
    const isMatch = newPassword === confirmPassword && newPassword.length > 0;
    const canSubmit = isLengthOk && hasUpper && hasNumber && hasSpecial && isMatch;

    const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;
      setChangingPassword(true);
      const { data, error } = await supabase.functions.invoke('professor-api?action=change_password', {
        method: 'POST',
        headers: authHeaders,
        body: { new_password: newPassword },
      });
      setChangingPassword(false);
      if (error || data?.error) {
        toast.error(data?.error || 'Erro ao alterar senha.');
      } else {
        toast.success('Senha alterada com sucesso!');
        const stored = localStorage.getItem('fundef_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          parsed.requiresPasswordChange = false;
          localStorage.setItem('fundef_session', JSON.stringify(parsed));
        }
        window.location.reload();
      }
    };

    return (
      <div className="h-screen w-full bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-primary/20">
          <CardContent className="p-6">
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Atualização Obrigatória</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Para sua segurança, é necessário cadastrar uma nova senha no seu primeiro acesso.
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label>Nova Senha</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Confirmar Nova Senha</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2 mt-4">
                <p className="text-xs font-semibold mb-2">Sua senha deve conter:</p>
                <div className="flex items-center gap-2 text-xs">
                  {isLengthOk ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                  <span className={isLengthOk ? "text-green-600 font-medium" : "text-muted-foreground"}>Mínimo de 8 caracteres</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {hasUpper ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                  <span className={hasUpper ? "text-green-600 font-medium" : "text-muted-foreground"}>Pelo menos uma letra maiúscula</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {hasNumber ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                  <span className={hasNumber ? "text-green-600 font-medium" : "text-muted-foreground"}>Pelo menos um número</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {hasSpecial ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                  <span className={hasSpecial ? "text-green-600 font-medium" : "text-muted-foreground"}>Pelo menos um caractere especial (!@#$%^&*)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {isMatch ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Circle className="w-4 h-4 text-muted-foreground" />}
                  <span className={isMatch ? "text-green-600 font-medium" : "text-muted-foreground"}>As senhas coincidem</span>
                </div>
              </div>

              <Button type="submit" className="w-full mt-4" disabled={!canSubmit || changingPassword}>
                {changingPassword ? 'Atualizando...' : 'Salvar Nova Senha'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-background">
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-md shrink-0">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">FUNDEF - Precatórios</h1>
            <p className="text-xs opacity-80">SEDUC Parnaíba</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setActiveSection('mensagens')} className="text-primary-foreground hover:bg-primary/80 relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:bg-primary/80">
              <LogOut className="w-4 h-4 mr-1" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-5 pb-20 max-w-2xl mx-auto w-full">
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

        {/* Seletor de matrículas (aparece somente quando há mais de uma) */}
        {matriculas.length > 1 && (
          <div className="space-y-1.5">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider px-1">
              Você possui {matriculas.length} matrículas. Selecione para visualizar:
            </p>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {matriculas.map(m => {
                const active = m.id === professor.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMatriculaAtiva(m.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors ${active
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:bg-muted'
                      }`}
                  >
                    Matrícula {m.matricula}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {[
            { key: 'dados' as const, label: 'Meus Dados', icon: User },
            { key: 'mensagens' as const, label: `Mensagens${unreadCount > 0 ? ` (${unreadCount})` : ''}`, icon: Bell },
            { key: 'contestacoes' as const, label: 'Contestações', icon: FileText },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${activeSection === tab.key
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dados Section */}
        {activeSection === 'dados' && (
          <>
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-5 pt-5 pb-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Matrícula</p>
                    <p className="text-2xl font-bold tracking-tight">{professor.matricula}</p>
                  </div>
                </div>

                <div className="border-t mx-5" />

                <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Data de Admissão</p>
                    <p className="font-medium text-sm">{formatDate(professor.vinculo_inicio)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Data da Aposentadoria</p>
                    <p className="font-medium text-sm">{formatDate(professor.vinculo_fim)}</p>
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

              </CardContent>
            </Card>

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
          </>
        )}

        {/* Mensagens Section */}
        {activeSection === 'mensagens' && (
          <div className="space-y-3">
            {messages.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  Nenhuma mensagem recebida.
                </CardContent>
              </Card>
            ) : (
              messages.map(m => (
                <Card key={m.id} className={`${!m.read ? 'border-primary/30 bg-primary/5' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {!m.read && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                          <h4 className="font-semibold text-sm">{m.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground">{m.content}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!m.read && (
                        <Button size="sm" variant="ghost" onClick={() => markAsRead(m.id)} className="text-xs">
                          <Check className="w-3.5 h-3.5 mr-1" /> Lida
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Contestações Section */}
        {activeSection === 'contestacoes' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Minhas Contestações</h3>
              <Button size="sm" variant="outline" onClick={() => setSheetOpen(true)}>
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Nova
              </Button>
            </div>
            {contestacoes.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  Nenhuma contestação registrada.
                </CardContent>
              </Card>
            ) : (
              contestacoes.map(c => (
                <Card key={c.id}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{c.protocolo || '—'}</p>
                        <p className="font-semibold text-sm">{c.motivo}</p>
                      </div>
                      <Badge className={`text-[10px] border ${contestStatusColor(c.status)}`}>{c.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{c.descricao}</p>
                    {c.resposta && (
                      <div className="bg-muted/50 rounded p-2 mt-2">
                        <p className="text-xs text-muted-foreground font-medium mb-0.5">Parecer Jurídico:</p>
                        <p className="text-xs">{c.resposta}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
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
                onChange={(e) => setWhatsapp(maskPhone(e.target.value))}
                inputMode="numeric"
                maxLength={15}
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
