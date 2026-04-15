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
  LayoutDashboard, FileText, Search, Send, MessageSquare,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface Professor {
  id: string;
  matricula: string;
  nome: string;
  cpf: string;
  data_nascimento: string | null;
  vinculo_inicio: string | null;
  vinculo_fim: string | null;
  total_cotas: number | null;
  status: string;
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
  vinculo_inicio: '', vinculo_fim: '', total_cotas: 0, status: 'Pendente', role: 'professor',
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
      nome: p.nome, cpf: p.cpf, matricula: p.matricula, senha: '',
      data_nascimento: p.data_nascimento || '', vinculo_inicio: p.vinculo_inicio || '',
      vinculo_fim: p.vinculo_fim || '', total_cotas: p.total_cotas || 0,
      status: p.status, role: p.role,
    });
    setDialogOpen(true);
  };

  const handleSaveProf = async () => {
    if (!formData.nome || !formData.matricula || !formData.cpf) {
      toast.error('Nome, Matrícula e CPF são obrigatórios.');
      return;
    }
    if (editingProf) {
      const { data, error } = await apiCall('PUT', 'update_professor', { ...formData, id: editingProf.id });
      if (error || data?.error) { toast.error(data?.error || 'Erro ao atualizar.'); return; }
      toast.success('Professor atualizado!');
    } else {
      const { data, error } = await apiCall('POST', 'create_professor', formData);
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

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { toast.error('CSV vazio ou inválido.'); return; }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });
    const { data, error } = await apiCall('POST', 'import_csv', { rows });
    if (error || data?.error) toast.error(data?.error || 'Erro na importação.');
    else { toast.success(`${data?.count || rows.length} professor(es) importado(s)!`); fetchData(); }
    if (fileInputRef.current) fileInputRef.current.value = '';
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

  if (!professor || professor.role !== 'admin') return null;

  const nonAdminProfs = professors.filter(p => p.role !== 'admin');
  const filteredProfs = nonAdminProfs.filter(p =>
    !searchQuery ||
    p.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.matricula.includes(searchQuery) ||
    p.cpf.includes(searchQuery)
  );
  const validados = nonAdminProfs.filter(p => p.status === 'Validado').length;
  const pendentes = nonAdminProfs.filter(p => p.status === 'Pendente').length;
  const emAnalise = nonAdminProfs.filter(p => p.status === 'Em Análise').length;

  const statCards = [
    { label: 'Total Professores', value: nonAdminProfs.length, icon: Users, color: 'bg-primary/10 text-primary' },
    { label: 'Validados', value: validados, icon: FileText, color: 'bg-green-50 text-green-600' },
    { label: 'Pendentes', value: pendentes, icon: AlertTriangle, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Contestações', value: contestacoes.length, icon: AlertTriangle, color: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col min-h-screen sticky top-0">
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
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="bg-card border-b border-border px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {navItems.find(n => n.key === activeTab)?.label}
            </h2>
            <p className="text-xs text-muted-foreground">
              Painel Administrativo • Última atualização: agora
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(activeTab === 'professors' || activeTab === 'dashboard') && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  className="pl-9 w-64 h-9"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-8 space-y-6">
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
                          <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProfs.slice(0, 5).map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-sm">{p.matricula}</TableCell>
                            <TableCell className="text-sm">{p.nome}</TableCell>
                            <TableCell className="font-mono text-sm">{p.cpf}</TableCell>
                            <TableCell className="text-sm">{p.total_cotas || 0}</TableCell>
                            <TableCell>
                              <Badge className={`text-xs font-medium ${
                                p.status === 'Validado' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' :
                                p.status === 'Em Análise' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' :
                                'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                              } border`}>{p.status}</Badge>
                            </TableCell>
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
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">Professores ({nonAdminProfs.length})</h3>
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-1.5" /> Importar CSV
                    </Button>
                    <Button size="sm" onClick={openAddDialog}>
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
                          <TableHead className="text-xs font-medium text-muted-foreground">Matrícula</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Nome</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">CPF</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Cotas</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProfs.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono text-sm">{p.matricula}</TableCell>
                            <TableCell className="text-sm">{p.nome}</TableCell>
                            <TableCell className="font-mono text-sm">{p.cpf}</TableCell>
                            <TableCell className="text-sm">{p.total_cotas || 0}</TableCell>
                            <TableCell>
                              <Badge className={`text-xs font-medium ${
                                p.status === 'Validado' ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' :
                                p.status === 'Em Análise' ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' :
                                'bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100'
                              } border`}>{p.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditDialog(p)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteProf(p.id, p.nome)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

          {/* Settings Tab */}
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
                <Input value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} placeholder="00000000000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Matrícula *</Label>
                <Input value={formData.matricula} onChange={e => setFormData({...formData, matricula: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Data Nascimento</Label>
                <Input value={formData.data_nascimento} onChange={e => setFormData({...formData, data_nascimento: e.target.value})} placeholder="01011980" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vínculo Início</Label>
                <Input value={formData.vinculo_inicio} onChange={e => setFormData({...formData, vinculo_inicio: e.target.value})} placeholder="01/2001" />
              </div>
              <div className="space-y-2">
                <Label>Vínculo Fim</Label>
                <Input value={formData.vinculo_fim} onChange={e => setFormData({...formData, vinculo_fim: e.target.value})} placeholder="12/2003" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total de Cotas</Label>
                <Input type="number" value={formData.total_cotas} onChange={e => setFormData({...formData, total_cotas: parseInt(e.target.value) || 0})} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Input value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} placeholder="Pendente" />
              </div>
            </div>
            {!editingProf && (
              <div className="space-y-2">
                <Label>Senha (deixe vazio para usar data de nascimento)</Label>
                <Input type="password" value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} />
              </div>
            )}
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
