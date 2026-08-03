import jsPDF from 'jspdf';
import type { ReviewItem, ReviewStatus } from '@/components/ImportReviewDialog';

export type ImportKind = 'efetivo' | 'contratado';

export interface ImportReportCounts {
  total?: number;
  valid?: number;
  error?: number;
  dup_file?: number;
  dup_base?: number;
  update?: number;
  nochange?: number;
  selected?: number;
  imported?: number;
  updated?: number;
  skipped?: number;
}

export interface ImportReportPayload {
  kind: ImportKind;
  fileName?: string | null;
  user?: string | null;
  createdAt?: string | Date;
  counts: ImportReportCounts;
  items: ReviewItem[];
  /** Índices (relativos a items) que foram efetivamente enviados */
  selectedLines?: number[];
}

const FOOTER = 'Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba';

const KIND_LABEL: Record<ImportKind, string> = {
  efetivo: 'Professores Efetivos',
  contratado: 'Professores Contratados',
};

const COUNT_LABELS: [keyof ImportReportCounts, string][] = [
  ['total', 'Total de linhas'],
  ['valid', 'Válidas (novos)'],
  ['update', 'Atualizações'],
  ['nochange', 'Sem alterações'],
  ['dup_file', 'Duplicadas no arquivo'],
  ['dup_base', 'Duplicadas na base'],
  ['error', 'Com erro'],
  ['selected', 'Selecionadas para envio'],
  ['imported', 'Importadas'],
  ['updated', 'Atualizadas'],
  ['skipped', 'Ignoradas pelo servidor'],
];

const fmtDate = (d?: string | Date) => {
  const date = d ? new Date(d) : new Date();
  return date.toLocaleString('pt-BR');
};

const idOf = (it: ReviewItem) => {
  const d = it.data || {};
  const nome = d.nome || d.name || '—';
  const cpf = d.cpf ? ` / CPF ${d.cpf}` : '';
  const mat = d.matricula ? ` / Mat. ${d.matricula}` : '';
  return `${nome}${cpf}${mat}`;
};

export const buildReportFileName = (kind: ImportKind, createdAt?: string | Date) => {
  const d = createdAt ? new Date(createdAt) : new Date();
  const stamp = d.toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `relatorio-importacao-${kind}-${stamp}.pdf`;
};

export function generateImportReportPdf(payload: ImportReportPayload): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;
  const maxW = pageW - M * 2;
  let y = M;

  const footer = () => {
    const page = doc.getNumberOfPages();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(FOOTER, M, pageH - 20);
    doc.text(`Página ${page}`, pageW - M, pageH - 20, { align: 'right' });
    doc.setTextColor(0);
  };

  const ensure = (needed = 16) => {
    if (y + needed > pageH - 40) {
      footer();
      doc.addPage();
      y = M;
    }
  };

  const line = (text: string, opts?: { size?: number; bold?: boolean; indent?: number; color?: number }) => {
    const size = opts?.size ?? 9;
    doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(opts?.color ?? 0);
    const indent = opts?.indent ?? 0;
    const parts = doc.splitTextToSize(text, maxW - indent);
    for (const p of parts) {
      ensure(size + 4);
      doc.text(p, M + indent, y);
      y += size + 3;
    }
    doc.setTextColor(0);
  };

  const heading = (text: string) => {
    ensure(30);
    y += 8;
    doc.setFillColor(29, 78, 216);
    doc.rect(M, y - 10, maxW, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(text, M + 5, y + 1);
    doc.setTextColor(0);
    y += 18;
  };

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Relatório de Importação', M, y);
  y += 18;
  doc.setFontSize(11);
  doc.text(KIND_LABEL[payload.kind], M, y);
  y += 16;
  line(`Data/hora: ${fmtDate(payload.createdAt)}`);
  line(`Arquivo: ${payload.fileName || '—'}`);
  line(`Executado por: ${payload.user || '—'}`);

  // Resumo
  heading('Resumo');
  const c = payload.counts || {};
  for (const [key, label] of COUNT_LABELS) {
    const v = c[key];
    if (v === undefined || v === null) continue;
    ensure(14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, M + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(v), M + 220, y);
    y += 13;
  }

  const items = payload.items || [];
  const sent = new Set(payload.selectedLines || []);
  const byStatus = (s: ReviewStatus) => items.filter((i) => i.status === s);
  const sentTag = (it: ReviewItem) =>
    payload.selectedLines ? (sent.has(it.line) ? ' [enviada]' : ' [não enviada]') : '';

  // 1. Atualizações
  const updates = [...byStatus('update'), ...byStatus('dup_base').filter((i) => (i.diffs || []).length > 0)];
  heading(`Linhas atualizadas (${updates.length})`);
  if (!updates.length) {
    line('Nenhuma linha com alteração de dados.', { color: 120 });
  } else {
    for (const it of updates) {
      ensure(30);
      line(`Linha ${it.line} — ${idOf(it)}${sentTag(it)}`, { bold: true });
      for (const d of it.diffs || []) {
        ensure(13);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const label = doc.splitTextToSize(d.label || d.field, 110)[0];
        doc.text(label, M + 12, y);
        doc.setTextColor(150, 80, 0);
        doc.text(`Atual: ${d.current || '—'}`, M + 140, y);
        doc.setTextColor(29, 78, 216);
        doc.text(`Novo: ${d.incoming || '—'}`, M + 320, y);
        doc.setTextColor(0);
        y += 12;
      }
      y += 3;
    }
  }

  // 2. Duplicadas
  const dupFile = byStatus('dup_file');
  const dupBase = byStatus('dup_base').filter((i) => !(i.diffs || []).length);
  heading(`Linhas descartadas como duplicadas (${dupFile.length + dupBase.length})`);
  const dupBlock = (title: string, rows: ReviewItem[]) => {
    line(title, { bold: true, size: 9.5 });
    if (!rows.length) {
      line('Nenhuma.', { indent: 12, color: 120 });
      return;
    }
    for (const it of rows) {
      line(`Linha ${it.line} — ${idOf(it)}`, { indent: 12 });
      if (it.reason) line(`Motivo: ${it.reason}`, { indent: 24, size: 8, color: 110 });
    }
    y += 4;
  };
  dupBlock('Duplicada no arquivo', dupFile);
  dupBlock('Duplicada na base (sem alterações)', dupBase);

  // 3. Erros
  const errors = byStatus('error');
  heading(`Linhas com erro (${errors.length})`);
  if (!errors.length) line('Nenhuma.', { color: 120 });
  else
    for (const it of errors) {
      line(`Linha ${it.line} — ${idOf(it)}`, { indent: 4 });
      if (it.reason) line(`Motivo: ${it.reason}`, { indent: 16, size: 8, color: 110 });
    }

  // 4. Sem alterações
  const noChange = byStatus('nochange');
  heading(`Linhas sem alterações (${noChange.length})`);
  if (!noChange.length) line('Nenhuma.', { color: 120 });
  else for (const it of noChange) line(`Linha ${it.line} — ${idOf(it)}`, { indent: 4, size: 8.5 });

  // 5. Novos registros
  const news = byStatus('valid');
  heading(`Novos registros (${news.length})`);
  if (!news.length) line('Nenhum.', { color: 120 });
  else for (const it of news) line(`Linha ${it.line} — ${idOf(it)}${sentTag(it)}`, { indent: 4, size: 8.5 });

  footer();
  return doc;
}

export function downloadImportReportPdf(payload: ImportReportPayload) {
  const doc = generateImportReportPdf(payload);
  doc.save(buildReportFileName(payload.kind, payload.createdAt));
}
