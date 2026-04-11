import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Upload, Download, Users, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Professor {
  id: string;
  matricula: string;
  nome: string;
  total_cotas: number | null;
  status: string;
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

const AdminPage = () => {
  const { professor, logout } = useAuth();
  const navigate = useNavigate();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [contestacoes, setContestacoes] = useState<Contestacao[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!professor || professor.role !== 'admin') {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [professor, navigate]);

  const fetchData = async () => {
    setLoading(true);
    const [profRes, contRes] = await Promise.all([
      supabase.from('professors').select('id, matricula, nome, total_cotas, status').order('nome'),
      supabase.from('contestacoes').select('id, motivo, descricao, whatsapp, status, created_at, professors(nome, matricula)').order('created_at', { ascending: false }),
    ]);
    if (profRes.data) setProfessors(profRes.data);
    if (contRes.data) setContestacoes(contRes.data as unknown as Contestacao[]);
    setLoading(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
      toast.error('Arquivo CSV vazio ou inválido.');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });

    const toInsert = rows.map(r => ({
      nome: r.nome || '',
      cpf: r.cpf || '',
      matricula: r.matricula || '',
      senha: r.data_nascimento?.replace(/\D/g, '') || r.senha || '',
      data_nascimento: r.data_nascimento || '',
      vinculo_inicio: r.vinculo_inicio || '',
      vinculo_fim: r.vinculo_fim || '',
      total_cotas: parseInt(r.total_cotas) || 0,
      status: r.status || 'Pendente',
      role: 'professor',
    }));

    const { error } = await supabase.from('professors').insert(toInsert);
    if (error) {
      toast.error('Erro na importação: ' + error.message);
    } else {
      toast.success(`${toInsert.length} professor(es) importado(s) com sucesso!`);
      fetchData();
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportContestacoes = () => {
    if (contestacoes.length === 0) {
      toast.error('Nenhuma contestação para exportar.');
      return;
    }

    const csvRows = [
      ['Matrícula', 'Nome', 'Motivo', 'Descrição', 'WhatsApp', 'Status', 'Data'].join(','),
      ...contestacoes.map(c =>
        [
          c.professors?.matricula || '',
          `"${c.professors?.nome || ''}"`,
          `"${c.motivo}"`,
          `"${c.descricao}"`,
          c.whatsapp || '',
          c.status,
          new Date(c.created_at).toLocaleDateString('pt-BR'),
        ].join(',')
      ),
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="professors" className="flex items-center gap-2">
              <Users className="w-4 h-4" /> Professores
            </TabsTrigger>
            <TabsTrigger value="contestacoes" className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Contestações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="professors" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Lista de Professores ({professors.length})</CardTitle>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleCSVImport}
                  />
                  <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-1" /> Importar CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-sm">Carregando...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Cotas</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {professors.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-mono">{p.matricula}</TableCell>
                            <TableCell>{p.nome}</TableCell>
                            <TableCell>{p.total_cotas || 0}</TableCell>
                            <TableCell>
                              <Badge variant={p.status === 'Validado' ? 'default' : 'secondary'}>
                                {p.status}
                              </Badge>
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

          <TabsContent value="contestacoes" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Central de Contestações ({contestacoes.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={exportContestacoes}>
                  <Download className="w-4 h-4 mr-1" /> Exportar CSV
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-muted-foreground text-sm">Carregando...</p>
                ) : contestacoes.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma contestação registrada.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Descrição</TableHead>
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
                            <TableCell>
                              <Badge variant="secondary">{c.status}</Badge>
                            </TableCell>
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
        </Tabs>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center text-xs text-muted-foreground border-t bg-background">
        Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba
      </footer>
    </div>
  );
};

export default AdminPage;
