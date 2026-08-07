import jsPDF from 'jspdf';

export interface ContestacaoRow {
  protocolo?: string | null;
  matricula?: string | null;
  nome?: string | null;
  vinculo?: string | null;
  motivo?: string | null;
  descricao?: string | null;
  whatsapp?: string | null;
  anexo?: string | null;
  status?: string | null;
  data?: string | null;
}

const FOOTER = 'Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba';

const COLS: { key: keyof ContestacaoRow; label: string; w: number }[] = [
  { key: 'protocolo', label: 'Protocolo', w: 78 },
  { key: 'matricula', label: 'Matrícula', w: 50 },
  { key: 'nome', label: 'Nome', w: 140 },
  { key: 'vinculo', label: 'Vínculo', w: 55 },
  { key: 'motivo', label: 'Motivo', w: 95 },
  { key: 'descricao', label: 'Descrição', w: 175 },
  { key: 'whatsapp', label: 'WhatsApp', w: 78 },
  { key: 'anexo', label: 'Anexo II', w: 90 },
  { key: 'status', label: 'Status', w: 50 },
  { key: 'data', label: 'Data', w: 55 },
];

export function generateContestacoesPdf(rows: ContestacaoRow[]): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 24;
  let y = M;

  const footer = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(FOOTER, M, pageH - 14);
    doc.text(`Página ${doc.getNumberOfPages()}`, pageW - M, pageH - 14, { align: 'right' });
    doc.setTextColor(0);
  };

  const xs: number[] = [];
  let acc = M;
  for (const c of COLS) { xs.push(acc); acc += c.w; }

  const header = () => {
    doc.setFillColor(29, 78, 216);
    doc.rect(M, y, acc - M, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    COLS.forEach((c, i) => doc.text(c.label, xs[i] + 3, y + 11));
    doc.setTextColor(0);
    y += 16;
  };

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Relatório de Contestações', M, y + 10);
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')} · Total: ${rows.length}`, M, y);
  doc.setTextColor(0);
  y += 12;

  header();

  let zebra = false;
  for (const r of rows) {
    const cells = COLS.map((c) => doc.splitTextToSize(String(r[c.key] ?? '—' ) || '—', c.w - 6));
    const rowH = Math.max(...cells.map((c) => c.length)) * 8 + 6;
    if (y + rowH > pageH - 26) {
      footer();
      doc.addPage();
      y = M;
      header();
    }
    if (zebra) {
      doc.setFillColor(246, 248, 252);
      doc.rect(M, y, acc - M, rowH, 'F');
    }
    zebra = !zebra;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    cells.forEach((cell, i) => {
      cell.forEach((part: string, j: number) => doc.text(part, xs[i] + 3, y + 9 + j * 8));
    });
    doc.setDrawColor(224);
    doc.line(M, y + rowH, acc, y + rowH);
    y += rowH;
  }

  footer();
  return doc;
}

export function downloadContestacoesPdf(rows: ContestacaoRow[]) {
  const doc = generateContestacoesPdf(rows);
  doc.save(`contestacoes_${new Date().toISOString().split('T')[0]}.pdf`);
}
