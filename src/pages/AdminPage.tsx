import React, { useEffect, useState, useRef } from 'react';
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
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  LogOut, Upload, Download, Users, AlertTriangle, Settings, Plus, Pencil, Trash2, Save,
  LayoutDashboard, FileText, Search, Send, MessageSquare, Menu, Eye, EyeOff, Trash, Loader2, LifeBuoy, MessageCircle, User, Copy, X,
} from 'lucide-react';

const buildWhatsappUrl = (phone: string | null | undefined, nome?: string, protocolo?: string | null) => {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (!digits.startsWith('55')) digits = '55' + digits;
  const firstName = (nome || '').trim().split(' ')[0] || '';
  const saudacao = firstName ? `Olá, ${firstName}!` : 'Olá!';
  const ref = protocolo ? ` referente ao protocolo ${protocolo}` : '';
  const msg = `${saudacao} Sou da SEDUC Parnaíba e estou entrando em contato sobre o seu report de acesso ao sistema de Precatórios do FUNDEF${ref}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
};

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { maskCPF, unmaskCPF, isValidCPF, maskDate, isValidDate, maskPhone, STATUS_OPTIONS, statusBadgeClass, statusRowClass, normalizeStatus } from '@/lib/masks';
import { ImportReviewDialog, type ReviewItem } from '@/components/ImportReviewDialog';

interface Professor {
  id: string;
  matricula: string;
  nome: string;
  cpf: string;
  data_nascimento: string | null;
  vinculo_inicio: string | null;
  vinculo_fim: string | null;
  carga_horaria: number | null;
  total_cotas: number | null;
  cargo?: string | null;
  role: string;
  status: string | null;
}

interface Contestacao {
  id: string;
  motivo: string;
  descricao: string;
  whatsapp: string | null;
  status: string;
  created_at: string;
  professors: { nome: string; matricula: string } | null;
  documento_url?: string | null;
  documento_nome?: string | null;
}

interface Message {
  id: string;
  title: string;
  content: string;
  scheduled_at: string | null;
  sent: boolean;
  created_at: string;
  target_type?: 'all' | 'role' | 'users' | null;
  target_roles?: string[] | null;
  target_cargos?: string[] | null;
  target_user_ids?: string[] | null;
}

interface ProfLookup { id: string; nome: string; matricula: string | null; cargo: string | null; role: string }


const emptyProfessor = {
  nome: '', cpf: '', matricula: '', senha: '', data_nascimento: '',
  vinculo_inicio: '', vinculo_fim: '', carga_horaria: 0, total_cotas: 0, cargo: '', role: 'professor',
  status: 'ATIVO',
};

type ActiveTab = 'dashboard' | 'professors' | 'contestacoes' | 'access_reports' | 'messages' | 'settings';

const navItems: { key: ActiveTab; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'professors', label: 'Professores', icon: Users },
  { key: 'contestacoes', label: 'Contestações', icon: AlertTriangle },
  { key: 'access_reports', label: 'Reports de Acesso', icon: LifeBuoy },
  { key: 'messages', label: 'Mensagens', icon: MessageSquare },
  { key: 'settings', label: 'Configurações', icon: Settings },
];


const TEMPLATE_COLUMNS = [
  'nome', 'matricula', 'cpf', 'vinculo_inicio', 'vinculo_fim',
  'carga_horaria', 'total_cotas', 'cargo',
] as const;

const AdminPage = () => {
  const { professor, token, logout } = useAuth();
  const navigate = useNavigate();
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [contestacoes, setContestacoes] = useState<Contestacao[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [accessReports, setAccessReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [reportStatus, setReportStatus] = useState('Aberto');
  const [reportResposta, setReportResposta] = useState('');
  const [savingReport, setSavingReport] = useState(false);
  const [loading, setLoading] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);
  const [totalProfs, setTotalProfs] = useState(0);
  const [profsLoading, setProfsLoading] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [profsRefreshTick, setProfsRefreshTick] = useState(0);

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
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [msgTargetType, setMsgTargetType] = useState<'all' | 'role' | 'users'>('all');
  const [msgTargetRoles, setMsgTargetRoles] = useState<string[]>([]);
  const [msgTargetCargos, setMsgTargetCargos] = useState<string[]>([]);
  const [msgTargetUsers, setMsgTargetUsers] = useState<ProfLookup[]>([]);
  const [cargosList, setCargosList] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<ProfLookup[]>([]);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [dupDialog, setDupDialog] = useState<{
    open: boolean;
    groups: Array<Record<string, string>[]>;
    resolve?: (result: { action: 'keep' | 'dedupe' | 'cancel'; keepIndices?: number[] }) => void;
  }>({ open: false, groups: [] });
  const [keepIndices, setKeepIndices] = useState<number[]>([]);
  const [validationDialog, setValidationDialog] = useState<{
    open: boolean;
    errors: Array<{ line: number; field: string; message: string; value?: string }>;
    missingHeaders: string[];
  }>({ open: false, errors: [], missingHeaders: [] });
  const [summaryDialog, setSummaryDialog] = useState<{
    open: boolean;
    totalLines: number;
    validRows: number;
    errorRows: number;
    dupFileRows: number;
    dupBaseRows: number;
    selectedRows: number;
    imported: number;
    skipped: number;
  }>({ open: false, totalLines: 0, validRows: 0, errorRows: 0, dupFileRows: 0, dupBaseRows: 0, selectedRows: 0, imported: 0, skipped: 0 });
  const [reviewState, setReviewState] = useState<{ open: boolean; items: ReviewItem[]; validRows: Record<string, string>[] }>({ open: false, items: [], validRows: [] });

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
    const [contRes, msgRes, arRes, statsRes] = await Promise.all([
      apiCall('GET', 'contestacoes'),
      apiCall('GET', 'messages'),
      apiCall('GET', 'access_reports'),
      apiCall('GET', 'professors_stats'),
    ]);
    if (contRes.data && Array.isArray(contRes.data)) setContestacoes(contRes.data);
    if (msgRes.data && Array.isArray(msgRes.data)) setMessages(msgRes.data);
    if (arRes.data && Array.isArray(arRes.data)) setAccessReports(arRes.data);
    if (statsRes.data && typeof statsRes.data.total === 'number') setTotalProfs(statsRes.data.total);
    setLoading(false);
    setProfsRefreshTick(t => t + 1);
  };

  const fetchProfessorsPage = async () => {
    setProfsLoading(true);
    const params = new URLSearchParams({
      page: String(currentPage),
      pageSize: String(itemsPerPage),
    });
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    const { data, error } = await apiCall('GET', `professors&${params.toString()}`);
    if (!error && data && Array.isArray(data.rows)) {
      setProfessors(data.rows);
      setTotalProfs(data.total || 0);
    }
    setProfsLoading(false);
  };

  const openReport = (r: any) => {
    setSelectedReport(r);
    setReportStatus(r.status || 'Aberto');
    setReportResposta(r.resposta_admin || '');
  };

  const saveReport = async () => {
    if (!selectedReport) return;
    setSavingReport(true);
    const { data, error } = await apiCall('PUT', 'update_access_report', {
      id: selectedReport.id,
      status: reportStatus,
      resposta_admin: reportResposta,
    });
    setSavingReport(false);
    if (error || data?.error) { toast.error(data?.error || 'Erro ao salvar.'); return; }
    toast.success('Report atualizado!');
    setSelectedReport(null);
    fetchData();
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
      carga_horaria: p.carga_horaria || 0,
      total_cotas: p.total_cotas || 0,
      cargo: (p as any).cargo || '',
      role: p.role || 'professor',
      status: normalizeStatus(p.status),
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
    if (formData.data_nascimento && !isValidDate(formData.data_nascimento)) {
      toast.error('Data de nascimento inválida (use DD/MM/AAAA).');
      return;
    }
    if (!isValidDate(formData.vinculo_inicio)) {
      toast.error('Data de Admissão inválida (use DD/MM/AAAA).');
      return;
    }
    if (!isValidDate(formData.vinculo_fim)) {
      toast.error('Data da Aposentadoria inválida (use DD/MM/AAAA).');
      return;
    }
    const payload = { ...formData, cpf: unmaskCPF(formData.cpf), cargo: formData.cargo || null };
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

  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearPassword, setClearPassword] = useState('');
  const [clearing, setClearing] = useState(false);
  const [showClearPassword, setShowClearPassword] = useState(false);

  const openClearDialog = () => {
    setClearPassword('');
    setClearDialogOpen(true);
  };

  const handleClearDatabase = async () => {
    if (!clearPassword) { toast.error('Informe sua senha de administrador.'); return; }
    setClearing(true);
    const { data, error } = await apiCall('POST', 'delete_all_professors', { password: clearPassword });
    setClearing(false);
    if (error || data?.error) { toast.error(data?.error || 'Erro ao limpar base.'); return; }
    setClearDialogOpen(false);
    setClearPassword('');
    toast.success('Base de dados limpa com sucesso!');
    fetchData();
  };

  const parsePdfRows = async (file: File): Promise<Record<string, string>[]> => {
    // Lazy import para não impactar bundle inicial
    const pdfjs: any = await import('pdfjs-dist/build/pdf.mjs');
    // worker via URL ESM
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.mjs?url')).default;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const expected = ['nome', 'matricula', 'cpf', 'vinculo_inicio', 'vinculo_fim', 'carga_horaria', 'total_cotas', 'status'];
    const rows: Record<string, string>[] = [];

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      // Agrupa items por linha (Y aproximado)
      const linesMap = new Map<number, { x: number; s: string }[]>();
      for (const it of tc.items as any[]) {
        const y = Math.round(it.transform[5] / 2) * 2;
        const x = it.transform[4];
        const s = String(it.str || '');
        if (!s.trim()) continue;
        if (!linesMap.has(y)) linesMap.set(y, []);
        linesMap.get(y)!.push({ x, s });
      }
      const ys = [...linesMap.keys()].sort((a, b) => b - a); // topo->baixo
      // Tolerante a erros do PDF: aceita separadores =, --, -, . e 8-9 dígitos no bloco final
      const cpfRe = /(\d{3})\.?[-=]?(\d{3})\.?[-=]?(\d{3})[-=.]{0,2}(\d{2})/;
      const isDateLike = (t: string) =>
        /^\d{2}\/\d{2}\/\d{4}$/.test(t) || /^\d{2}\/\d{4}$/.test(t);
      // Aceita "40H" e variações com letra O em vez de zero (ex: "4OH")
      const cargaRe = /(\d{1,2}[O0]?|[O0]?\d{1,2})\s*H\b/i;
      const normalizeCarga = (s: string) => s.replace(/O/gi, '0');
      for (const y of ys) {
        const parts = linesMap.get(y)!.sort((a, b) => a.x - b.x).map(p => p.s);
        const lineText = parts.join(' ').replace(/\s+/g, ' ').trim();
        if (!lineText) continue;
        if (/^RELA[ÇC][ÃA]O/i.test(lineText)) continue;
        if (/\bNOME\b/i.test(lineText) && /\bCPF\b/i.test(lineText)) continue;
        if (/^CARGA\s+HORARIA$/i.test(lineText)) continue;

        const m = lineText.match(cpfRe);
        if (!m) continue;
        const cpf = `${m[1]}${m[2]}${m[3]}${m[4]}`;
        const before = lineText.slice(0, m.index!).trim();
        const after = lineText.slice(m.index! + m[0].length).trim();

        // matricula = último token numérico em "before"; nome = restante
        const beforeTokens = before.split(/\s+/);
        let matricula = '';
        for (let i = beforeTokens.length - 1; i >= 0; i--) {
          if (/^\d{1,8}$/.test(beforeTokens[i])) {
            matricula = beforeTokens[i];
            beforeTokens.splice(i, 1);
            break;
          }
        }
        const nome = beforeTokens.join(' ').trim();
        if (!nome) continue;

        // carga horaria: padrão "40H", "20H" (tolera "4OH" com letra O)
        const cargaMatch = after.match(cargaRe);
        const carga = cargaMatch ? normalizeCarga(cargaMatch[1]) : '';
        const preCarga = cargaMatch ? after.slice(0, cargaMatch.index!).trim() : '';
        const postCarga = cargaMatch ? after.slice(cargaMatch.index! + cargaMatch[0].length).trim() : after;

        const dateTokens = preCarga.split(/\s+/).filter(Boolean);
        const admissao = dateTokens[0] && isDateLike(dateTokens[0]) ? dateTokens[0] : '';
        const aposent = dateTokens[1] && isDateLike(dateTokens[1]) ? dateTokens[1] : '';

        const postTokens = postCarga.split(/\s+/).filter(Boolean);
        const cotas = postTokens[0] && /^\d+$/.test(postTokens[0]) ? postTokens[0] : '';
        const status = (postTokens.slice(1).join(' ') || 'ATIVO').toUpperCase();

        const obj: Record<string, string> = {
          nome,
          matricula,
          cpf,
          vinculo_inicio: admissao,
          vinculo_fim: aposent,
          carga_horaria: carga,
          total_cotas: cotas,
          status,
        };
        // mantém compat com `expected` (silencia lint)
        void expected;
        rows.push(obj);
      }
    }
    return rows;
  };

  const runImport = async (rows: Record<string, string>[], reviewCounts?: { total: number; valid: number; error: number; dup_file: number; dup_base: number }) => {
    if (rows.length === 0) { toast.error('Nenhuma linha selecionada.'); return; }
    setImporting(true);
    setImportProgress({ current: 0, total: rows.length });
    try {
      const CHUNK = 100;
      let imported = 0;
      let skipped = 0;
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        const { data, error } = await apiCall('POST', 'import_csv', { rows: chunk });
        if (error || data?.error) {
          toast.error(data?.error || 'Erro na importação.');
          return;
        }
        imported += data?.count || 0;
        skipped += data?.skipped || 0;
        setImportProgress({ current: Math.min(i + chunk.length, rows.length), total: rows.length });
      }
      setSummaryDialog({
        open: true,
        totalLines: reviewCounts?.total || rows.length,
        validRows: reviewCounts?.valid || rows.length,
        errorRows: reviewCounts?.error || 0,
        dupFileRows: reviewCounts?.dup_file || 0,
        dupBaseRows: reviewCounts?.dup_base || 0,
        selectedRows: rows.length,
        imported,
        skipped,
      });
      toast.success(`${imported} professor(es) importado(s)!${skipped > 0 ? ` (${skipped} ignorada(s) pelo servidor)` : ''}`);
      fetchData();
    } catch (err: any) {
      toast.error(`Erro ao importar: ${err?.message || err}`);
    } finally {
      setImporting(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportProgress({ current: 0, total: 0 });
    try {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
      let rows: Record<string, string>[] = [];
      if (isPdf) {
        rows = await parsePdfRows(file);
        if (rows.length === 0) {
          toast.error('Nenhuma linha válida encontrada no PDF (verifique se o texto é selecionável).');
          return;
        }
      } else {
        const text = await file.text();
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) { toast.error('CSV vazio ou inválido.'); return; }
        const sep = lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/^\ufeff/, ''));
        const missing = TEMPLATE_COLUMNS.filter(c => !headers.includes(c));
        const extras = headers.filter(h => h && !TEMPLATE_COLUMNS.includes(h as typeof TEMPLATE_COLUMNS[number]));
        if (missing.length > 0 || extras.length > 0) {
          const parts: string[] = [];
          if (missing.length) parts.push(`Faltando: ${missing.join(', ')}`);
          if (extras.length) parts.push(`Não reconhecidas: ${extras.join(', ')}`);
          toast.error(`Colunas divergentes do modelo. ${parts.join(' | ')}. Baixe o "Modelo CSV" e ajuste o arquivo.`);
          return;
        }
        rows = lines.slice(1).map(line => {
          const values = line.split(sep).map(v => v.trim());
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = values[i] || ''; });
          return obj;
        });
      }

      // ===== Validação client-side com classificação por linha =====
      // Chave única = cpf + matrícula (permite 2º vínculo: mesmo CPF, matrícula diferente)
      const ALLOWED = TEMPLATE_COLUMNS;
      // Carrega TODOS os professores da base para checagem de duplicidade
      const { data: allProfsData } = await apiCall('GET', 'professors_all');
      const allProfs: Professor[] = Array.isArray(allProfsData) ? allProfsData : [];
      const existingByCpf = new Map<string, Set<string>>();
      allProfs.forEach(p => {
        const c = (p.cpf || '').replace(/\D/g, '');
        if (!c) return;
        const m = (p.matricula || '').trim();
        if (!existingByCpf.has(c)) existingByCpf.set(c, new Set());
        existingByCpf.get(c)!.add(m);
      });
      const existingMatToCpf = new Map<string, string>();
      allProfs.forEach(p => {
        const m = (p.matricula || '').trim();
        const c = (p.cpf || '').replace(/\D/g, '');
        if (m) existingMatToCpf.set(m, c);
      });
      const seenPair = new Map<string, number>();
      const seenCpf = new Map<string, { line: number; mat: string }>();
      const seenMat = new Map<string, { line: number; cpf: string }>();
      const items: ReviewItem[] = [];

      rows.forEach((r, idx) => {
        const ln = idx + 2;
        const clean: Record<string, string> = {};
        ALLOWED.forEach(k => { clean[k] = String(r[k] ?? '').trim(); });
        const nome = clean.nome;
        const cpfRaw = clean.cpf;
        const cpf = cpfRaw.replace(/\D/g, '');
        const mat = clean.matricula;
        clean.cpf = cpf;

        if (!nome) {
          items.push({ line: ln, status: 'error', reason: 'Nome ausente', data: clean, selectable: false });
          return;
        }
        if (!cpf) {
          items.push({ line: ln, status: 'error', reason: 'CPF ausente', data: clean, selectable: false });
          return;
        }
        if (cpf.length !== 11) {
          items.push({ line: ln, status: 'error', reason: `CPF inválido "${cpfRaw}" (${cpf.length} dígitos)`, data: clean, selectable: false });
          return;
        }
        if (clean.total_cotas && isNaN(Number(clean.total_cotas))) {
          items.push({ line: ln, status: 'error', reason: `total_cotas não numérico "${clean.total_cotas}"`, data: clean, selectable: false });
          return;
        }

        const pairKey = `${cpf}|${mat}`;

        // 1) Linha idêntica (cpf+matrícula) já vista no arquivo
        if (seenPair.has(pairKey)) {
          items.push({
            line: ln, status: 'dup_file',
            reason: `Linha duplicada (cpf+matrícula) — 1ª ocorrência linha ${seenPair.get(pairKey)}`,
            data: clean, selectable: false,
          });
          return;
        }

        // 2) cpf+matrícula já existe na base
        if (existingByCpf.get(cpf)?.has(mat)) {
          items.push({
            line: ln, status: 'dup_base',
            reason: 'Cadastro já existe (cpf+matrícula) na base',
            data: clean, selectable: true,
          });
          return;
        }

        // 3) CPF repetido no arquivo, matrícula diferente → 2º vínculo válido
        if (seenCpf.has(cpf)) {
          const prev = seenCpf.get(cpf)!;
          items.push({
            line: ln, status: 'valid',
            reason: `2º vínculo — CPF também na linha ${prev.line} (matrícula ${prev.mat || '—'})`,
            data: clean, selectable: true,
          });
          seenPair.set(pairKey, ln);
          if (mat) seenMat.set(mat, { line: ln, cpf });
          return;
        }

        // 4) CPF já na base com outra matrícula → 2º vínculo válido
        if (existingByCpf.has(cpf)) {
          items.push({
            line: ln, status: 'valid',
            reason: '2º vínculo — CPF já cadastrado com outra matrícula',
            data: clean, selectable: true,
          });
          seenPair.set(pairKey, ln);
          seenCpf.set(cpf, { line: ln, mat });
          if (mat) seenMat.set(mat, { line: ln, cpf });
          return;
        }

        // 5) Matrícula repetida no arquivo com CPF diferente
        if (mat && seenMat.has(mat) && seenMat.get(mat)!.cpf !== cpf) {
          items.push({
            line: ln, status: 'dup_file',
            reason: `Matrícula repetida (1ª ocorrência linha ${seenMat.get(mat)!.line}, CPF diferente)`,
            data: clean, selectable: true,
          });
          return;
        }

        // 6) Matrícula já na base pertencendo a outro CPF
        if (mat && existingMatToCpf.has(mat) && existingMatToCpf.get(mat) !== cpf) {
          items.push({
            line: ln, status: 'dup_base',
            reason: 'Matrícula já existe na base (CPF diferente)',
            data: clean, selectable: true,
          });
          return;
        }

        seenPair.set(pairKey, ln);
        seenCpf.set(cpf, { line: ln, mat });
        if (mat) seenMat.set(mat, { line: ln, cpf });
        items.push({ line: ln, status: 'valid', reason: '', data: clean, selectable: true });
      });

      if (items.length === 0) { toast.error('Nenhuma linha encontrada no arquivo.'); return; }

      // Se não há conflitos, importa direto sem abrir modal
      const hasConflicts = items.some(it => it.status !== 'valid' || it.reason);
      if (!hasConflicts) {
        const rows = items.filter(it => it.status === 'valid').map(it => it.data);
        const reviewCounts = {
          total: items.length,
          valid: items.filter(i => i.status === 'valid').length,
          error: items.filter(i => i.status === 'error').length,
          dup_file: items.filter(i => i.status === 'dup_file').length,
          dup_base: items.filter(i => i.status === 'dup_base').length,
        };
        await runImport(rows, reviewCounts);
        return;
      }

      // Abre o modal mostrando todas as linhas (válidas pré-selecionadas + conflitos para revisão).
      setReviewState({ open: true, items, validRows: [] });
    } catch (err: any) {
      toast.error(`Erro ao processar arquivo: ${err?.message || err}`);
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
        `"${c.motivo}"`, `"${c.descricao}"`, c.whatsapp ? maskPhone(c.whatsapp) : '', c.status,
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

  const resetMsgForm = () => {
    setEditingMsgId(null);
    setMsgTitle('');
    setMsgContent('');
    setMsgScheduled('');
    setMsgTargetType('all');
    setMsgTargetRoles([]);
    setMsgTargetCargos([]);
    setMsgTargetUsers([]);
    setUserSearch('');
    setUserResults([]);
  };

  const openNewMessage = async () => {
    resetMsgForm();
    setMsgDialogOpen(true);
    if (cargosList.length === 0) {
      const { data } = await apiCall('GET', 'cargos_distinct');
      if (Array.isArray(data)) setCargosList(data);
    }
  };

  const openEditMessage = async (m: Message) => {
    resetMsgForm();
    setEditingMsgId(m.id);
    setMsgTitle(m.title);
    setMsgContent(m.content);
    // datetime-local needs "YYYY-MM-DDTHH:mm"
    if (m.scheduled_at) {
      const d = new Date(m.scheduled_at);
      const pad = (n: number) => String(n).padStart(2, '0');
      setMsgScheduled(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
    setMsgTargetType((m.target_type as any) || 'all');
    setMsgTargetRoles(m.target_roles || []);
    setMsgTargetCargos(m.target_cargos || []);
    if (m.target_user_ids && m.target_user_ids.length > 0) {
      const { data } = await apiCall('GET', `professors_by_ids&ids=${m.target_user_ids.join(',')}`);
      if (Array.isArray(data)) setMsgTargetUsers(data);
    }
    if (cargosList.length === 0) {
      const { data } = await apiCall('GET', 'cargos_distinct');
      if (Array.isArray(data)) setCargosList(data);
    }
    setMsgDialogOpen(true);
  };

  const handleSendMessage = async () => {
    if (!msgTitle || !msgContent) {
      toast.error('Título e conteúdo são obrigatórios.');
      return;
    }
    if (msgTargetType === 'role' && msgTargetRoles.length === 0 && msgTargetCargos.length === 0) {
      toast.error('Selecione pelo menos um cargo ou função.');
      return;
    }
    if (msgTargetType === 'users' && msgTargetUsers.length === 0) {
      toast.error('Selecione pelo menos um usuário.');
      return;
    }
    setSendingMsg(true);
    const payload = {
      id: editingMsgId,
      title: msgTitle,
      content: msgContent,
      scheduled_at: msgScheduled || null,
      target_type: msgTargetType,
      target_roles: msgTargetType === 'role' ? msgTargetRoles : [],
      target_cargos: msgTargetType === 'role' ? msgTargetCargos : [],
      target_user_ids: msgTargetType === 'users' ? msgTargetUsers.map(u => u.id) : [],
    };
    const { data, error } = editingMsgId
      ? await apiCall('PUT', 'update_message', payload)
      : await apiCall('POST', 'create_message', payload);
    setSendingMsg(false);
    if (error || data?.error) {
      toast.error(data?.error || 'Erro ao salvar.');
      return;
    }
    toast.success(editingMsgId ? 'Mensagem atualizada!' : (msgScheduled ? 'Mensagem programada!' : 'Mensagem enviada!'));
    resetMsgForm();
    setMsgDialogOpen(false);
    fetchData();
  };

  const handleResendMessage = async (id: string) => {
    if (!confirm('Reenviar esta mensagem agora? As leituras serão resetadas e aparecerá como não lida para os destinatários.')) return;
    const { data, error } = await apiCall('POST', `resend_message&id=${id}`);
    if (error || data?.error) toast.error(data?.error || 'Erro ao reenviar.');
    else { toast.success('Mensagem reenviada!'); fetchData(); }
  };

  const handleDuplicateMessage = async (id: string) => {
    const { data, error } = await apiCall('POST', `duplicate_message&id=${id}`);
    if (error || data?.error) { toast.error(data?.error || 'Erro ao duplicar.'); return; }
    toast.success('Cópia criada como rascunho.');
    await fetchData();
    // open edit dialog for the new copy after fetching fresh list
    setTimeout(async () => {
      const { data: msgs } = await apiCall('GET', 'messages');
      const copy = Array.isArray(msgs) ? msgs.find((m: any) => m.id === data.id) : null;
      if (copy) openEditMessage(copy);
    }, 100);
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

  // Debounced user lookup for "specific users" picker
  useEffect(() => {
    if (msgTargetType !== 'users' || !msgDialogOpen) return;
    const t = setTimeout(async () => {
      const q = userSearch.trim();
      const { data } = await apiCall('GET', `professors_lookup&q=${encodeURIComponent(q)}&limit=20`);
      if (Array.isArray(data)) setUserResults(data);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSearch, msgTargetType, msgDialogOpen]);


  // Debounce search input (300ms) and reset to page 1 when search changes
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, itemsPerPage]);

  // Fetch professors page from server whenever pagination/search changes
  useEffect(() => {
    if (!professor || professor.role !== 'admin') return;
    fetchProfessorsPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professor, currentPage, itemsPerPage, debouncedSearch, profsRefreshTick]);

  const refreshProfessors = () => setProfsRefreshTick(t => t + 1);

  if (!professor || professor.role !== 'admin') return null;

  // Server-side pagination
  const paginatedProfs = professors;
  const totalPages = Math.max(1, Math.ceil(totalProfs / itemsPerPage));
  const showingFrom = totalProfs === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const showingTo = Math.min(currentPage * itemsPerPage, totalProfs);

  const statCards = [
    { label: 'Total Professores', value: totalProfs, icon: Users, color: 'bg-primary/10 text-primary' },
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
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
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
              <p className="text-xs text-muted-foreground truncate">{professor?.email || professor?.matricula || 'Administrador'}</p>
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
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
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
                      <p className="text-xs text-muted-foreground truncate">{professor?.email || professor?.matricula || 'Administrador'}</p>
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
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-border">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-foreground">{professor?.nome || 'Administrador'}</p>
                <p className="text-xs text-muted-foreground">{professor?.email || professor?.matricula || 'Administrador'}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="admin-scroll-area flex-1 p-4 lg:p-8 space-y-6 overflow-y-auto">
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
                        {professors.slice(0, 5).map(p => (
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
                  <h3 className="font-semibold text-foreground">Professores ({totalProfs})</h3>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <input ref={fileInputRef} type="file" accept=".csv,.pdf,application/pdf" className="hidden" onChange={handleFileImport} disabled={importing} />
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        const headers = [...TEMPLATE_COLUMNS];
                        const example = [
                          ['JOSE DA SILVA', '12345', '12345678909', '01/04/2005', '', '40', '132', 'PROFESSOR (A)'],
                          ['MARIA OLIVEIRA', '12346', '98765432100', '10/02/2000', '15/06/2024', '40', '132', 'PROFESSOR (A)'],
                        ];
                        const csv = [headers.join(';'), ...example.map(r => r.join(';'))].join('\n');
                        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'modelo-importacao-professores.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      title="Baixar modelo CSV"
                    >
                      <Download className="w-4 h-4 mr-1.5" /> Modelo CSV
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 sm:flex-none" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                      {importing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          {importProgress.total > 0 ? `Importando ${importProgress.current}/${importProgress.total}` : 'Importando...'}
                        </>
                      ) : (
                        <><Upload className="w-4 h-4 mr-1.5" /> Importar (CSV/PDF)</>
                      )}
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={openClearDialog}>
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
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="text-xs font-medium text-muted-foreground min-w-[150px]">Nome</TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground w-[80px] lg:w-[120px]">Mat</TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground hidden lg:table-cell">CPF</TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground hidden md:table-cell whitespace-nowrap">Data de Admissão</TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground hidden md:table-cell whitespace-nowrap">Data da Aposentadoria</TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground hidden sm:table-cell">Cotas</TableHead>
                            <TableHead className="text-xs font-medium text-muted-foreground text-right sticky right-0 bg-card/95 backdrop-blur-sm z-10 border-l border-border px-4 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.1)]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedProfs.map(p => (
                            <TableRow key={p.id} className="group">
                              <TableCell className="text-xs lg:text-sm font-medium py-3">{p.nome}</TableCell>
                              <TableCell className="font-mono text-xs lg:text-sm py-3">{p.matricula}</TableCell>
                              <TableCell className="font-mono text-xs lg:text-sm hidden lg:table-cell py-3">{p.cpf}</TableCell>
                              <TableCell className="text-xs lg:text-sm hidden md:table-cell py-3 whitespace-nowrap">{maskDate(p.vinculo_inicio || '') || '—'}</TableCell>
                              <TableCell className="text-xs lg:text-sm hidden md:table-cell py-3 whitespace-nowrap">{maskDate(p.vinculo_fim || '') || '—'}</TableCell>
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
                    {/* Paginação */}
                    <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-3 px-4 sm:px-6 py-4 border-t border-border">
                      <div className="flex items-center gap-3 order-2 sm:order-1">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          Mostrando {showingFrom}–{showingTo} de {totalProfs}
                        </p>
                        <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(parseInt(v, 10))}>
                          <SelectTrigger className="h-8 w-[110px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="25">25 / página</SelectItem>
                            <SelectItem value="50">50 / página</SelectItem>
                            <SelectItem value="100">100 / página</SelectItem>
                          </SelectContent>
                        </Select>
                        {profsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      </div>
                      {totalPages > 1 && (
                        <Pagination className="order-1 sm:order-2 mx-0 sm:justify-end w-auto">
                          <PaginationContent className="flex-wrap justify-center">
                            <PaginationItem>
                              <PaginationPrevious
                                href="#"
                                onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1)); }}
                                className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                              />
                            </PaginationItem>
                            {(() => {
                              const pages: (number | 'ellipsis')[] = [];
                              const add = (p: number) => { if (!pages.includes(p)) pages.push(p); };
                              add(1);
                              const start = Math.max(2, currentPage - 1);
                              const end = Math.min(totalPages - 1, currentPage + 1);
                              if (start > 2) pages.push('ellipsis');
                              for (let i = start; i <= end; i++) add(i);
                              if (end < totalPages - 1) pages.push('ellipsis');
                              if (totalPages > 1) add(totalPages);
                              return pages.map((p, idx) =>
                                p === 'ellipsis' ? (
                                  <PaginationItem key={`e-${idx}`}><PaginationEllipsis /></PaginationItem>
                                ) : (
                                  <PaginationItem key={p}>
                                    <PaginationLink
                                      href="#"
                                      onClick={(e) => { e.preventDefault(); setCurrentPage(p); }}
                                      isActive={p === currentPage}
                                    >
                                      {p}
                                    </PaginationLink>
                                  </PaginationItem>
                                )
                              );
                            })()}
                            <PaginationItem>
                              <PaginationNext
                                href="#"
                                onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1)); }}
                                className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      )}
                    </div>

                  </>
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
                          <TableHead className="text-xs font-medium text-muted-foreground">Anexo II</TableHead>
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
                            <TableCell className="text-sm">{c.whatsapp ? maskPhone(c.whatsapp) : '—'}</TableCell>
                            <TableCell className="text-sm">
                              {c.documento_url ? (
                                <a href={c.documento_url} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">
                                  <Download className="w-3.5 h-3.5" /> Baixar
                                </a>
                              ) : '—'}
                            </TableCell>
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
          {activeTab === 'access_reports' && (
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-foreground">Reports de Acesso ({accessReports.length})</h3>
                </div>
                {loading ? (
                  <div className="p-6 text-muted-foreground text-sm">Carregando...</div>
                ) : accessReports.length === 0 ? (
                  <div className="p-6 text-muted-foreground text-sm">Nenhum report recebido.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs font-medium text-muted-foreground">Protocolo</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Nome</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">CPF</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Vínculo</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Assunto</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">WhatsApp</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Status</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground">Data</TableHead>
                          <TableHead className="text-xs font-medium text-muted-foreground text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accessReports.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-mono text-xs">{r.protocolo || '—'}</TableCell>
                            <TableCell className="text-sm">{r.nome_completo}</TableCell>
                            <TableCell className="font-mono text-xs">{maskCPF(r.cpf || '')}</TableCell>
                            <TableCell className="text-sm">{r.tipo_vinculo}</TableCell>
                            <TableCell className="max-w-[220px] truncate text-sm">{r.assunto}</TableCell>
                            <TableCell className="text-sm">
                              {r.whatsapp ? (
                                <div className="flex items-center gap-2">
                                  <span>{maskPhone(r.whatsapp)}</span>
                                  <a
                                    href={buildWhatsappUrl(r.whatsapp, r.nome_completo, r.protocolo) || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Abrir conversa no WhatsApp"
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-[#25D366] text-white hover:opacity-90 transition"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </a>
                                </div>
                              ) : '—'}
                            </TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{r.status}</Badge></TableCell>
                            <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString('pt-BR')}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => openReport(r)}>Analisar</Button>
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

          {activeTab === 'messages' && (

            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Mensagens ({messages.length})</h3>
                <Button size="sm" onClick={openNewMessage}>
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
                  {messages.map(m => {
                    const audience = (() => {
                      const tt = m.target_type || 'all';
                      if (tt === 'all') return 'Todos';
                      if (tt === 'role') {
                        const parts: string[] = [];
                        if (m.target_roles?.length) parts.push(...m.target_roles.map(r => r === 'professor' ? 'Professores' : r === 'admin' ? 'Admin' : r === 'juridico' ? 'Jurídico' : r));
                        if (m.target_cargos?.length) parts.push(...m.target_cargos);
                        return parts.join(', ') || 'Cargo';
                      }
                      if (tt === 'users') return `${m.target_user_ids?.length || 0} usuário(s)`;
                      return 'Todos';
                    })();
                    return (
                      <Card key={m.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h4 className="font-semibold text-sm">{m.title}</h4>
                                <Badge variant={m.sent ? "default" : "secondary"} className="text-[10px]">
                                  {m.sent ? 'Enviada' : 'Programada'}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">Para: {audience}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground line-clamp-2">{m.content}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                {m.scheduled_at && ` • Programada para ${new Date(m.scheduled_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {!m.sent && (
                                <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar" onClick={() => openEditMessage(m)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Reenviar agora" onClick={() => handleResendMessage(m.id)}>
                                <Send className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8" title="Duplicar" onClick={() => handleDuplicateMessage(m.id)}>
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" title="Excluir" onClick={() => handleDeleteMessage(m.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Message Dialog (create/edit) */}
              <Dialog open={msgDialogOpen} onOpenChange={(o) => { setMsgDialogOpen(o); if (!o) resetMsgForm(); }}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingMsgId ? 'Editar Mensagem' : 'Nova Mensagem'}</DialogTitle>
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

                    <div className="space-y-2 border-t pt-4">
                      <Label>Destinatários *</Label>
                      <div className="flex flex-wrap gap-2">
                        {(['all', 'role', 'users'] as const).map(t => (
                          <Button
                            key={t}
                            type="button"
                            size="sm"
                            variant={msgTargetType === t ? 'default' : 'outline'}
                            onClick={() => setMsgTargetType(t)}
                          >
                            {t === 'all' ? 'Todos' : t === 'role' ? 'Por cargo' : 'Usuários específicos'}
                          </Button>
                        ))}
                      </div>

                      {msgTargetType === 'role' && (
                        <div className="space-y-3 pt-2">
                          <div>
                            <p className="text-xs font-medium mb-1">Função</p>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { v: 'professor', l: 'Professores' },
                                { v: 'admin', l: 'Admin' },
                                { v: 'juridico', l: 'Jurídico' },
                              ].map(r => {
                                const active = msgTargetRoles.includes(r.v);
                                return (
                                  <Button
                                    key={r.v}
                                    type="button"
                                    size="sm"
                                    variant={active ? 'default' : 'outline'}
                                    onClick={() => setMsgTargetRoles(prev => active ? prev.filter(x => x !== r.v) : [...prev, r.v])}
                                  >
                                    {r.l}
                                  </Button>
                                );
                              })}
                            </div>
                          </div>
                          {cargosList.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1">Cargo específico (opcional)</p>
                              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                {cargosList.map(c => {
                                  const active = msgTargetCargos.includes(c);
                                  return (
                                    <Button
                                      key={c}
                                      type="button"
                                      size="sm"
                                      variant={active ? 'default' : 'outline'}
                                      className="h-7 text-xs"
                                      onClick={() => setMsgTargetCargos(prev => active ? prev.filter(x => x !== c) : [...prev, c])}
                                    >
                                      {c}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {msgTargetType === 'users' && (
                        <div className="space-y-2 pt-2">
                          <Input
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                            placeholder="Buscar por nome, matrícula ou CPF..."
                          />
                          {userResults.length > 0 && (
                            <div className="border rounded max-h-40 overflow-y-auto">
                              {userResults.map(u => {
                                const already = msgTargetUsers.some(x => x.id === u.id);
                                return (
                                  <button
                                    key={u.id}
                                    type="button"
                                    disabled={already}
                                    onClick={() => {
                                      setMsgTargetUsers(prev => [...prev, u]);
                                      setUserSearch('');
                                      setUserResults([]);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed border-b last:border-0"
                                  >
                                    <div className="font-medium">{u.nome}</div>
                                    <div className="text-xs text-muted-foreground">{u.matricula || '—'} {u.cargo ? `• ${u.cargo}` : ''}</div>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {msgTargetUsers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {msgTargetUsers.map(u => (
                                <Badge key={u.id} variant="secondary" className="gap-1">
                                  {u.nome}
                                  <button
                                    type="button"
                                    onClick={() => setMsgTargetUsers(prev => prev.filter(x => x.id !== u.id))}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground">{msgTargetUsers.length} usuário(s) selecionado(s)</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setMsgDialogOpen(false); resetMsgForm(); }}>Cancelar</Button>
                    <Button onClick={handleSendMessage} disabled={sendingMsg}>
                      <Send className="w-4 h-4 mr-1.5" />
                      {sendingMsg ? 'Salvando...' : editingMsgId ? 'Salvar' : msgScheduled ? 'Programar' : 'Enviar Agora'}
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
                <Input value={formData.nome} onChange={e => setFormData({ ...formData, nome: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input value={formData.cpf} onChange={e => setFormData({ ...formData, cpf: e.target.value })} placeholder="00000000000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Matrícula *</Label>
                <Input value={formData.matricula} onChange={e => setFormData({ ...formData, matricula: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Data Nascimento</Label>
                <Input value={formData.data_nascimento} onChange={e => setFormData({ ...formData, data_nascimento: maskDate(e.target.value) })} placeholder="DD/MM/AAAA" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de Admissão</Label>
                <Input value={formData.vinculo_inicio} onChange={e => setFormData({ ...formData, vinculo_inicio: maskDate(e.target.value) })} placeholder="DD/MM/AAAA" />
              </div>
              <div className="space-y-2">
                <Label>Data da Aposentadoria</Label>
                <Input value={formData.vinculo_fim} onChange={e => setFormData({ ...formData, vinculo_fim: maskDate(e.target.value) })} placeholder="DD/MM/AAAA" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Carga Horária (semanal)</Label>
                <Input type="number" value={formData.carga_horaria} onChange={e => setFormData({ ...formData, carga_horaria: parseInt(e.target.value) || 0 })} placeholder="40" />
              </div>
              <div className="space-y-2">
                <Label>Total de Cotas</Label>
                <Input type="number" value={formData.total_cotas} onChange={e => setFormData({ ...formData, total_cotas: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Input value={formData.cargo} onChange={e => setFormData({ ...formData, cargo: e.target.value })} placeholder="Ex.: Professor PIII" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Perfil (Role)</Label>
                <Select value={formData.role || 'professor'} onValueChange={v => setFormData({ ...formData, role: v })}>
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
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status || 'ATIVO'} onValueChange={v => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                {editingProf
                  ? 'Redefinir senha (deixe vazio para manter a atual)'
                  : 'Senha (deixe vazio para usar o CPF como senha inicial)'}
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

      {/* Confirmação para limpar base (exige senha do admin) */}
      <Dialog open={clearDialogOpen} onOpenChange={(o) => { if (!clearing) setClearDialogOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">⚠️ Limpar base de dados</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Esta ação irá <strong>excluir TODOS os professores e contestações</strong> do
              sistema. Contas de administrador e jurídico serão preservadas.
            </p>
            <p className="text-destructive font-medium">Esta ação não pode ser desfeita.</p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Confirme com sua senha de administrador</label>
              <div className="relative">
                <Input
                  type={showClearPassword ? 'text' : 'password'}
                  value={clearPassword}
                  onChange={(e) => setClearPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleClearDatabase(); }}
                  placeholder="Digite sua senha"
                  autoFocus
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowClearPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  aria-label={showClearPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {showClearPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setClearDialogOpen(false)} disabled={clearing}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleClearDatabase} disabled={clearing || !clearPassword}>
              {clearing ? 'Limpando...' : 'Confirmar e limpar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de linhas duplicadas */}
      <Dialog
        open={dupDialog.open}
        onOpenChange={(open) => {
          if (!open && dupDialog.resolve) dupDialog.resolve({ action: 'cancel' });
        }}
      >
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              Linhas duplicadas detectadas ({dupDialog.groups.length} grupo
              {dupDialog.groups.length !== 1 ? 's' : ''})
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-auto flex-1 border rounded-md">
            <table className="w-full text-xs">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">Manter</th>
                  <th className="px-2 py-1 text-left">#</th>
                  {dupDialog.groups[0] && Object.keys(dupDialog.groups[0][0]).map(k => {
                    const headerLabels: Record<string, string> = {
                      nome: 'Nome',
                      matricula: 'Mat',
                      cpf: 'CPF',
                      vinculo_inicio: 'Data de Admissão',
                      vinculo_fim: 'Data da Aposentadoria',
                      carga_horaria: 'Carga Horária',
                      total_cotas: 'Cotas',
                      status: 'Status do Servidor',
                      data_nascimento: 'Data de Nascimento',
                    };
                    return (
                      <th key={k} className="px-2 py-1 text-left whitespace-nowrap">{headerLabels[k] || k}</th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {dupDialog.groups.map((group, gi) => (
                  <React.Fragment key={gi}>
                    <tr className="bg-amber-50">
                      <td colSpan={Object.keys(group[0]).length + 2} className="px-2 py-1 font-semibold text-amber-800">
                        Grupo {gi + 1} — {group.length} ocorrências (selecione qual manter)
                      </td>
                    </tr>
                    {group.map((row, ri) => (
                      <tr key={`${gi}-${ri}`} className="border-t hover:bg-muted/30">
                        <td className="px-2 py-1 text-center">
                          <input
                            type="radio"
                            name={`keep-group-${gi}`}
                            checked={keepIndices[gi] === ri}
                            onChange={() => setKeepIndices(prev => {
                              const next = [...prev];
                              next[gi] = ri;
                              return next;
                            })}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="px-2 py-1 text-muted-foreground">{ri + 1}</td>
                        {Object.keys(group[0]).map(k => (
                          <td key={k} className="px-2 py-1 whitespace-nowrap">{row[k]}</td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            Foram encontradas linhas com a mesma <strong>matrícula + CPF</strong>. Selecione qual linha
            manter em cada grupo, ou mantenha todas as cópias.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => dupDialog.resolve?.({ action: 'cancel' })}>
              Cancelar importação
            </Button>
            <Button variant="secondary" onClick={() => dupDialog.resolve?.({ action: 'keep' })}>
              Manter todas as cópias
            </Button>
            <Button onClick={() => dupDialog.resolve?.({ action: 'dedupe', keepIndices })}>
              Importar com seleção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de validação do CSV */}
      <Dialog open={validationDialog.open} onOpenChange={(open) => !open && setValidationDialog({ open: false, errors: [], missingHeaders: [] })}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              CSV inválido — importação bloqueada
            </DialogTitle>
          </DialogHeader>
          {validationDialog.missingHeaders.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-semibold text-destructive mb-1">Colunas obrigatórias ausentes:</p>
              <p className="text-foreground">{validationDialog.missingHeaders.join(', ')}</p>
              <p className="text-xs text-muted-foreground mt-2">
                O cabeçalho do CSV deve conter, no mínimo: <strong>nome, matricula, cpf</strong>.
              </p>
            </div>
          )}
          {validationDialog.errors.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                Foram encontrados <strong>{validationDialog.errors.length}</strong> erro(s) nos dados.
                Corrija o arquivo e tente novamente.
              </p>
              <div className="overflow-auto flex-1 border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-2 py-1 text-left w-16">Linha</th>
                      <th className="px-2 py-1 text-left">Campo</th>
                      <th className="px-2 py-1 text-left">Valor</th>
                      <th className="px-2 py-1 text-left">Erro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationDialog.errors.slice(0, 200).map((err, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 font-mono text-muted-foreground">{err.line}</td>
                        <td className="px-2 py-1 font-mono">{err.field}</td>
                        <td className="px-2 py-1 font-mono text-muted-foreground">{err.value || '—'}</td>
                        <td className="px-2 py-1 text-destructive">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {validationDialog.errors.length > 200 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    Exibindo os primeiros 200 erros de {validationDialog.errors.length}.
                  </p>
                )}
              </div>
            </>
          )}
          <DialogFooter>
            <Button onClick={() => setValidationDialog({ open: false, errors: [], missingHeaders: [] })}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de resumo da importação */}
      <Dialog open={summaryDialog.open} onOpenChange={(open) => !open && setSummaryDialog(s => ({ ...s, open: false }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importação concluída</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Total de linhas no arquivo</span>
              <span className="font-semibold">{summaryDialog.totalLines}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Linhas válidas</span>
              <span className="font-semibold text-green-600">{summaryDialog.validRows}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Linhas com erro</span>
              <span className="font-semibold text-red-600">{summaryDialog.errorRows}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Duplicadas no arquivo</span>
              <span className="font-semibold text-yellow-600">{summaryDialog.dupFileRows}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Já existentes na base</span>
              <span className="font-semibold text-orange-600">{summaryDialog.dupBaseRows}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="text-muted-foreground">Selecionadas para importar</span>
              <span className="font-semibold">{summaryDialog.selectedRows}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ignoradas pelo servidor</span>
              <span className="font-semibold">{summaryDialog.skipped}</span>
            </div>
            <div className="flex justify-between border-t pt-2 mt-2">
              <span className="font-semibold text-primary">Registros importados</span>
              <span className="font-bold text-primary text-lg">{summaryDialog.imported}</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSummaryDialog(s => ({ ...s, open: false }))}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportReviewDialog
        open={reviewState.open}
        items={reviewState.items}
        onCancel={() => { setReviewState({ open: false, items: [], validRows: [] }); toast.info('Importação cancelada.'); }}
        onConfirm={async (rows) => {
          setReviewState({ open: false, items: [], validRows: [] });
          const reviewCounts = {
            total: reviewState.items.length,
            valid: reviewState.items.filter(i => i.status === 'valid').length,
            error: reviewState.items.filter(i => i.status === 'error').length,
            dup_file: reviewState.items.filter(i => i.status === 'dup_file').length,
            dup_base: reviewState.items.filter(i => i.status === 'dup_base').length,
          };
          await runImport(rows, reviewCounts);
        }}
      />

      <Dialog open={!!selectedReport} onOpenChange={(v) => { if (!v) setSelectedReport(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analisar Report de Acesso</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Protocolo</p>
                  <p className="font-mono">{selectedReport.protocolo || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p>{new Date(selectedReport.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedReport.nome_completo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CPF</p>
                  <p className="font-mono">{maskCPF(selectedReport.cpf || '')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vínculo</p>
                  <p>{selectedReport.tipo_vinculo}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                  {selectedReport.whatsapp ? (
                    <div className="flex items-center gap-2">
                      <p>{maskPhone(selectedReport.whatsapp)}</p>
                      <a
                        href={buildWhatsappUrl(selectedReport.whatsapp, selectedReport.nome_completo, selectedReport.protocolo) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#25D366] text-white text-xs hover:opacity-90 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                      </a>
                    </div>
                  ) : <p>—</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p className="break-all">{selectedReport.email || '—'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Assunto</p>
                  <p>{selectedReport.assunto}</p>
                </div>
                {selectedReport.descricao && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Descrição</p>
                    <p className="whitespace-pre-wrap">{selectedReport.descricao}</p>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label>Status</Label>
                <Select value={reportStatus} onValueChange={setReportStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Aberto">Aberto</SelectItem>
                    <SelectItem value="Em análise">Em análise</SelectItem>
                    <SelectItem value="Resolvido">Resolvido</SelectItem>
                    <SelectItem value="Descartado">Descartado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Resposta / Observações internas</Label>
                <Textarea
                  rows={3}
                  value={reportResposta}
                  onChange={(e) => setReportResposta(e.target.value)}
                  maxLength={1000}
                  placeholder="Anotações sobre a análise deste caso..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReport(null)} disabled={savingReport}>Fechar</Button>
            <Button onClick={saveReport} disabled={savingReport}>
              {savingReport ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>

  );
};

export default AdminPage;
