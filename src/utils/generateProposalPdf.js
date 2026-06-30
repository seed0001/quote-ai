import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateQuoteTotals } from './dataStore';

// Brand colors (terracotta accent + near-black ink), matching the app theme.
const ACCENT = [193, 84, 51];
const INK = [26, 26, 26];
const MUTED = [110, 110, 110];

const money = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v || 0);

// Per-item client-facing total: material + labor, marked up, times quantity.
// Mirrors the on-screen proposal preview (tax is applied once at the summary).
const itemTotal = (item, laborRate, markupPercent) => {
  const laborCost = (item.laborHours || 0) * laborRate;
  const direct = (item.materialCost || 0) + laborCost;
  const markedUp = direct * (1 + markupPercent / 100);
  return markedUp * (item.quantity || 0);
};

const imageFormat = (dataUrl) => {
  const mime = dataUrl.substring(dataUrl.indexOf('/') + 1, dataUrl.indexOf(';')).toUpperCase();
  return mime === 'JPG' ? 'JPEG' : mime; // PNG / JPEG / WEBP
};

const safeName = (str) => (str || 'proposal').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

// Generate and download a clean, branded client proposal PDF.
export function generateProposalPdf(project, client, settings) {
  const totals = calculateQuoteTotals(project, settings);
  const laborRate = project.laborRate || settings.defaultLaborRate || 85.0;
  const markupPercent = project.markupPercent !== undefined ? project.markupPercent : (settings.defaultMarkupPercent || 20.0);

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 48;
  const rightX = pageW - margin;
  let y = margin;

  // --- Header: logo / company (left) + proposal meta (right) ---
  let headerTextX = margin;
  if (settings.companyLogo) {
    try {
      doc.addImage(settings.companyLogo, imageFormat(settings.companyLogo), margin, y, 64, 64);
      headerTextX = margin + 78;
    } catch {
      headerTextX = margin;
    }
  }

  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK);
  doc.text((settings.companyName || 'Apex Remodeling').toUpperCase(), headerTextX, y + 16);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED);
  const companyLines = [
    ...(settings.address ? settings.address.split('\n') : []),
    settings.phone ? `Phone: ${settings.phone}` : null,
    settings.email ? `Email: ${settings.email}` : null
  ].filter(Boolean);
  doc.text(companyLines, headerTextX, y + 32);

  // Right meta block
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...ACCENT);
  doc.text('PROPOSAL', rightX, y + 14, { align: 'right' });
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...INK);
  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  doc.text([
    `Job ID: ${(project.id || '').toUpperCase()}`,
    `Date: ${new Date().toLocaleDateString()}`,
    `Valid Until: ${validUntil.toLocaleDateString()}`
  ], rightX, y + 30, { align: 'right' });

  y += 92;
  doc.setDrawColor(...INK).setLineWidth(1).line(margin, y, rightX, y);
  y += 20;

  // --- Prepared-for / project scope ---
  doc.setFont('helvetica', 'bold').setFontSize(8).setTextColor(...MUTED);
  doc.text('PREPARED FOR', margin, y);
  doc.text('PROJECT / SCOPE', pageW / 2, y);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...INK);
  const preparedFor = [
    client?.name || 'Client',
    client?.company || null,
    client?.address || null
  ].filter(Boolean);
  doc.text(preparedFor, margin, y + 15);
  const scopeBlock = [
    project.name || 'Remodel Project',
    project.startDate ? `Estimated Start: ${project.startDate}` : null
  ].filter(Boolean);
  doc.text(scopeBlock, pageW / 2, y + 15);

  y += 15 + Math.max(preparedFor.length, scopeBlock.length) * 13 + 14;

  // --- Room-by-room scope tables ---
  (project.rooms || []).forEach(room => {
    if (!room.items || room.items.length === 0) return;
    const body = room.items.map(item => [
      `${item.category ? item.category.toUpperCase() + '  ' : ''}${item.name}`,
      String(item.quantity ?? ''),
      item.unit || '',
      money(itemTotal(item, laborRate, markupPercent))
    ]);

    autoTable(doc, {
      startY: y,
      head: [[room.name, 'Qty', 'Unit', 'Total']],
      body,
      theme: 'striped',
      margin: { left: margin, right: margin },
      headStyles: { fillColor: ACCENT, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: INK },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { cellWidth: 50, halign: 'center' },
        2: { cellWidth: 55, halign: 'center', textColor: MUTED },
        3: { cellWidth: 90, halign: 'right' }
      }
    });
    y = doc.lastAutoTable.finalY + 18;
  });

  // --- Approved change orders ---
  const approvedCOs = (project.changeOrders || []).filter(co => co.status === 'approved');
  if (approvedCOs.length > 0) {
    const coBody = approvedCOs.map(co => {
      let mats = 0, hrs = 0;
      co.items.forEach(i => { mats += (i.materialCost || 0) * (i.quantity || 0); hrs += (i.laborHours || 0) * (i.quantity || 0); });
      const direct = mats + hrs * laborRate;
      const taxPct = project.taxPercent !== undefined ? project.taxPercent : (settings.defaultTaxPercent || 8.25);
      const coTotal = direct * (1 + markupPercent / 100) + mats * (taxPct / 100);
      return [`${co.title}${co.description ? '\n' + co.description : ''}`, money(coTotal)];
    });
    autoTable(doc, {
      startY: y,
      head: [['Approved Change Orders', 'Total']],
      body: coBody,
      theme: 'striped',
      margin: { left: margin, right: margin },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: INK },
      columnStyles: { 1: { cellWidth: 90, halign: 'right' } }
    });
    y = doc.lastAutoTable.finalY + 18;
  }

  // --- Pricing summary (right-aligned) ---
  const summaryRows = [['Base Remodel Proposal:', money(totals.baseTotal)]];
  if (totals.approvedChangeOrdersTotal > 0) {
    summaryRows.push(['Approved Change Orders:', '+ ' + money(totals.approvedChangeOrdersTotal)]);
  }
  autoTable(doc, {
    startY: y,
    body: summaryRows,
    theme: 'plain',
    margin: { left: pageW / 2, right: margin },
    bodyStyles: { fontSize: 10, textColor: INK },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' } }
  });
  y = doc.lastAutoTable.finalY + 4;

  doc.setDrawColor(...INK).setLineWidth(1).line(pageW / 2, y, rightX, y);
  y += 16;
  doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...INK);
  doc.text('Grand Total:', pageW / 2, y);
  doc.text(money(totals.netTotal), rightX, y, { align: 'right' });
  y += 12;
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
  doc.text('Includes all local materials sales tax.', rightX, y, { align: 'right' });
  y += 24;

  // --- Deposit + terms ---
  const deposit = parseFloat(settings.depositPercent);
  if (deposit > 0) {
    doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...INK);
    doc.text(`Deposit due on acceptance (${deposit}%): ${money(totals.netTotal * deposit / 100)}`, margin, y);
    y += 16;
  }
  if (settings.proposalTerms) {
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
    const terms = doc.splitTextToSize(settings.proposalTerms, pageW - 2 * margin);
    doc.text(terms, margin, y);
    y += terms.length * 11 + 8;
  }

  // --- Signatures ---
  y = Math.max(y, doc.internal.pageSize.getHeight() - 90);
  const sigW = (pageW - 2 * margin - 30) / 2;
  doc.setDrawColor(...INK).setLineWidth(0.5);
  doc.line(margin, y, margin + sigW, y);
  doc.line(rightX - sigW, y, rightX, y);
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...INK);
  doc.text(`${settings.companyName || 'Apex Remodeling'} Representative`, margin, y + 13);
  doc.text(`Client Acceptance (${client?.name || ''})`, rightX - sigW, y + 13);
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
  doc.text('Signature & Date', margin, y + 25);
  doc.text('Signature & Date', rightX - sigW, y + 25);

  doc.save(`Proposal_${safeName(project.name)}.pdf`);
}
