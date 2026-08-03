import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight } from 'lucide-react';

export type ReviewStatus = 'valid' | 'error' | 'dup_file' | 'dup_base' | 'update' | 'nochange';

export interface ReviewDiff {
  field: string;
  label: string;
  current: string;
  incoming: string;
}

export interface ReviewItem {
  line: number;
  status: ReviewStatus;
  reason: string;
  data: Record<string, string>;
  selectable: boolean;
  /** Preenchido quando o registro já existe na base e há campos alterados */
  diffs?: ReviewDiff[];
}

interface Props {
  open: boolean;
  items: ReviewItem[];
  onCancel: () => void;
  onConfirm: (rows: Record<string, string>[], selectedItems: ReviewItem[]) => void;
}

const STATUS_LABEL: Record<ReviewStatus, string> = {
  valid: 'Válida',
  error: 'Erro',
  dup_file: 'Dup. arquivo',
  dup_base: 'Dup. base',
  update: 'Atualização',
  nochange: 'Sem alterações',
};

const STATUS_VARIANT: Record<ReviewStatus, string> = {
  valid: 'bg-green-100 text-green-800 border-green-300',
  error: 'bg-red-100 text-red-800 border-red-300',
  dup_file: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  dup_base: 'bg-orange-100 text-orange-800 border-orange-300',
  update: 'bg-blue-100 text-blue-800 border-blue-300',
  nochange: 'bg-muted text-muted-foreground border-border',
};

const preSelected = (items: ReviewItem[]) => {
  const s = new Set<number>();
  items.forEach((it, i) => { if (it.status === 'valid' || it.status === 'update') s.add(i); });
  return s;
};

export const ImportReviewDialog: React.FC<Props> = ({ open, items, onCancel, onConfirm }) => {
  const [selected, setSelected] = useState<Set<number>>(() => preSelected(items));
  const [filter, setFilter] = useState<'all' | ReviewStatus>('all');
  const [search, setSearch] = useState('');

  // Reset state when items change (new import)
  React.useEffect(() => {
    setSelected(preSelected(items));
    setFilter('all');
    setSearch('');
  }, [items]);

  const counts = useMemo(() => ({
    total: items.length,
    valid: items.filter(i => i.status === 'valid').length,
    error: items.filter(i => i.status === 'error').length,
    dup_file: items.filter(i => i.status === 'dup_file').length,
    dup_base: items.filter(i => i.status === 'dup_base').length,
    update: items.filter(i => i.status === 'update').length,
    nochange: items.filter(i => i.status === 'nochange').length,
  }), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .map((it, idx) => ({ it, idx }))
      .filter(({ it }) => filter === 'all' || it.status === filter)
      .filter(({ it }) => !q || it.data.nome?.toLowerCase().includes(q) || it.data.cpf?.includes(q) || it.data.matricula?.toLowerCase().includes(q));
  }, [items, filter, search]);

  const toggle = (idx: number) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(idx)) n.delete(idx); else n.add(idx);
      return n;
    });
  };

  const selectAllValid = () => setSelected(preSelected(items));
  const selectAllSelectable = () => {
    const s = new Set<number>();
    items.forEach((it, i) => { if (it.selectable) s.add(i); });
    setSelected(s);
  };
  const clearAll = () => setSelected(new Set());

  const confirm = () => {
    const chosen = items.filter((_, i) => selected.has(i));
    onConfirm(chosen.map(it => it.data), chosen);
  };

  const selectedUpdates = items.filter((_, i) => selected.has(i)).filter(it => it.status === 'update').length;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-5xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Revisão da importação</DialogTitle>
          <p className="text-xs text-muted-foreground">Linhas válidas e atualizações já estão selecionadas. Nas linhas de atualização é exibido o dado atual e o novo dado importado — campos vazios no arquivo não apagam o que já está cadastrado.</p>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">Total: {counts.total}</Badge>
          <Badge className={STATUS_VARIANT.valid}>Válidas: {counts.valid}</Badge>
          <Badge className={STATUS_VARIANT.update}>Atualizações: {counts.update}</Badge>
          <Badge className={STATUS_VARIANT.nochange}>Sem alterações: {counts.nochange}</Badge>
          <Badge className={STATUS_VARIANT.error}>Erros: {counts.error}</Badge>
          <Badge className={STATUS_VARIANT.dup_file}>Dup. arquivo: {counts.dup_file}</Badge>
          <Badge className={STATUS_VARIANT.dup_base}>Dup. base: {counts.dup_base}</Badge>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-center justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="valid">Válidas</TabsTrigger>
              <TabsTrigger value="update">Atualizações</TabsTrigger>
              <TabsTrigger value="nochange">Sem alterações</TabsTrigger>
              <TabsTrigger value="error">Erros</TabsTrigger>
              <TabsTrigger value="dup_file">Dup. arquivo</TabsTrigger>
              <TabsTrigger value="dup_base">Dup. base</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            placeholder="Buscar por nome, CPF ou matrícula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:max-w-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={selectAllValid}>Selecionar válidas e atualizações</Button>
          <Button type="button" size="sm" variant="outline" onClick={selectAllSelectable}>Selecionar tudo</Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>Limpar seleção</Button>
          <span className="ml-auto text-sm text-muted-foreground self-center">
            {selected.size} selecionada(s) de {items.length}
            {selectedUpdates > 0 && ` · ${selectedUpdates} atualização(ões)`}
          </span>
        </div>

        <ScrollArea className="h-[55vh] border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr className="text-left">
                <th className="p-2 w-10"></th>
                <th className="p-2 w-16">Linha</th>
                <th className="p-2 w-32">Status</th>
                <th className="p-2">Nome</th>
                <th className="p-2 w-36">CPF</th>
                <th className="p-2 w-28">Matrícula</th>
                <th className="p-2">Motivo / Alterações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ it, idx }) => (
                <tr key={idx} className="border-t hover:bg-muted/40 align-top">
                  <td className="p-2">
                    <Checkbox
                      checked={selected.has(idx)}
                      disabled={!it.selectable}
                      onCheckedChange={() => toggle(idx)}
                    />
                  </td>
                  <td className="p-2 tabular-nums">{it.line}</td>
                  <td className="p-2">
                    <Badge className={STATUS_VARIANT[it.status]} variant="outline">
                      {STATUS_LABEL[it.status]}
                    </Badge>
                  </td>
                  <td className="p-2">{it.data.nome || <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-2 tabular-nums">{it.data.cpf || '—'}</td>
                  <td className="p-2">{it.data.matricula || '—'}</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {it.reason || (it.diffs?.length ? '' : '—')}
                    {it.diffs && it.diffs.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {it.diffs.map(d => (
                          <div key={d.field} className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium text-foreground">{d.label}:</span>
                            <Badge variant="outline" className="bg-muted text-muted-foreground border-border font-normal">
                              Atual: {d.current || '—'}
                            </Badge>
                            <ArrowRight className="w-3 h-3" />
                            <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300 font-normal">
                              Novo: {d.incoming || '—'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma linha corresponde ao filtro.</td></tr>
              )}
            </tbody>
          </table>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={confirm} disabled={selected.size === 0}>
            Processar {selected.size} selecionada(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportReviewDialog;
