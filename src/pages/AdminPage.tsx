import { useEffect, useState, useRef } from 'react';
import logoSeduc from '@/assets/logo-seduc.png';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  LogOut, Upload, Download, Users, AlertTriangle, Settings, Plus, Pencil, Trash2, Save,
  LayoutDashboard, FileText, Search, Send, MessageSquare, Menu, Eye, EyeOff, Trash, Loader2,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { maskCPF, unmaskCPF, isValidCPF, maskDate, isValidDate } from '@/lib/masks';

interface Professor {
  id: string;
  matricula: string;
  nome: string;
  cpf: string;
  data_nascimento: string | null;
  vinculo_inicio: string | null;
  vinculo_fim: string | null;
  total_cotas: number | null;
  role: string;
}

interface Contestacao {
  id: string;
  motivo: string;
  descricao: string;
  whatsapp: string | null;
  status: string;
  created_at: string;
  professors: { nome: string; matricula: string } | null;
}

interface Message {
  id: string;
  title: string;
  content: string;
  scheduled_at: string | null;
  sent: boolean;
  created_at: string;
}

const emptyProfessor = {
  nome: '', cpf: '', matricula: '', senha: '', data_nascimento: '',
  vinculo_inicio: '', vinculo_fim: '', total_cotas: 0, role: 'professor',
};

type ActiveTab = 'dashboard' | 'professors' | 'contestacoes' | 'messages' | 'settings';

const navItems: { key: ActiveTab; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'professors', label: 'Professores', icon: Users },
  { key: 'contestacoes', label: 'Contestações', icon: AlertTriangle },
  { key: 'messages', label: 'Mensagens', icon: MessageSquare },
  { key: 'settings', label: 'Configurações', icon: Settings },
];

const AdminPage = () => {
  const { professor, token, logout } = useAuth();
  const navigate = useNavigate();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [contestacoes, setContestacoes] = useState<Contestacao[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<any>(null);
  const [formData, setFormData] = useState(emptyProfessor);

  const [emailDestino, setEmailDestino] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Message form state
  const [msgTitle, setMsgTitle] = useState('');
  const [msgContent, setMsgContent] = useState('');
  const [msgScheduled, setMsgScheduled] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgDialogOpen, setMsgDialogOpen] = useState(false);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!professor || professor.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchData();
    fetchSettings();
  }, [professor, navigate]);

  const apiCall = async (method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH", action: string, body?: unknown) => {
    const opts: { method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"; headers: Record<string, string>; body?: unknown } = {
      method,
      headers: authHeaders,
    };
    if (body) opts.body = body;
    const { data, error } = await supabase.functions.invoke(`admin-api?action=${action}`, opts);
    return { data, error };
  };

  const fetchData = async () => {
    setLoading(true);
    const [profRes, contRes, msgRes] = await Promise.all([
      apiCall('GET', 'professors'),
      apiCall('GET', 'contestacoes'),
      apiCall('GET', 'messages'),
    ]);
    if (profRes.data && Array.isArray(profRes.data)) setProfessors(profRes.data);
    if (contRes.data && Array.isArray(contRes.data)) setContestacoes(contRes.data);
    if (msgRes.data && Array.isArray(msgRes.data)) setMessages(msgRes.data);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await apiCall('GET', 'settings');
    if (data && Array.isArray(data)) {
      const emailSetting = data.find((s: any) => s.key === 'email_destino');
      if (emailSetting) setEmailDestino(emailSetting.value);
    }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const openAddDialog = () => {
    setEditingProf(null);
    setFormData(emptyProfessor);
    setDialogOpen(true);
  };

  const openEditDialog = (p: Professor) => {
    setEditingProf(p);
    setFormData({
      nome: p.nome, cpf: maskCPF(p.cpf || ''), matricula: p.matricula, senha: '',
      data_nascimento: maskDate(p.data_nascimento || ''),
      vinculo_inicio: maskDate(p.vinculo_inicio || ''),
      vinculo_fim: maskDate(p.vinculo_fim || ''),
      total_cotas: p.total_cotas || 0,
      role: p.role,
    });
    setDialogOpen(true);
  };

  const handleSaveProf = async () => {
    if (!formData.nome || !formData.matricula || !formData.cpf) {
      toast.error('Nome, Matrícula e CPF são obrigatórios.');
      return;
    }
    if (!isValidCPF(formData.cpf)) {
      toast.error('CPF inválido.');
      return;
    }
    if (!isValidDate(formData.data_nascimento)) {
      toast.error('Data de nascimento inválida (use DD/MM/AAAA).');
      return;
    }
    if (!isValidDate(formData.vinculo_inicio)) {
      toast.error('Vínculo Início inválido (use DD/MM/AAAA).');
      return;
    }
    if (!isValidDate(formData.vinculo_fim)) {
      toast.error('Vínculo Fim inválido (use DD/MM/AAAA).');
      return;
    }
    const payload = { ...formData, cpf: unmaskCPF(formData.cpf) };
    if (editingProf) {
      const { data, error } = await apiCall('PUT', 'update_professor', { ...payload, id: editingProf.id });
      if (error || data?.error) { toast.error(data?.error || 'Erro ao atualizar.'); return; }
      toast.success('Professor atualizado!');
    } else {
      const { data, error } = await apiCall('POST', 'create_professor', payload);
      if (error || data?.error) { toast.error(data?.error || 'Erro ao adicionar.'); return; }
      toast.success('Professor adicionado!');
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDeleteProf = async (id: string, nome: string) => {
    if (!confirm(`Excluir ${nome}? Esta ação não pode ser desfeita.`)) return;
    const { data, error } = await supabase.functions.invoke(`admin-api?action=delete_professor&id=${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (error || data?.error) { toast.error(data?.error || 'Erro ao excluir.'); return; }
    toast.success('Professor excluído!');
    fetchData();
  };

  const handleClearDatabase = async () => {
    if (!confirm('ATENÇÃO: Isso excluirá TODOS os professores e contestações do sistema. Esta ação não pode ser desfeita. Deseja continuar?')) return;
    setLoading(true);
    const { data, error } = await apiCall('POST', 'delete_all_professors');
    setLoading(false);
    if (error || data?.error) { toast.error(data?.error || 'Erro ao limpar base.'); return; }
    toast.success('Base de dados limpa com sucesso!');
    fetchData();
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportProgress({ current: 0, total: 0 });
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) { toast.error('CSV vazio ou inválido.'); return; }
      // Detecta delimitador (`;` ou `,`) a partir da linha de cabeçalho
      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/^\ufeff/, ''));
      const rows = lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim());
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = values[i] || ''; });
        return obj;
      });
      const CHUNK = 100;
      setImportProgress({ current: 0, total: rows.length });
      let imported = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { data, error } = await apiCall('POST', 'import_csv', { rows: chunk });
        if (error || data?.error) {
          toast.error(data?.error || 'Erro na importação.');
          return;
        }
        imported += data?.count || chunk.length;
        setImportProgress({ current: imported, total: rows.length });
      }
      toast.success(`${imported} professor(es) importado(s)!`);
      fetchData();
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportContestacoes = () => {
    if (contestacoes.length === 0) { toast.error('Nenhuma contestação.'); return; }
    const csvRows = [
      ['Matrícula', 'Nome', 'Motivo', 'Descrição', 'WhatsApp', 'Status', 'Data'].join(','),
      ...contestacoes.map(c => [
        c.professors?.matricula || '', `"${c.professors?.nome || ''}"`,
        `"${c.motivo}"`, `"${c.descricao}"`, c.whatsapp || '', c.status,
        new Date(c.created_at).toLocaleDateString('pt-BR'),
      ].join(',')),
    ].join('\n');
    const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contestacoes_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório exportado!');
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const { data, error } = await apiCall('PUT', 'save_settings', { key: 'email_destino', value: emailDestino });
    setSavingSettings(false);
    if (error || data?.error) toast.error(data?.error || 'Erro ao salvar.');
    else toast.success('Configurações salvas!');
  };

  const handleSendMessage = async () => {
    if (!msgTitle || !msgContent) {
      toast.error('Título e conteúdo são obrigatórios.');
      return;
    }
    setSendingMsg(true);
    const { data, error } = await apiCall('POST', 'create_message', {
      title: msgTitle,
      content: msgContent,
      scheduled_at: msgScheduled || null,
    });
    setSendingMsg(false);
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao enviar.');
      return;
    }
    toast.success(msgScheduled ? 'Mensagem programada!' : 'Mensagem enviada!');
    setMsgTitle('');
    setMsgContent('');
    setMsgScheduled('');
    setMsgDialogOpen(false);
    fetchData();
  };

  const handleDeleteMessage = async (id: string) => {
    if (!confirm('Excluir esta mensagem?')) return;
    const { data, error } = await supabase.functions.invoke(`admin-api?action=delete_message&id=${id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (error || data?.error) toast.error(data?.error || 'Erro ao excluir.');
    else { toast.success('Mensagem excluída!'); fetchData(); }
  };

  if (!professor || professor.role !== 'admin') return null;

  const nonAdminProfs = professors;
  const filteredProfs = nonAdminProfs.filter(p =>
    !searchQuery ||
    p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.matricula.includes(searchQuery) ||
    p.cpf.includes(searchQuery)
  );
  const statCards = [
    { label: 'Total Professores', value: nonAdminProfs.length, icon: Users, color: 'bg-primary/10 text-primary' },
    { label: 'Contestações', value: contestacoes.length, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
    { label: 'Mensagens', value: messages.length, icon: MessageSquare, color: 'bg-blue-50 text-blue-600' },
  ];

  return (
    <div className="h-screen overflow-hidden flex bg-muted/30">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-card border-r border-border flex-col h-full shrink-0">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <img src={logoSeduc} alt="SEDUC Parnaíba" className="h-12 object-contain" />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{professor.nome}</p>
              <p className="text-xs text-muted-foreground">Administrador</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-4 lg:px-8 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <div className="p-4 border-b border-border flex items-center gap-3">
                  <img src={logoSeduc} alt="SEDUC Parnaíba" className="h-10 object-contain" />
                </div>
                <nav className="flex-1 p-3 space-y-1">
                  {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setActiveTab(item.key)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
                <div className="p-4 border-t border-border mt-auto">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{professor.nome}</p>
                      <p className="text-xs text-muted-foreground">Administrador</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-muted-foreground hover:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" /> Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <div>
              <h2 className="text-lg lg:text-xl font-semibold text-foreground">
                {navItems.find(n => n.key === activeTab)?.label}
              </h2>
              <p className="text-[10px] lg:text-xs text-muted-foreground">
                Painel Administrativo • Última atualização: agora
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {(activeTab === 'professors' || activeTab === 'dashboard') && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="pl-9 w-32 lg:w-64 h-9"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 space-y-6 overflow-y-auto">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {statCards.map(stat => {
                  const Icon = stat.icon;
                  return (
                    <Card key={stat.label} className="border">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                            <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                          </div>
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.color}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Quick Table */}
              <Card>
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h3 className="font-semibold text-foreground">Professores Recentes</h3>
                    <Button size="sm" variant="ghost" onClick={() => setActiveTab('professors')} className="text-primary text-xs">
                      Ver todos →
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-medium text-muted-foreground">Matrícula</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Nome</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">CPF</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Cotas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProfs.slice(0, 5).map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-sm">{p.matricula}</TableCell>
                            <TableCell className="text-sm">{p.nome}</TableCell>
                            <TableCell className="font-mono text-sm">{p.cpf}</TableCell>
                            <TableCell className="text-sm">{p.total_cotas || 0}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Professors Tab */}
          {activeTab === 'professors' && (
            <Card>
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-border gap-4">
                  <h3 className="font-semibold text-foreground">Professores ({nonAdminProfs.length})</h3>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} disabled={importing} />
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                      {importing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          {importProgress.total > 0 ? `Importando ${importProgress.current}/${importProgress.total}` : 'Importando...'}
                        </>
                      ) : (
                        <><Upload className="w-4 h-4 mr-1.5" /> Importar</>
                      )}
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={handleClearDatabase}>
                      <Trash className="w-4 h-4 mr-1.5" /> Limpar Base
                    </Button>
                    <Button size="sm" className="flex-1 sm:flex-none" onClick={openAddDialog}>
                      <Plus className="w-4 h-4 mr-1.5" /> Adicionar
                    </Button>
                  </div>
                </div>
                {loading ? (
                  <div className="p-6 text-muted-foreground text-sm">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-medium text-muted-foreground w-[80px] lg:w-[120px]">Matrícula</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground min-w-[150px]">Nome</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground hidden lg:table-cell">CPF</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground hidden md:table-cell">Perfil</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground hidden sm:table-cell">Cotas</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground text-right sticky right-0 bg-card/95 backdrop-blur-sm z-10 border-l border-border px-4 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProfs.map(p => (
                          <TableRow key={p.id} className="group">
                            <TableCell className="font-mono text-xs lg:text-sm py-3">{p.matricula}</TableCell>
                            <TableCell className="text-xs lg:text-sm font-medium py-3">{p.nome}</TableCell>
                            <TableCell className="font-mono text-xs lg:text-sm hidden lg:table-cell py-3">{p.cpf}</TableCell>
                            <TableCell className="hidden md:table-cell py-3">
                              <Badge variant="outline" className="text-[10px] lg:text-xs capitalize px-2 py-0">{p.role}</Badge>
                            </TableCell>
                            <TableCell className="text-xs lg:text-sm hidden sm:table-cell py-3">{p.total_cotas || 0}</TableCell>
                            <TableCell className="text-right sticky right-0 bg-card/95 backdrop-blur-sm z-10 border-l border-border px-4 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)] group-hover:bg-accent/50 transition-colors">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-background" onClick={() => openEditDialog(p)} title="Editar">
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteProf(p.id, p.nome)} title="Excluir">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contestações Tab */}
          {activeTab === 'contestacoes' && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">Contestações ({contestacoes.length})</h3>
                  <Button size="sm" variant="outline" onClick={exportContestacoes}>
                    <Download className="w-4 h-4 mr-1.5" /> Exportar CSV
                  </Button>
                </div>
                {loading ? (
                  <div className="p-6 text-muted-foreground text-sm">Carregando...</div>
                ) : contestacoes.length === 0 ? (
                  <div className="p-6 text-muted-foreground text-sm">Nenhuma contestação registrada.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-medium text-muted-foreground">Matrícula</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Nome</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Motivo</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Descrição</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">WhatsApp</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contestacoes.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-sm">{c.professors?.matricula}</TableCell>
                            <TableCell className="text-sm">{c.professors?.nome}</TableCell>
                            <TableCell className="text-sm">{c.motivo}</TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm">{c.descricao}</TableCell>
                            <TableCell className="text-sm">{c.whatsapp || '—'}</TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{c.status}</Badge></TableCell>
                            <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString('pt-BR')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Messages Tab */}
          {activeTab === 'messages' && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Mensagens ({messages.length})</h3>
                <Button size="sm" onClick={() => setMsgDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Nova Mensagem
                </Button>
              </div>

              {messages.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    Nenhuma mensagem enviada ainda.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {messages.map(m => (
                    <Card key={m.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-sm">{m.title}</h4>
                              <Badge variant={m.sent ? "default" : "secondary"} className="text-[10px]">
                                {m.sent ? 'Enviada' : 'Programada'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2">{m.content}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {m.scheduled_at && ` • Programada para ${new Date(m.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                            </p>
                          </div>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteMessage(m.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* New Message Dialog */}
              <Dialog open={msgDialogOpen} onOpenChange={setMsgDialogOpen}>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Nova Mensagem</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Título *</Label>
                      <Input value={msgTitle} onChange={e => setMsgTitle(e.target.value)} placeholder="Assunto da mensagem" />
                    </div>
                    <div className="space-y-2">
                      <Label>Conteúdo *</Label>
                      <Textarea value={msgContent} onChange={e => setMsgContent(e.target.value)} placeholder="Digite o conteúdo da mensagem..." rows={5} />
                    </div>
                    <div className="space-y-2">
                      <Label>Programar envio (opcional)</Label>
                      <Input type="datetime-local" value={msgScheduled} onChange={e => setMsgScheduled(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Deixe vazio para enviar imediatamente.</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setMsgDialogOpen(false)}>Cancelar</Button>
                    <Button onClick={handleSendMessage} disabled={sendingMsg}>
                      <Send className="w-4 h-4 mr-1.5" />
                      {sendingMsg ? 'Enviando...' : msgScheduled ? 'Programar' : 'Enviar Agora'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}

          {activeTab === 'settings' && (
            <Card>
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Configurações do Sistema</h3>
                  <p className="text-xs text-muted-foreground">Gerencie as configurações gerais do sistema.</p>
                </div>
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="email_destino">E-mail de destino das contestações</Label>
                  <Input
                    id="email_destino"
                    type="email"
                    placeholder="advogada@exemplo.com"
                    value={emailDestino}
                    onChange={(e) => setEmailDestino(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">As contestações serão notificadas para este e-mail.</p>
                </div>
                <Button onClick={handleSaveSettings} disabled={savingSettings}>
                  <Save className="w-4 h-4 mr-1.5" /> {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </CardContent>
            </Card>
          )}
        </main>

        <footer className="py-3 text-center text-xs text-muted-foreground border-t border-border bg-card">
          Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba
        </footer>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProf ? 'Editar Professor' : 'Adicionar Professor'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input
                  value={formData.cpf}
                  onChange={e => setFormData({...formData, cpf: maskCPF(e.target.value)})}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  maxLength={14}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Matrícula *</Label>
                <Input value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Data Nascimento</Label>
                <Input
                  value={formData.data_nascimento}
                  onChange={e => setFormData({...formData, data_nascimento: maskDate(e.target.value)})}
                  placeholder="DD/MM/AAAA"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vínculo Início</Label>
                <Input
                  value={formData.vinculo_inicio}
                  onChange={e => setFormData({...formData, vinculo_inicio: maskDate(e.target.value)})}
                  placeholder="DD/MM/AAAA"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label>Vínculo Fim</Label>
                <Input
                  value={formData.vinculo_fim}
                  onChange={e => setFormData({...formData, vinculo_fim: maskDate(e.target.value)})}
                  placeholder="DD/MM/AAAA"
                  inputMode="numeric"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total de Cotas</Label>
                <Input type="number" value={formData.total_cotas} onChange={e => setFormData({...formData, total_cotas: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Perfil (Role)</Label>
                <Select value={formData.role} onValueChange={v => setFormData({...formData, role: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professor">Professor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="juridico">Jurídico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                {editingProf
                  ? 'Redefinir senha (deixe vazio para manter a atual)'
                  : 'Senha (deixe vazio para usar a data de nascimento)'}
              </Label>
              <div className="relative">
                <Input
                  type={showModalPassword ? "text" : "password"}
                  placeholder={editingProf ? 'Nova senha' : 'Senha inicial'}
                  value={formData.senha}
                  onChange={e => setFormData({ ...formData, senha: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowModalPassword(!showModalPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showModalPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveProf}>{editingProf ? 'Salvar' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
