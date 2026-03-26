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
  if (score >= 8) return [34, 197, 94];    // green
  if (score >= 6) return [234, 179, 8];    // yellow
  return [239, 68, 68];                     // red
}

function addNewPageIfNeeded(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 270) {
    doc.addPage();
    return 20;
  }
  return y;
}

export function gerarRelatorioPDF(
  consultor: ConsultorInfo,
  reunioes: ReuniaoComDetalhes[],
  scoreMedio: number | null,
) {
  const analisadas = reunioes.filter(r => r.status_analise === 'concluido' && r.analise_ia);

  if (analisadas.length === 0) return;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- HEADER ---
  doc.setFillColor(30, 30, 40);
  doc.rect(0, 0, pageWidth, 45, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Desempenho', 14, 20);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(consultor.nome, 14, 30);

  doc.setFontSize(9);
  doc.text(
    `Gerado em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`,
    14,
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

    // Bar background
    const barX = 100;
    const barW = 70;
    const barH = 5;
    doc.setFillColor(230, 230, 235);
    doc.roundedRect(barX, y, barW, barH, 2, 2, 'F');

    // Bar fill
    doc.setFillColor(r, g, b);
    const fillW = Math.max(1, (nota / 10) * barW);
    doc.roundedRect(barX, y, fillW, barH, 2, 2, 'F');

    // Score text
    doc.setTextColor(r, g, b);
    doc.setFont('helvetica', 'bold');
    doc.text(nota.toFixed(1), barX + barW + 5, y + 4);

    y += 10;
  }

  y += 8;

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
