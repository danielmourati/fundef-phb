import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Plus, Pencil, Trash2, Upload, Download, Trash, Loader2, Calendar, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { maskCPF, unmaskCPF, isValidCPF, maskDate, isValidDate, maskMonthYear, isValidMonthYear, STATUS_OPTIONS, statusBadgeClass, normalizeStatus } from '@/lib/masks';

interface Periodo { id?: string; inicio: string; fim: string; ordem?: number }
interface Contratado {
  id: string;
  nome: string;
  cpf: string;
  matricula: string | null;
  data_nascimento: string | null;
  carga_horaria: number | null;
  total_cotas: number | null;
  cargo: string | null;
  vinculo: string;
  status: string | null;
  periodos: Periodo[];
}

const emptyForm = {
  nome: '', cpf: '', matricula: '', senha: '', data_nascimento: '',
  carga_horaria: 20, total_cotas: 0, cargo: 'PROFESSOR(A) EJA',
  vinculo: 'Contratado', status: 'ATIVO',
};

const TEMPLATE_COLUMNS = ['nome', 'matricula', 'cpf', 'periodos', 'carga_horaria', 'total_cotas', 'cargo', 'vinculo'] as const;

interface Props { token: string; search: string; onCountChange?: (n: number) => void }

const ContratadosView: React.FC<Props> = ({ token, search, onCountChange }) => {
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const apiCall = useCallback(async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', action: string, body?: unknown) => {
    const opts: any = { method, headers: authHeaders };
    if (body) opts.body = body;
    return supabase.functions.invoke(`admin-api?action=${action}`, opts);
  }, [authHeaders]);

  const [rows, setRows] = useState<Contratado[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, pageSize]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    const { data, error } = await apiCall('GET', `contratados&${params.toString()}`);
    if (!error && data && Array.isArray(data.rows)) {
      setRows(data.rows);
      setTotal(data.total || 0);
      onCountChange?.(data.total || 0);
    }
    setLoading(false);
  }, [apiCall, page, pageSize, debouncedSearch, onCountChange]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // ============== Add/Edit modal ==============
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Contratado | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [periodos, setPeriodos] = useState<Periodo[]>([{ inicio: '', fim: '' }]);
  const [showPassword, setShowPassword] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setPeriodos([{ inicio: '', fim: '' }]);
    setDialogOpen(true);
  };
  const openEdit = (c: Contratado) => {
    setEditing(c);
    setForm({
      nome: c.nome, cpf: maskCPF(c.cpf || ''), matricula: c.matricula || '', senha: '',
      data_nascimento: maskDate(c.data_nascimento || ''),
      carga_horaria: c.carga_horaria || 20,
      total_cotas: c.total_cotas || 0,
      cargo: c.cargo || 'PROFESSOR(A) EJA',
      vinculo: c.vinculo || 'Contratado',
      status: normalizeStatus(c.status),
    });
    setPeriodos(c.periodos.length > 0 ? c.periodos.map(p => ({ inicio: p.inicio, fim: p.fim })) : [{ inicio: '', fim: '' }]);
    setDialogOpen(true);
  };

  const addPeriodo = () => setPeriodos(prev => [...prev, { inicio: '', fim: '' }]);
  const removePeriodo = (i: number) => setPeriodos(prev => prev.filter((_, idx) => idx !== i));
  const updatePeriodo = (i: number, field: 'inicio' | 'fim', v: string) => {
    setPeriodos(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: maskMonthYear(v) } : p));
  };

  const handleSave = async () => {
    if (!form.nome || !form.cpf) { toast.error('Nome e CPF são obrigatórios.'); return; }
    if (!isValidCPF(form.cpf)) { toast.error('CPF inválido.'); return; }
    if (form.data_nascimento && !isValidDate(form.data_nascimento)) { toast.error('Data de nascimento inválida.'); return; }
    const cleanPeriodos = periodos.filter(p => p.inicio || p.fim);
    for (const p of cleanPeriodos) {
      if (!isValidMonthYear(p.inicio) || !isValidMonthYear(p.fim)) {
        toast.error('Períodos inválidos (use MM/AAAA).'); return;
      }
    }
    const payload = {
      ...form,
      cpf: unmaskCPF(form.cpf),
      periodos: cleanPeriodos,
    };
    const { data, error } = editing
      ? await apiCall('PUT', 'update_contratado', { ...payload, id: editing.id })
      : await apiCall('POST', 'create_contratado', payload);
    if (error || data?.error) { toast.error(data?.error || 'Erro ao salvar.'); return; }
    toast.success(editing ? 'Contratado atualizado!' : 'Contratado adicionado!');
    setDialogOpen(false);
    fetchRows();
  };

  const handleDelete = async (c: Contratado) => {
    if (!confirm(`Excluir ${c.nome}?`)) return;
    const { data, error } = await supabase.functions.invoke(`admin-api?action=delete_contratado&id=${c.id}`, {
      method: 'DELETE', headers: authHeaders,
    });
    if (error || data?.error) { toast.error(data?.error || 'Erro ao excluir.'); return; }
    toast.success('Contratado excluído!');
    fetchRows();
  };

  // ============== Import CSV ==============
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
    if (lines.length < 2) return [];
    const sep = lines[0].includes(';') ? ';' : ',';
    // Proper CSV split honoring double-quoted fields (so "a;b" stays as one cell).
    const splitLine = (line: string): string[] => {
      const out: string[] = [];
      let cur = '';
      let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (ch === sep && !inQ) {
          out.push(cur.trim()); cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur.trim());
      return out;
    };
    const headers = splitLine(lines[0]).map(h => h.toLowerCase().replace(/^\ufeff/, ''));
    return lines.slice(1).map(line => {
      const values = splitLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { obj[h] = values[i] || ''; });
      return obj;
    });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) { toast.error('CSV vazio ou inválido.'); return; }
      const { data, error } = await apiCall('POST', 'import_contratados', { rows: parsed });
      if (error || data?.error) { toast.error(data?.error || 'Erro ao importar.'); return; }
      toast.success(`${data?.count || 0} contratado(s) importado(s). ${data?.skipped || 0} ignorado(s).`);
      fetchRows();
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const example = [
      ['ADAILSON GALENO OLIVEIRA', '2828', '16742552840', '07/2005 a 10/2005 | 01/2006 a 07/2006', '20', '11', 'PROFESSOR(A) EJA', 'Contratado'],
      ['AILCE DOS SANTOS MEIRELES', '25922', '74976427315', '08/2005 a 12/2006', '20', '17', 'PROFESSOR(A) EJA', 'Contratado'],
    ];
    const csv = [[...TEMPLATE_COLUMNS].join(';'), ...example.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'modelo-importacao-contratados.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ============== Clear DB ==============
  const [clearOpen, setClearOpen] = useState(false);
  const [clearPwd, setClearPwd] = useState('');
  const [showClearPwd, setShowClearPwd] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    if (!clearPwd) { toast.error('Informe sua senha.'); return; }
    setClearing(true);
    const { data, error } = await apiCall('POST', 'delete_all_contratados', { password: clearPwd });
    setClearing(false);
    if (error || data?.error) { toast.error(data?.error || 'Erro ao limpar.'); return; }
    toast.success('Base de contratados limpa!');
    setClearOpen(false); setClearPwd('');
    fetchRows();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-4 border-b border-border gap-4">
          <div>
            <h3 className="font-semibold text-foreground">Contratados ({total})</h3>
            <p className="text-xs text-muted-foreground">Base separada dos efetivos · suporta múltiplos períodos por professor</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} disabled={importing} />
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-1.5" /> Modelo CSV
            </Button>
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => fileRef.current?.click()} disabled={importing}>
              {importing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
              Importar (CSV)
            </Button>
            <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={() => setClearOpen(true)}>
              <Trash className="w-4 h-4 mr-1.5" /> Limpar Base
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={openAdd}>
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
                  <TableHead className="text-xs">Nome</TableHead>
                  <TableHead className="text-xs">Mat</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">CPF</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Vínculo</TableHead>
                  <TableHead className="text-xs">Períodos Trabalhados</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">CH</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">Cotas</TableHead>
                  <TableHead className="text-xs text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-xs lg:text-sm font-medium">{c.nome}</TableCell>
                    <TableCell className="font-mono text-xs">{c.matricula || '—'}</TableCell>
                    <TableCell className="font-mono text-xs hidden md:table-cell">{c.cpf}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className={c.vinculo === 'Comissionado' ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-purple-50 text-purple-700 border-purple-300'}>
                        {c.vinculo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {c.periodos.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        {c.periodos.map((p, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted rounded px-2 py-0.5 w-fit">
                            <Calendar className="w-3 h-3" /> {p.inicio} → {p.fim}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs hidden sm:table-cell">{c.carga_horaria || 0}H</TableCell>
                    <TableCell className="text-xs hidden sm:table-cell">{c.total_cotas || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c)} title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum contratado cadastrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between px-6 py-3 border-t text-xs">
            <span className="text-muted-foreground">
              Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
            </span>
            <div className="flex items-center gap-2">
              <Select value={String(pageSize)} onValueChange={v => setPageSize(Number(v))}>
                <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[25, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} className={page === 1 ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                  <PaginationItem><PaginationLink isActive>{page}</PaginationLink></PaginationItem>
                  <PaginationItem>
                    <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} className={page >= totalPages ? 'pointer-events-none opacity-50' : ''} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        )}
      </CardContent>

      {/* Add/Edit modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Contratado' : 'Adicionar Contratado'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
              <div className="space-y-2"><Label>CPF *</Label><Input value={form.cpf} onChange={e => setForm({ ...form, cpf: maskCPF(e.target.value) })} placeholder="000.000.000-00" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Matrícula</Label><Input value={form.matricula} onChange={e => setForm({ ...form, matricula: e.target.value })} /></div>
              <div className="space-y-2"><Label>Data Nascimento</Label><Input value={form.data_nascimento} onChange={e => setForm({ ...form, data_nascimento: maskDate(e.target.value) })} placeholder="DD/MM/AAAA" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Carga Horária (semanal)</Label><Input type="number" value={form.carga_horaria} onChange={e => setForm({ ...form, carga_horaria: parseInt(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label>Total de Cotas</Label><Input type="number" value={form.total_cotas} onChange={e => setForm({ ...form, total_cotas: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Cargo</Label><Input value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Vínculo</Label>
                <Select value={form.vinculo} onValueChange={v => setForm({ ...form, vinculo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contratado">Contratado</SelectItem>
                    <SelectItem value="Comissionado">Comissionado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Períodos */}
            <div className="space-y-2 border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Períodos Trabalhados</Label>
                  <p className="text-xs text-muted-foreground">Diferente do efetivo, o contratado pode ter múltiplos vínculos descontínuos.</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addPeriodo}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar período
                </Button>
              </div>
              <div className="space-y-2">
                {periodos.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={p.inicio} onChange={e => updatePeriodo(i, 'inicio', e.target.value)} placeholder="MM/AAAA" className="text-sm" />
                    <span className="text-muted-foreground">→</span>
                    <Input value={p.fim} onChange={e => updatePeriodo(i, 'fim', e.target.value)} placeholder="MM/AAAA" className="text-sm" />
                    <Button type="button" size="icon" variant="ghost" className="text-destructive shrink-0" onClick={() => removePeriodo(i)} disabled={periodos.length === 1}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{editing ? 'Redefinir senha (deixe vazio para manter a atual)' : 'Senha (deixe vazio para usar o CPF)'}</Label>
              <div className="relative">
                <Input type={showPassword ? 'text' : 'password'} value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} placeholder="Nova senha" className="pr-10" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? 'Salvar' : 'Adicionar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear DB */}
      <Dialog open={clearOpen} onOpenChange={(o) => { if (!clearing) setClearOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">⚠️ Limpar base de contratados</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Esta ação irá <strong>excluir TODOS os contratados</strong>. Os efetivos não serão afetados.</p>
            <p className="text-destructive font-medium">Esta ação não pode ser desfeita.</p>
            <div className="space-y-1">
              <Label>Confirme com sua senha de administrador</Label>
              <div className="relative">
                <Input type={showClearPwd ? 'text' : 'password'} value={clearPwd} onChange={e => setClearPwd(e.target.value)} placeholder="Digite sua senha" className="pr-10" autoFocus />
                <button type="button" onClick={() => setShowClearPwd(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showClearPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>Cancelar</Button>
            <Button variant="destructive" onClick={handleClear} disabled={clearing || !clearPwd}>
              {clearing ? 'Limpando...' : 'Confirmar e limpar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ContratadosView;
