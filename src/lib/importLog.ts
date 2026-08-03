import { supabase } from '@/integrations/supabase/client';
import type { ReviewItem } from '@/components/ImportReviewDialog';
import type { ImportKind, ImportReportCounts } from '@/lib/importReportPdf';

const KEEP = ['nome', 'cpf', 'matricula'];

/** Reduz os itens para o essencial antes de salvar no histórico */
const slim = (items: ReviewItem[]) =>
  items.map((it) => {
    const data: Record<string, string> = {};
    KEEP.forEach((k) => { if (it.data?.[k]) data[k] = it.data[k]; });
    return {
      line: it.line,
      status: it.status,
      reason: it.reason || '',
      data,
      selectable: it.selectable,
      ...(it.diffs?.length ? { diffs: it.diffs } : {}),
    };
  });

export async function logImport(params: {
  token: string;
  tipo: ImportKind;
  fileName?: string | null;
  executedByName?: string | null;
  counts: ImportReportCounts;
  items: ReviewItem[];
  selectedLines?: number[];
}) {
  try {
    const { data, error } = await supabase.functions.invoke('admin-api?action=log_import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${params.token}` },
      body: {
        tipo: params.tipo,
        file_name: params.fileName || null,
        executed_by_name: params.executedByName || null,
        counts: { ...params.counts, selectedLines: params.selectedLines || [] },
        items: slim(params.items),
      },
    });
    if (error || (data as any)?.error) {
      console.error('Falha ao registrar histórico de importação', error || data);
      return { ok: false };
    }
    return { ok: true };

  } catch (e) {
    console.error('Falha ao registrar histórico de importação', e);
  }
}
