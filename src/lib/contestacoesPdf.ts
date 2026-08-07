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

const COLS: { key: keyof ContestacaoRow; label: string; weight: number; min: number }[] = [
  { key: 'protocolo', label: 'Protocolo', weight: 74, min: 66 },
  { key: 'matricula', label: 'Matrícula', weight: 46, min: 42 },
  { key: 'nome', label: 'Nome', weight: 132, min: 100 },
  { key: 'vinculo', label: 'Vínculo', weight: 50, min: 44 },
  { key: 'motivo', label: 'Motivo', weight: 88, min: 70 },
  { key: 'descricao', label: 'Descrição', weight: 165, min: 120 },
  { key: 'whatsapp', label: 'WhatsApp', weight: 72, min: 64 },
  { key: 'anexo', label: 'Anexo II', weight: 82, min: 60 },
  { key: 'status', label: 'Status', weight: 46, min: 40 },
  { key: 'data', label: 'Data', weight: 62, min: 58 },
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

  // Larguras responsivas: escala proporcional para caber exatamente na área útil
  const usable = pageW - M * 2;
  const totalWeight = COLS.reduce((s, c) => s + c.weight, 0);
  const scale = usable / totalWeight;
  const widths = COLS.map((c) => Math.max(c.min, c.weight * scale));
  const sumWidths = widths.reduce((s, w) => s + w, 0);
  if (sumWidths > usable) {
    // reduz proporcionalmente o excedente respeitando o mínimo global
    const factor = usable / sumWidths;
    for (let i = 0; i < widths.length; i++) widths[i] *= factor;
  }

  const xs: number[] = [];
  let acc = M;
  widths.forEach((w) => { xs.push(acc); acc += w; });
  const tableRight = acc;


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

  const fmt = (key: keyof ContestacaoRow, v: unknown) => {
    const s = v == null || v === '' ? '—' : String(v);
    if (key !== 'data' || s === '—') return s;
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  let zebra = false;
  for (const r of rows) {
    const cells = COLS.map((c, i) => doc.splitTextToSize(fmt(c.key, r[c.key]), widths[i] - 6));
    const rowH = Math.max(...cells.map((c) => c.length)) * 8 + 6;
    if (y + rowH > pageH - 26) {
      footer();
      doc.addPage();
      y = M;
      header();
    }
    if (zebra) {
      doc.setFillColor(246, 248, 252);
      doc.rect(M, y, tableRight - M, rowH, 'F');
    }
    zebra = !zebra;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    cells.forEach((cell, i) => {
      cell.forEach((part: string, j: number) => doc.text(part, xs[i] + 3, y + 9 + j * 8));
    });
    doc.setDrawColor(224);
    doc.line(M, y + rowH, tableRight, y + rowH);
    // bordas verticais
    [...xs, tableRight].forEach((x) => doc.line(x, y, x, y + rowH));
    y += rowH;
  }


  footer();
  return doc;
}

export function downloadContestacoesPdf(rows: ContestacaoRow[]) {
  const doc = generateContestacoesPdf(rows);
  doc.save(`contestacoes_${new Date().toISOString().split('T')[0]}.pdf`);
}
