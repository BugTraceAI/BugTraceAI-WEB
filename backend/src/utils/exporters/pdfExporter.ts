import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AnalysisReport } from '@prisma/client';

interface Vulnerability {
  vulnerability: string;
  severity: string;
  description: string;
  impact: string;
  recommendation: string;
}

export function exportToPdf(report: AnalysisReport): Buffer {
  const doc = new jsPDF();
  const vulns = report.vulnerabilities as unknown as Vulnerability[];

  // Title
  doc.setFontSize(20);
  doc.text('BugTraceAI Security Report', 14, 22);

  // Metadata
  doc.setFontSize(10);
  doc.text(`Target: ${report.target}`, 14, 35);
  doc.text(`Date: ${report.createdAt.toISOString().split('T')[0]}`, 14, 42);
  doc.text(`Type: ${report.analysisType}`, 14, 49);
  doc.text(`Total Findings: ${vulns.length}`, 14, 56);

  // Summary table by severity
  const severityCounts = vulns.reduce(
    (acc, v) => {
      acc[v.severity] = (acc[v.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  (autoTable as any)(doc, {
    startY: 65,
    head: [['Severity', 'Count']],
    body: Object.entries(severityCounts),
    theme: 'grid',
    headStyles: { fillColor: [75, 0, 130] },
  });

  // Vulnerability details
  let yPos = (doc as any).lastAutoTable.finalY + 15;

  vulns.forEach((v, i) => {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${i + 1}. ${v.vulnerability} [${v.severity}]`, 14, yPos);
    yPos += 7;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    const descLines = doc.splitTextToSize(v.description, 180);
    doc.text(descLines, 14, yPos);
    yPos += descLines.length * 5 + 5;

    const recLines = doc.splitTextToSize(`Recommendation: ${v.recommendation}`, 180);
    doc.text(recLines, 14, yPos);
    yPos += recLines.length * 5 + 10;
  });

  return Buffer.from(doc.output('arraybuffer'));
}
