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
import { ImportReviewDialog, type ReviewItem, type ReviewDiff } from '@/components/ImportReviewDialog';
import { useAuth } from '@/contexts/AuthContext';
import { downloadImportReportPdf } from '@/lib/importReportPdf';
import { logImport } from '@/lib/importLog';
import { FileDown } from 'lucide-react';


interface Periodo { id?: string; inicio: string; fim: string; ordem?: number }
interface Contratado {
  id: string;
  nome: string;
  cpf: string;
  matricula: string | null;
  data_nascimento: string | null;
  carga_horaria: string | number | null;
  total_cotas: number | null;
  cargo: string | null;
  vinculo: string;
  status: string | null;
  periodos: Periodo[];
}

const emptyForm = {
  nome: '', cpf: '', matricula: '', senha: '', data_nascimento: '',
  carga_horaria: '20', total_cotas: 0, cargo: 'PROFESSOR(A) EJA',
  vinculo: 'Contratado', status: 'ATIVO',
};

const TEMPLATE_COLUMNS = ['nome', 'matricula', 'cpf', 'periodos', 'carga_horaria', 'total_cotas', 'cargo', 'vinculo'] as const;

interface ExistingContratado {
  id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  carga_horaria: string | number | null;
  total_cotas: number | null;
  cargo: string | null;
  vinculo: string | null;
  status: string | null;
  periodos: { inicio: string; fim: string }[];
}

type ReviewCounts = { total: number; valid: number; error: number; dup_file: number; dup_base: number; update: number; nochange: number };

/** Interpreta períodos: intervalos ("a", "até", "-"), meses isolados, conector "e" e listas mistas. */
const MES_ANO = String.raw`(\d{1,2})\s*\/\s*(\d{4})`;
const CONECTOR = String.raw`(?:a|à|as|às|at[ée]|-|–|—|→|~)`;
const PERIODO_RE = new RegExp(`${MES_ANO}(?:\\s*${CONECTOR}\\s*${MES_ANO})?`, 'gi');

const normalizaTexto = (raw: string) =>
  raw.replace(/[\u00A0\u2007\u202F\t]+/g, ' ').replace(/\s+/g, ' ').trim();

const ordinal = (mesAno: string) => {
  const [m, y] = mesAno.split('/');
  return Number(y) * 12 + Number(m);
};

export const parsePeriodosClient = (input: unknown): { inicio: string; fim: string }[] => {
  const raw = normalizaTexto(String(input ?? ''));
  if (!raw) return [];
  const out: { inicio: string; fim: string }[] = [];
  const seen = new Set<string>();
  raw.split(/[;|\n]+/).map(s => s.trim()).filter(Boolean).forEach(chunk => {
    PERIODO_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PERIODO_RE.exec(chunk)) !== null) {
      let inicio = `${m[1].padStart(2, '0')}/${m[2]}`;
      let fim = m[3] && m[4] ? `${m[3].padStart(2, '0')}/${m[4]}` : inicio;
      if (ordinal(fim) < ordinal(inicio)) { const t = inicio; inicio = fim; fim = t; }
      const k = `${inicio}-${fim}`;
      if (!seen.has(k)) { seen.add(k); out.push({ inicio, fim }); }
    }
  });
  return out;
};

const fmtPeriodos = (ps: { inicio: string; fim: string }[]): string =>
  ps.map(p => (p.inicio === p.fim ? p.inicio : `${p.inicio} a ${p.fim}`)).join(', ');


const normTxt = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
const normNum = (v: unknown) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d ? String(parseInt(d, 10)) : '';
};

const DIFF_FIELDS: { field: string; label: string; kind: 'text' | 'number' }[] = [
  { field: 'nome', label: 'Nome', kind: 'text' },
  { field: 'matricula', label: 'Matrícula', kind: 'text' },
  { field: 'carga_horaria', label: 'Carga horária', kind: 'text' },
  { field: 'total_cotas', label: 'Total de cotas', kind: 'number' },
  { field: 'cargo', label: 'Cargo', kind: 'text' },
  { field: 'vinculo', label: 'Vínculo', kind: 'text' },
];

const computeDiffs = (
  existing: ExistingContratado,
  incoming: Record<string, string>,
  periodos: { inicio: string; fim: string }[],
): ReviewDiff[] => {
  const diffs: ReviewDiff[] = [];
  DIFF_FIELDS.forEach(({ field, label, kind }) => {
    const raw = String(incoming[field] ?? '').trim();
    if (!raw) return; // vazio ou traços não sobrescrevem
    const inc = kind === 'number' ? normNum(raw) : normTxt(raw);
    const cur = kind === 'number' ? normNum((existing as any)[field]) : normTxt((existing as any)[field]);
    if (!inc || cur === inc) return;
    diffs.push({ field, label, current: String((existing as any)[field] ?? ''), incoming: raw });
  });
  if (periodos.length > 0) {
    const cur = fmtPeriodos(existing.periodos || []);
    const inc = fmtPeriodos(periodos);
    if (cur !== inc) diffs.push({ field: 'periodos', label: 'Períodos', current: cur || '—', incoming: inc });
  }
  return diffs;
};

interface Props { token: string; search: string; onCountChange?: (n: number) => void }


const ContratadosView: React.FC<Props> = ({ token, search, onCountChange }) => {
  const { professor } = useAuth();

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
      carga_horaria: c.carga_horaria != null ? String(c.carga_horaria) : '20',
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
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [importFileName, setImportFileName] = useState<string>('');
  const [summary, setSummary] = useState<{
    open: boolean; total: number; valid: number; error: number; dup_file: number; dup_base: number;
    update: number; nochange: number; selected: number; imported: number; updated: number; skipped: number;
    fileName?: string; items?: ReviewItem[]; selectedLines?: number[];
  }>({
    open: false, total: 0, valid: 0, error: 0, dup_file: 0, dup_base: 0, update: 0, nochange: 0,
    selected: 0, imported: 0, updated: 0, skipped: 0,
  });




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
    setImportFileName(file.name);
    setImporting(true);

    setImportProgress({ current: 0, total: 0 });
    try {
      const text = await file.text();
      const parsed = parseCSV(text);
      if (parsed.length === 0) { toast.error('CSV vazio ou inválido.'); return; }

      // Conferência de colunas
      const headers = Object.keys(parsed[0] || {});
      const missing = TEMPLATE_COLUMNS.filter(c => !headers.includes(c));
      const extras = headers.filter(h => h && !TEMPLATE_COLUMNS.includes(h as typeof TEMPLATE_COLUMNS[number]));
      if (missing.length > 0 || extras.length > 0) {
        const parts: string[] = [];
        if (missing.length) parts.push(`Faltando: ${missing.join(', ')}`);
        if (extras.length) parts.push(`Não reconhecidas: ${extras.join(', ')}`);
        toast.error(`Colunas divergentes do modelo. ${parts.join(' | ')}. Baixe o "Modelo CSV" e ajuste o arquivo.`);
        return;
      }

      // Base atual (para duplicidade e comparação)
      const { data: allData } = await apiCall('GET', 'contratados_all');
      const existing: ExistingContratado[] = Array.isArray(allData) ? allData : [];
      const byCpfMat = new Map<string, ExistingContratado>();
      const cpfCount = new Map<string, number>();
      const byCpfSingle = new Map<string, ExistingContratado>();
      const byNameMat = new Map<string, ExistingContratado>();
      existing.forEach(c => {
        const cpf = (c.cpf || '').replace(/\D/g, '');
        const mat = (c.matricula || '').trim();
        if (cpf.length === 11) {
          byCpfMat.set(`${cpf}|${mat}`, c);
          cpfCount.set(cpf, (cpfCount.get(cpf) || 0) + 1);
          byCpfSingle.set(cpf, c);
        }
        byNameMat.set(`${(c.nome || '').toUpperCase()}|${mat}`, c);
      });


      const seen = new Map<string, number>();
      const items: ReviewItem[] = [];

      parsed.forEach((r, idx) => {
        const ln = idx + 2;
        const clean: Record<string, string> = {};
        TEMPLATE_COLUMNS.forEach(k => {
          const v = String(r[k] ?? '').trim();
          clean[k] = /^[-–—]+$/.test(v) ? '' : v;
        });
        const nome = clean.nome;
        const cpfRaw = clean.cpf;
        const cpf = cpfRaw.replace(/\D/g, '');
        clean.cpf = cpf.length === 11 ? cpf : '';
        const mat = clean.matricula;
        const periodos = parsePeriodosClient(clean.periodos);
        clean.periodos_fmt = fmtPeriodos(periodos);

        if (!nome) {
          items.push({ line: ln, status: 'error', reason: 'Nome ausente', data: clean, selectable: false });
          return;
        }
        if (cpf && cpf.length !== 11) {
          items.push({ line: ln, status: 'error', reason: `CPF inválido "${cpfRaw}" (${cpf.length} dígitos)`, data: clean, selectable: false });
          return;
        }
        if (clean.total_cotas && isNaN(Number(clean.total_cotas.replace(/\D/g, '')))) {
          items.push({ line: ln, status: 'error', reason: `total_cotas não numérico "${clean.total_cotas}"`, data: clean, selectable: false });
          return;
        }

        // Mesmo CPF pode ter múltiplas matrículas: a chave inclui a matrícula
        const key = clean.cpf ? `cpf:${clean.cpf}|${mat}` : `nm:${nome.toUpperCase()}|${mat}`;
        if (seen.has(key)) {
          items.push({
            line: ln, status: 'dup_file',
            reason: `Linha duplicada (${clean.cpf ? 'CPF + matrícula' : 'nome + matrícula'}) — 1ª ocorrência linha ${seen.get(key)}`,
            data: clean, selectable: true,
          });
          return;
        }
        seen.set(key, ln);

        const found = clean.cpf
          ? (mat
              ? byCpfMat.get(`${clean.cpf}|${mat}`)
              : (cpfCount.get(clean.cpf) === 1 ? byCpfSingle.get(clean.cpf) : undefined))
          : byNameMat.get(`${nome.toUpperCase()}|${mat}`);

        if (found) {
          const diffs = computeDiffs(found, clean, periodos);
          if (diffs.length === 0) {
            items.push({ line: ln, status: 'nochange', reason: 'Cadastro já existe e não há campos alterados', data: clean, selectable: false });
          } else {
            items.push({ line: ln, status: 'update', reason: `Cadastro existente — ${diffs.length} campo(s) a atualizar`, data: clean, selectable: true, diffs });
          }
          return;
        }

        items.push({ line: ln, status: 'valid', reason: 'Novo contratado', data: clean, selectable: true });
      });

      setReviewItems(items);
      setReviewOpen(true);
    } catch (err: any) {
      toast.error(`Erro: ${err?.message || err}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const runImport = async (insertRows: Record<string, string>[], updateRows: Record<string, string>[], counts: ReviewCounts, meta?: { items: ReviewItem[]; fileName?: string; selectedLines?: number[] }) => {
    if (insertRows.length === 0 && updateRows.length === 0) { toast.error('Nenhuma linha selecionada.'); return; }
    setImporting(true);
    const totalOps = insertRows.length + updateRows.length;
    setImportProgress({ current: 0, total: totalOps });
    try {
      const CHUNK = 50;
      let imported = 0, updated = 0, skipped = 0, done = 0;
      for (let i = 0; i < insertRows.length; i += CHUNK) {
        const chunk = insertRows.slice(i, i + CHUNK);
        const { data, error } = await apiCall('POST', 'import_contratados', { rows: chunk });
        if (error || data?.error) { toast.error(data?.error || 'Erro na importação.'); return; }
        imported += data?.count || 0;
        skipped += data?.skipped || 0;
        done += chunk.length;
        setImportProgress({ current: done, total: totalOps });
      }
      for (let i = 0; i < updateRows.length; i += CHUNK) {
        const chunk = updateRows.slice(i, i + CHUNK);
        const { data, error } = await apiCall('POST', 'update_contratados_csv', { rows: chunk });
        if (error || data?.error) { toast.error(data?.error || 'Erro ao atualizar registros existentes.'); return; }
        updated += data?.updated || 0;
        done += chunk.length;
        setImportProgress({ current: done, total: totalOps });
      }
      setSummary({
        open: true, ...counts, selected: totalOps, imported, updated, skipped,
        fileName: meta?.fileName, items: meta?.items, selectedLines: meta?.selectedLines,
      });
      if (meta?.items?.length) {
        await logImport({
          token,
          tipo: 'contratado',
          fileName: meta.fileName,
          executedByName: professor?.nome || professor?.email || 'Administrador',
          counts: { ...counts, selected: totalOps, imported, updated, skipped },
          items: meta.items,
          selectedLines: meta.selectedLines,
        });
      }

      const parts: string[] = [];
      if (imported > 0) parts.push(`${imported} importado(s)`);
      if (updated > 0) parts.push(`${updated} atualizado(s)`);
      toast.success(`${parts.join(' · ') || 'Nenhuma alteração'}${skipped > 0 ? ` (${skipped} ignorada(s) pelo servidor)` : ''}`);
      fetchRows();
    } catch (err: any) {
      toast.error(`Erro ao importar: ${err?.message || err}`);
    } finally {
      setImporting(false);
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
              {importing && importProgress.total > 0
                ? `Importando ${importProgress.current}/${importProgress.total}`
                : 'Importar (CSV)'}
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
                  <TableHead className="text-xs">Período Trabalhado Contemplado</TableHead>
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
                    <TableCell className="text-xs hidden sm:table-cell">{c.carga_horaria ? `${c.carga_horaria}H` : '—'}</TableCell>
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
              <div className="space-y-2"><Label>Carga Horária (semanal)</Label><Input value={form.carga_horaria} onChange={e => setForm({ ...form, carga_horaria: e.target.value.replace(/[^0-9/]/g, '') })} placeholder="20 ou 20/40" /></div>
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
                  <Label>Período Trabalhado Contemplado</Label>
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
      {/* Revisão da importação */}
      <ImportReviewDialog
        open={reviewOpen}
        items={reviewItems}
        onCancel={() => { setReviewOpen(false); setReviewItems([]); toast.info('Importação cancelada.'); }}
        onConfirm={async (_rows, selectedItems) => {
          const allItems = reviewItems;
          setReviewOpen(false);
          const counts: ReviewCounts = {
            total: allItems.length,
            valid: allItems.filter(i => i.status === 'valid').length,
            error: allItems.filter(i => i.status === 'error').length,
            dup_file: allItems.filter(i => i.status === 'dup_file').length,
            dup_base: allItems.filter(i => i.status === 'dup_base').length,
            update: allItems.filter(i => i.status === 'update').length,
            nochange: allItems.filter(i => i.status === 'nochange').length,
          };
          const updateRows = selectedItems.filter(i => i.status === 'update' || i.status === 'dup_base').map(i => i.data);
          const insertRows = selectedItems.filter(i => i.status !== 'update' && i.status !== 'dup_base').map(i => i.data);
          await runImport(insertRows, updateRows, counts, { items: allItems, fileName: importFileName, selectedLines: selectedItems.map(i => i.line) });
        }}
      />

      {/* Resumo da importação */}
      <Dialog open={summary.open} onOpenChange={(o) => !o && setSummary(s => ({ ...s, open: false }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importação concluída</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Total de linhas no arquivo</span>
              <span className="font-semibold">{summary.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Linhas válidas</span>
              <span className="font-semibold text-green-600">{summary.valid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Linhas com erro</span>
              <span className="font-semibold text-red-600">{summary.error}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duplicadas no arquivo</span>
              <span className="font-semibold text-yellow-600">{summary.dup_file}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Com dados a atualizar</span>
              <span className="font-semibold text-blue-600">{summary.update}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sem alterações</span>
              <span className="font-semibold">{summary.nochange}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-muted-foreground">Selecionadas para processar</span>
              <span className="font-semibold">{summary.selected}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ignoradas pelo servidor</span>
              <span className="font-semibold">{summary.skipped}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="font-semibold text-primary">Registros importados</span>
              <span className="font-bold text-primary text-lg">{summary.imported}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-blue-700">Registros atualizados</span>
              <span className="font-bold text-blue-700 text-lg">{summary.updated}</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSummary(s => ({ ...s, open: false }))}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>

  );
};

export default ContratadosView;
