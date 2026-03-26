import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ReuniaoComDetalhes } from '@/hooks/useReunioes';

interface ConsultorInfo {
  nome: string;
  email?: string | null;
  ativo: boolean;
}

const criterioLabels: Record<string, string> = {
  empatia: 'Empatia e Escuta Ativa',
  clareza: 'Clareza na Comunicação',
  proatividade: 'Proatividade',
  dominio_tecnico: 'Domínio Técnico',
  orientacao_resultados: 'Orientação para Resultados',
};

function getScoreRGB(score: number): [number, number, number] {
  if (score >= 8) return [34, 197, 94];
  if (score >= 6) return [234, 179, 8];
  return [239, 68, 68];
}

function addNewPageIfNeeded(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 270) {
    doc.addPage();
    return 20;
  }
  return y;
}

function loadImageAsBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function gerarRelatorioPDF(
  consultor: ConsultorInfo,
  reunioes: ReuniaoComDetalhes[],
  scoreMedio: number | null,
) {
  const analisadas = reunioes.filter(r => r.status_analise === 'concluido' && r.analise_ia);

  if (analisadas.length === 0) return;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Load logo
  let logoBase64: string | null = null;
  try {
    logoBase64 = await loadImageAsBase64('/cupola-logo.png');
  } catch {
    // logo not available, continue without
  }

  // --- HEADER ---
  doc.setFillColor(30, 30, 40);
  doc.rect(0, 0, pageWidth, 45, 'F');

  let headerTextX = 14;
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 14, 8, 30, 30);
    headerTextX = 50;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Desempenho', headerTextX, 20);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(consultor.nome, headerTextX, 30);

  doc.setFontSize(9);
  doc.text(
    `Gerado em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
    headerTextX,
    38,
  );

  // --- RESUMO GERAL ---
  let y = 58;
  doc.setTextColor(30, 30, 40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Geral', 14, y);
  y += 10;

  // Score card
  doc.setFillColor(245, 245, 250);
  doc.roundedRect(14, y, pageWidth - 28, 30, 3, 3, 'F');

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  if (scoreMedio !== null) {
    const [r, g, b] = getScoreRGB(scoreMedio);
    doc.setTextColor(r, g, b);
    doc.text(scoreMedio.toFixed(1), 24, y + 21);
  } else {
    doc.setTextColor(150, 150, 150);
    doc.text('—', 24, y + 21);
  }

  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Score Médio', 60, y + 14);
  doc.text(`${analisadas.length} reunião(ões) analisada(s)`, 60, y + 22);

  y += 38;

  // --- MÉDIA POR CRITÉRIO ---
  const criterioKeys = Object.keys(criterioLabels);
  const medias: Record<string, number> = {};
  for (const key of criterioKeys) {
    const values = analisadas
      .map(r => Number((r.analise_ia as Record<string, any>)?.[key]) || 0)
      .filter(v => v > 0);
    medias[key] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  doc.setTextColor(30, 30, 40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Média por Critério', 14, y);
  y += 8;

  for (const key of criterioKeys) {
    const nota = medias[key];
    const [r, g, b] = getScoreRGB(nota);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(criterioLabels[key], 14, y + 4);

    const barX = 100;
    const barW = 70;
    const barH = 5;
    doc.setFillColor(230, 230, 235);
    doc.roundedRect(barX, y, barW, barH, 2, 2, 'F');

    doc.setFillColor(r, g, b);
    const fillW = Math.max(1, (nota / 10) * barW);
    doc.roundedRect(barX, y, fillW, barH, 2, 2, 'F');

    doc.setTextColor(r, g, b);
    doc.setFont('helvetica', 'bold');
    doc.text(nota.toFixed(1), barX + barW + 5, y + 4);

    y += 10;
  }

  y += 8;

  // --- GRÁFICO DE EVOLUÇÃO DO SCORE ---
  const reunioesOrdenadas = [...analisadas]
    .filter(r => r.score_ia != null)
    .sort((a, b) => new Date(a.data_reuniao).getTime() - new Date(b.data_reuniao).getTime());

  if (reunioesOrdenadas.length >= 2) {
    y = addNewPageIfNeeded(doc, y, 80);

    doc.setTextColor(30, 30, 40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Evolução do Score', 14, y);
    y += 8;

    const chartX = 30;
    const chartY = y;
    const chartW = pageWidth - 60;
    const chartH = 50;

    // Background
    doc.setFillColor(248, 248, 252);
    doc.roundedRect(chartX - 2, chartY - 2, chartW + 4, chartH + 4, 2, 2, 'F');

    // Grid lines
    doc.setDrawColor(220, 220, 225);
    doc.setLineWidth(0.2);
    for (let s = 0; s <= 10; s += 2) {
      const gy = chartY + chartH - (s / 10) * chartH;
      doc.line(chartX, gy, chartX + chartW, gy);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.setFont('helvetica', 'normal');
      doc.text(String(s), chartX - 8, gy + 2);
    }

    // Plot points and lines
    const points = reunioesOrdenadas.map((r, i) => ({
      x: chartX + (i / (reunioesOrdenadas.length - 1)) * chartW,
      y: chartY + chartH - ((r.score_ia! / 10) * chartH),
      score: r.score_ia!,
      date: format(parseISO(r.data_reuniao), 'dd/MM/yy'),
    }));

    // Lines
    doc.setLineWidth(0.8);
    for (let i = 1; i < points.length; i++) {
      const [r, g, b] = getScoreRGB(points[i].score);
      doc.setDrawColor(r, g, b);
      doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }

    // Points and labels
    for (const p of points) {
      const [r, g, b] = getScoreRGB(p.score);
      doc.setFillColor(r, g, b);
      doc.circle(p.x, p.y, 1.5, 'F');

      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      doc.text(p.date, p.x - 6, chartY + chartH + 6);

      doc.setTextColor(r, g, b);
      doc.setFont('helvetica', 'bold');
      doc.text(p.score.toFixed(1), p.x - 3, p.y - 3);
    }

    y = chartY + chartH + 14;
  }

  y += 4;

  // --- DETALHAMENTO POR REUNIÃO ---
  doc.setTextColor(30, 30, 40);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  y = addNewPageIfNeeded(doc, y, 20);
  doc.text('Detalhamento por Reunião', 14, y);
  y += 10;

  for (let i = 0; i < analisadas.length; i++) {
    const r = analisadas[i];
    const analise = r.analise_ia as Record<string, any>;
    const pontosFortes: string[] = analise?.pontos_fortes || [];
    const pontosMelhoria: string[] = analise?.pontos_melhoria || [];
    const resumo: string = r.resumo_ia || '';

    const blockHeight = 40 + criterioKeys.length * 8 + pontosFortes.length * 6 + pontosMelhoria.length * 6 + 20;
    y = addNewPageIfNeeded(doc, y, Math.min(blockHeight, 100));

    // Reunion header
    doc.setFillColor(240, 240, 248);
    doc.roundedRect(14, y, pageWidth - 28, 14, 2, 2, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 40);
    doc.text(
      `${r.clientes?.nome || 'Cliente'} — ${format(parseISO(r.data_reuniao), "dd/MM/yyyy")}`,
      18,
      y + 9,
    );

    if (r.score_ia != null) {
      const [sr, sg, sb] = getScoreRGB(r.score_ia);
      doc.setTextColor(sr, sg, sb);
      doc.text(`Score: ${r.score_ia.toFixed(1)}`, pageWidth - 50, y + 9);
    }

    y += 18;

    // Resumo da reunião
    if (resumo) {
      y = addNewPageIfNeeded(doc, y, 16);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60, 60, 100);
      doc.text('Resumo:', 18, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(8);
      const resumoLines = doc.splitTextToSize(resumo, pageWidth - 44);
      for (const line of resumoLines) {
        y = addNewPageIfNeeded(doc, y, 5);
        doc.text(line, 22, y);
        y += 4;
      }
      y += 4;
    }

    // Criteria for this meeting
    for (const key of criterioKeys) {
      const nota = Number(analise?.[key]) || 0;
      const [cr, cg, cb] = getScoreRGB(nota);

      y = addNewPageIfNeeded(doc, y, 8);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(criterioLabels[key], 18, y + 3);

      doc.setTextColor(cr, cg, cb);
      doc.setFont('helvetica', 'bold');
      doc.text(nota.toFixed(1), 100, y + 3);

      y += 7;
    }

    y += 4;

    // Pontos fortes
    if (pontosFortes.length > 0) {
      y = addNewPageIfNeeded(doc, y, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text('Pontos Fortes:', 18, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      for (const p of pontosFortes) {
        y = addNewPageIfNeeded(doc, y, 6);
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(`• ${p}`, pageWidth - 40);
        doc.text(lines, 22, y);
        y += lines.length * 4.5;
      }
      y += 2;
    }

    // Pontos de melhoria
    if (pontosMelhoria.length > 0) {
      y = addNewPageIfNeeded(doc, y, 12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(234, 179, 8);
      doc.text('Pontos de Melhoria:', 18, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      for (const p of pontosMelhoria) {
        y = addNewPageIfNeeded(doc, y, 6);
        doc.setFontSize(8);
        const lines = doc.splitTextToSize(`• ${p}`, pageWidth - 40);
        doc.text(lines, 22, y);
        y += lines.length * 4.5;
      }
      y += 2;
    }

    // Separator
    if (i < analisadas.length - 1) {
      y += 4;
      y = addNewPageIfNeeded(doc, y, 10);
      doc.setDrawColor(220, 220, 225);
      doc.line(14, y, pageWidth - 14, y);
      y += 8;
    }
  }

  // Download
  const filename = `relatorio-${consultor.nome.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
