import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { LogOut, Upload, Download, Users, AlertTriangle, Settings, Plus, Pencil, Trash2, Save } from 'lucide-react';
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
  senha: string;
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

const emptyProfessor = {
  nome: '', cpf: '', matricula: '', senha: '', data_nascimento: '',
  vinculo_inicio: '', vinculo_fim: '', total_cotas: 0, status: 'Pendente', role: 'professor',
};

const AdminPage = () => {
  const { professor, logout } = useAuth();
  const navigate = useNavigate();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [contestacoes, setContestacoes] = useState<Contestacao[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Professor form dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<any>(null);
  const [formData, setFormData] = useState(emptyProfessor);

  // Settings
  const [emailDestino, setEmailDestino] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!professor || professor.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchData();
    fetchSettings();
  }, [professor, navigate]);

  const fetchData = async () => {
    setLoading(true);
    const [profRes, contRes] = await Promise.all([
      supabase.from('professors').select('id, matricula, nome, cpf, data_nascimento, vinculo_inicio, vinculo_fim, total_cotas, status, role, senha').order('nome'),
      supabase.from('contestacoes').select('id, motivo, descricao, whatsapp, status, created_at, professors(nome, matricula)').order('created_at', { ascending: false }),
    ]);
    if (profRes.data) setProfessors(profRes.data);
    if (contRes.data) setContestacoes(contRes.data as unknown as Contestacao[]);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('system_settings').select('value').eq('key', 'email_destino').maybeSingle();
    if (data) setEmailDestino(data.value);
  };

  const handleLogout = () => { logout(); navigate('/'); };

  // Professor CRUD
  const openAddDialog = () => {
    setEditingProf(null);
    setFormData(emptyProfessor);
    setDialogOpen(true);
  };

  const openEditDialog = (p: Professor) => {
    setEditingProf(p);
    setFormData({
      nome: p.nome, cpf: p.cpf, matricula: p.matricula, senha: p.senha,
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
    const payload = {
      ...formData,
      senha: formData.senha || formData.data_nascimento?.replace(/\D/g, '') || '',
      total_cotas: Number(formData.total_cotas) || 0,
    };

    if (editingProf) {
      const { error } = await supabase.from('professors').update(payload).eq('id', editingProf.id);
      if (error) { toast.error('Erro ao atualizar: ' + error.message); return; }
      toast.success('Professor atualizado!');
    } else {
      const { error } = await supabase.from('professors').insert(payload);
      if (error) { toast.error('Erro ao adicionar: ' + error.message); return; }
      toast.success('Professor adicionado!');
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDeleteProf = async (id: string, nome: string) => {
    if (!confirm(`Excluir ${nome}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('professors').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir: ' + error.message); return; }
    toast.success('Professor excluído!');
    fetchData();
  };

  // CSV Import
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
    const toInsert = rows.map(r => ({
      nome: r.nome || '', cpf: r.cpf || '', matricula: r.matricula || '',
      senha: r.data_nascimento?.replace(/\D/g, '') || r.senha || '',
      data_nascimento: r.data_nascimento || '', vinculo_inicio: r.vinculo_inicio || '',
      vinculo_fim: r.vinculo_fim || '', total_cotas: parseInt(r.total_cotas) || 0,
      status: r.status || 'Pendente', role: 'professor',
    }));
    const { error } = await supabase.from('professors').insert(toInsert);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success(`${toInsert.length} professor(es) importado(s)!`); fetchData(); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Export contestações
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

  // Save settings
  const handleSaveSettings = async () => {
    setSavingSettings(true);
    const { data: existing } = await supabase.from('system_settings').select('id').eq('key', 'email_destino').maybeSingle();
    if (existing) {
      await supabase.from('system_settings').update({ value: emailDestino }).eq('id', existing.id);
    } else {
      await supabase.from('system_settings').insert({ key: 'email_destino', value: emailDestino });
    }
    setSavingSettings(false);
    toast.success('Configurações salvas!');
  };

  if (!professor || professor.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground py-4 px-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Painel Administrativo</h1>
            <p className="text-xs opacity-80">FUNDEF - SEDUC Parnaíba</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary-foreground hover:bg-primary/80">
            <LogOut className="w-4 h-4 mr-1" /> Sair
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6 pb-20">
        <Tabs defaultValue="professors">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="professors" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Professores
            </TabsTrigger>
            <TabsTrigger value="contestacoes" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Contestações
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" /> Configurações
            </TabsTrigger>
          </TabsList>

          {/* Professors Tab */}
          <TabsContent value="professors" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-lg">Professores ({professors.filter(p => p.role !== 'admin').length})</CardTitle>
                <div className="flex gap-2">
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" /> Importar CSV
                  </Button>
                  <Button size="sm" onClick={openAddDialog}>
                    <Plus className="w-4 h-4 mr-1" /> Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm">Carregando...</p> : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Cotas</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {professors.filter(p => p.role !== 'admin').map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono">{p.matricula}</TableCell>
                            <TableCell>{p.nome}</TableCell>
                            <TableCell className="font-mono">{p.cpf}</TableCell>
                            <TableCell>{p.total_cotas || 0}</TableCell>
                            <TableCell>
                              <Badge variant={p.status === 'Validado' ? 'default' : 'secondary'}>{p.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="icon" variant="ghost" onClick={() => openEditDialog(p)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDeleteProf(p.id, p.nome)}>
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
          </TabsContent>

          {/* Contestações Tab */}
          <TabsContent value="contestacoes" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Contestações ({contestacoes.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={exportContestacoes}>
                  <Download className="w-4 h-4 mr-1" /> Exportar CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? <p className="text-muted-foreground text-sm">Carregando...</p>
                  : contestacoes.length === 0 ? <p className="text-muted-foreground text-sm">Nenhuma contestação registrada.</p>
                  : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>WhatsApp</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contestacoes.map(c => (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono">{c.professors?.matricula}</TableCell>
                            <TableCell>{c.professors?.nome}</TableCell>
                            <TableCell>{c.motivo}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{c.descricao}</TableCell>
                            <TableCell>{c.whatsapp || '-'}</TableCell>
                            <TableCell><Badge variant="secondary">{c.status}</Badge></TableCell>
                            <TableCell>{new Date(c.created_at).toLocaleDateString('pt-BR')}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configurações do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
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
                  <Save className="w-4 h-4 mr-1" /> {savingSettings ? 'Salvando...' : 'Salvar Configurações'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Add/Edit Professor Dialog */}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveProf}>{editingProf ? 'Salvar' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-xs text-muted-foreground border-t bg-background">
        Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba
      </footer>
    </div>
  );
};

export default AdminPage;
