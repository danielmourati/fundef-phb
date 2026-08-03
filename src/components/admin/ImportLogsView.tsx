import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileDown, Eye, Loader2, Search, ArrowRight, Trash2, History } from 'lucide-react';
import { toast } from 'sonner';
import { downloadImportReportPdf, type ImportKind } from '@/lib/importReportPdf';
import type { ReviewItem } from '@/components/ImportReviewDialog';

interface LogRow {
  id: string;
  tipo: ImportKind;
  file_name: string | null;
  executed_by_name: string | null;
  counts: Record<string, number | number[]>;
  created_at: string;
}

interface LogDetail extends LogRow {
  items: ReviewItem[];
}

const TIPO_LABEL: Record<string, string> = { efetivo: 'Efetivo', contratado: 'Contratado' };

const num = (v: unknown) => (typeof v === 'number' ? v : 0);

const ImportLogsView = ({ token }: { token: string }) => {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [tipo, setTipo] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [detail, setDetail] = useState<LogDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const call = useCallback(
    async (method: 'GET' | 'DELETE', action: string, params = '') => {
      const { data, error } = await supabase.functions.invoke(`admin-api?action=${action}${params}`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      });
      return { data, error } as { data: any; error: any };
    },
    [token],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    if (tipo !== 'all') p.set('tipo', tipo);
    if (debounced) p.set('search', debounced);
    if (from) p.set('from', new Date(`${from}T00:00:00`).toISOString());
    if (to) p.set('to', new Date(`${to}T23:59:59`).toISOString());
    const { data, error } = await call('GET', 'import_logs', `&${p.toString()}`);
    setLoading(false);
    if (error || data?.error) { toast.error('Erro ao carregar o histórico.'); return; }
    setRows(data?.rows || []);
    setTotal(data?.total || 0);
  }, [call, page, pageSize, tipo, debounced, from, to]);

  useEffect(() => { load(); }, [load]);

  const fetchDetail = async (id: string): Promise<LogDetail | null> => {
    const { data, error } = await call('GET', 'import_log', `&id=${id}`);
    if (error || data?.error) { toast.error('Erro ao carregar os detalhes.'); return null; }
    return data as LogDetail;
  };

  const handleView = async (row: LogRow) => {
    setBusyId(row.id);
    const d = await fetchDetail(row.id);
    setBusyId(null);
    if (d) setDetail(d);
  };

  const handleDownload = async (row: LogRow) => {
    setBusyId(row.id);
    const d = await fetchDetail(row.id);
    setBusyId(null);
    if (!d) return;
    const counts = d.counts || {};
    downloadImportReportPdf({
      kind: d.tipo,
      fileName: d.file_name,
      user: d.executed_by_name,
      createdAt: d.created_at,
      counts: counts as any,
      items: d.items || [],
      selectedLines: Array.isArray((counts as any).selectedLines) ? ((counts as any).selectedLines as number[]) : undefined,
    });
    toast.success('Relatório gerado.');
  };

  const handleDelete = async (row: LogRow) => {
    if (!confirm('Remover este registro do histórico?')) return;
    setBusyId(row.id);
    const { data, error } = await call('DELETE', 'delete_import_log', `&id=${row.id}`);
    setBusyId(null);
    if (error || data?.error) { toast.error('Erro ao remover.'); return; }
    toast.success('Registro removido.');
    load();
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const detailUpdates = (detail?.items || []).filter((i) => (i.diffs || []).length > 0);
  const detailDups = (detail?.items || []).filter(
    (i) => i.status === 'dup_file' || (i.status === 'dup_base' && !(i.diffs || []).length),
  );

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h3 className="font-semibold text-foreground">Relatórios de Importação</h3>
            <p className="text-sm text-muted-foreground">
              Histórico das importações realizadas, com as linhas atualizadas e as descartadas como duplicadas.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={backfilling} onClick={handleBackfill}>
            {backfilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
            Recuperar importações de hoje
          </Button>
        </div>


        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por arquivo ou usuário"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={tipo} onValueChange={(v) => { setTipo(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="efetivo">Efetivo</SelectItem>
              <SelectItem value="contratado">Contratado</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" className="w-full sm:w-40" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" className="w-full sm:w-40" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead className="text-right">Import.</TableHead>
                <TableHead className="text-right">Atual.</TableHead>
                <TableHead className="text-right">Dupl.</TableHead>
                <TableHead className="text-right">Erros</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhuma importação registrada.
                  </TableCell>
                </TableRow>
              )}
              {!loading && rows.map((r) => {
                const c = r.counts || {};
                return (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{TIPO_LABEL[r.tipo] || r.tipo}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{r.file_name || '—'}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.executed_by_name || '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{num(c.imported)}</TableCell>
                    <TableCell className="text-right font-semibold text-blue-700">{num(c.updated)}</TableCell>
                    <TableCell className="text-right text-yellow-700">{num(c.dup_file) + num(c.dup_base)}</TableCell>
                    <TableCell className="text-right text-red-600">{num(c.error)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button size="icon" variant="ghost" title="Ver detalhes" disabled={busyId === r.id} onClick={() => handleView(r)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Baixar PDF" disabled={busyId === r.id} onClick={() => handleDownload(r)}>
                        {busyId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                      </Button>
                      <Button size="icon" variant="ghost" title="Remover" disabled={busyId === r.id} onClick={() => handleDelete(r)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{total} registro(s)</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span>{page} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Importação {detail ? TIPO_LABEL[detail.tipo] : ''} — {detail ? new Date(detail.created_at).toLocaleString('pt-BR') : ''}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">
                  Arquivo: <strong>{detail.file_name || '—'}</strong> · Executado por:{' '}
                  <strong>{detail.executed_by_name || '—'}</strong>
                </p>

                <div>
                  <p className="font-semibold mb-2">Linhas atualizadas ({detailUpdates.length})</p>
                  {detailUpdates.length === 0 && <p className="text-muted-foreground">Nenhuma.</p>}
                  <div className="space-y-2">
                    {detailUpdates.map((it) => (
                      <div key={`u-${it.line}`} className="rounded border border-border p-2">
                        <p className="font-medium">
                          Linha {it.line} — {it.data?.nome || '—'}
                          {it.data?.matricula ? ` (Mat. ${it.data.matricula})` : ''}
                        </p>
                        <div className="mt-1 space-y-1">
                          {(it.diffs || []).map((d) => (
                            <div key={d.field} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-muted-foreground w-40">{d.label}</span>
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                                Atual: {d.current || '—'}
                              </Badge>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Novo: {d.incoming || '—'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="font-semibold mb-2">Descartadas como duplicadas ({detailDups.length})</p>
                  {detailDups.length === 0 && <p className="text-muted-foreground">Nenhuma.</p>}
                  <ul className="space-y-1">
                    {detailDups.map((it) => (
                      <li key={`d-${it.line}`} className="text-xs">
                        <span className="font-medium">Linha {it.line}</span> — {it.data?.nome || '—'}
                        {it.data?.matricula ? ` (Mat. ${it.data.matricula})` : ''}
                        {it.reason ? <span className="text-muted-foreground"> · {it.reason}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDetail(null)}>Fechar</Button>
            {detail && (
              <Button onClick={() => handleDownload(detail)}>
                <FileDown className="w-4 h-4" /> Baixar PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ImportLogsView;
