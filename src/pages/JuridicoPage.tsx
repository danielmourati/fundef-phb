import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  LogOut, Scale, Inbox, Search, FileText, Clock, CheckCircle, XCircle, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import logoSeduc from '@/assets/logo-seduc.png';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Contestacao {
  id: string;
  motivo: string;
  descricao: string;
  whatsapp: string | null;
  status: string;
  created_at: string;
  protocolo: string | null;
  resposta: string | null;
  professor: { id: string; nome: string; matricula: string; cpf: string } | null;
}

const statusOptions = ['Aberta', 'Pendente', 'Deferido', 'Indeferido'];

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  'Aberta': { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Inbox },
  'Pendente': { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  'Deferido': { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  'Indeferido': { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
};

const JuridicoPage = () => {
  const { professor, token, logout } = useAuth();
  const navigate = useNavigate();
  const [contestacoes, setContestacoes] = useState<Contestacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('todos');
  const [selectedContest, setSelectedContest] = useState<Contestacao | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [resposta, setResposta] = useState('');
  const [saving, setSaving] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!professor || professor.role !== 'juridico') {
      navigate('/dashboard');
      return;
    }
    fetchContestacoes();
  }, [professor, navigate]);

  const fetchContestacoes = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('professor-api?action=juridico_contestacoes', {
      method: 'GET',
      headers: authHeaders,
    });
    if (data && Array.isArray(data)) setContestacoes(data);
    setLoading(false);
  };

  const openDetail = (c: Contestacao) => {
    setSelectedContest(c);
    setNewStatus(c.status);
    setResposta(c.resposta || '');
    setDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedContest) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('professor-api?action=update_contestacao', {
      method: 'PUT',
      headers: authHeaders,
      body: { id: selectedContest.id, status: newStatus, resposta },
    });
    setSaving(false);
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao atualizar.');
      return;
    }
    toast.success('Contestação atualizada!');
    setDialogOpen(false);
    fetchContestacoes();
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const handleExportPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // Load logo
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = logoSeduc;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        setTimeout(() => resolve(), 2000);
      });
      if (img.complete && img.naturalWidth > 0) {
        doc.addImage(img, 'PNG', 14, 8, 60, 18);
      }
    } catch { /* continue without logo */ }

    doc.setFontSize(14);
    doc.text('Relatório de Contestações — Corpo Jurídico', 148, 16, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 148, 22, { align: 'center' });
    doc.text(`Total: ${filtered.length} contestação(ões)`, 148, 27, { align: 'center' });

    const tableData = filtered.map(c => [
      c.protocolo || '—',
      c.professor?.matricula || '—',
      c.professor?.nome || '—',
      c.professor?.cpf || '—',
      c.motivo,
      c.whatsapp || '—',
      c.status,
      c.resposta || '—',
      new Date(c.created_at).toLocaleDateString('pt-BR'),
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['Protocolo', 'Matrícula', 'Nome', 'CPF', 'Motivo', 'WhatsApp', 'Status', 'Parecer', 'Data']],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [240, 245, 255] },
      columnStyles: {
        7: { cellWidth: 50 },
      },
    });

    doc.setFontSize(7);
    doc.text(
      'Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba',
      148,
      doc.internal.pageSize.height - 8,
      { align: 'center' }
    );

    doc.save(`contestacoes_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('PDF exportado com sucesso!');
  };

  if (!professor || professor.role !== 'juridico') return null;

  const filtered = contestacoes.filter(c => {
    const matchSearch = !searchQuery ||
      c.protocolo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.professor?.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.professor?.matricula.includes(searchQuery);
    const matchStatus = filterStatus === 'todos' || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const counts = {
    total: contestacoes.length,
    abertas: contestacoes.filter(c => c.status === 'Aberta').length,
    pendentes: contestacoes.filter(c => c.status === 'Pendente').length,
    deferidas: contestacoes.filter(c => c.status === 'Deferido').length,
    indeferidas: contestacoes.filter(c => c.status === 'Indeferido').length,
  };

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col min-h-screen sticky top-0">
        <div className="p-4 border-b border-border flex items-center gap-3">
          <img src={logoSeduc} alt="SEDUC Parnaíba" className="h-12 object-contain" />
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-sm">
            <Inbox className="w-4 h-4" />
            Caixa de Entrada
          </button>
        </nav>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Scale className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{professor.nome}</p>
              <p className="text-xs text-muted-foreground">Corpo Jurídico</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-card border-b border-border px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Caixa de Entrada — Contestações</h2>
            <p className="text-xs text-muted-foreground">Corpo Jurídico • Gerencie as contestações dos professores</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-9">
              <Download className="w-4 h-4 mr-1.5" /> Exportar PDF
            </Button>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {statusOptions.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar protocolo, nome..."
                className="pl-9 w-64 h-9"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </header>

        <main className="flex-1 p-8 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Total', value: counts.total, color: 'text-foreground' },
              { label: 'Abertas', value: counts.abertas, color: 'text-blue-600' },
              { label: 'Pendentes', value: counts.pendentes, color: 'text-yellow-600' },
              { label: 'Deferidas', value: counts.deferidas, color: 'text-green-600' },
              { label: 'Indeferidas', value: counts.indeferidas, color: 'text-red-600' },
            ].map(s => (
              <Card key={s.label}>
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-muted-foreground text-sm">Carregando...</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-muted-foreground text-sm">Nenhuma contestação encontrada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-medium text-muted-foreground">Protocolo</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Matrícula</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Nome</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Motivo</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">WhatsApp</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground">Data</TableHead>
                        <TableHead className="text-xs font-medium text-muted-foreground text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(c => {
                        const cfg = statusConfig[c.status] || statusConfig['Aberta'];
                        return (
                          <TableRow key={c.id} className="cursor-pointer" onClick={() => openDetail(c)}>
                            <TableCell className="font-mono text-xs">{c.protocolo || '—'}</TableCell>
                            <TableCell className="font-mono text-sm">{c.professor?.matricula}</TableCell>
                            <TableCell className="text-sm">{c.professor?.nome}</TableCell>
                            <TableCell className="text-sm max-w-[150px] truncate">{c.motivo}</TableCell>
                            <TableCell className="text-sm">{c.whatsapp || '—'}</TableCell>
                            <TableCell>
                              <Badge className={`text-xs font-medium border ${cfg.color}`}>{c.status}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(c); }}>
                                <FileText className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        <footer className="py-3 text-center text-xs text-muted-foreground border-t border-border bg-card">
          Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba
        </footer>
      </div>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contestação {selectedContest?.protocolo}</DialogTitle>
          </DialogHeader>
          {selectedContest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Professor</p>
                  <p className="font-medium">{selectedContest.professor?.nome}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Matrícula</p>
                  <p className="font-mono">{selectedContest.professor?.matricula}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">WhatsApp</p>
                  <p>{selectedContest.whatsapp || '—'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Data</p>
                  <p>{new Date(selectedContest.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Motivo</p>
                <p className="text-sm font-medium">{selectedContest.motivo}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs mb-1">Descrição</p>
                <p className="text-sm bg-muted/50 rounded p-3">{selectedContest.descricao}</p>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Resposta / Parecer</Label>
                  <Textarea
                    value={resposta}
                    onChange={e => setResposta(e.target.value)}
                    placeholder="Digite o parecer jurídico..."
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateStatus} disabled={saving}>
              {saving ? 'Salvando...' : 'Atualizar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JuridicoPage;
