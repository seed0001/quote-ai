import jsPDF from 'jspdf';

// Brand colors matching the app theme
const ACCENT = [193, 84, 51];
const INK = [26, 26, 26];
const MUTED = [110, 110, 110];

const imageFormat = (dataUrl) => {
  const mime = dataUrl.substring(dataUrl.indexOf('/') + 1, dataUrl.indexOf(';')).toUpperCase();
  return mime === 'JPG' ? 'JPEG' : mime;
};

const safeName = (str) => (str || 'document').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

// Generate and download a clean, branded PDF from an Artifact
export function generateArtifactPdf(artifact, project, client, settings) {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const rightX = pageW - margin;
  let y = margin;

  // --- Header: logo / company (left) + document meta (right) ---
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
  doc.text((settings.companyName || 'MY BUSINESS').toUpperCase(), headerTextX, y + 16);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED);
  const companyLines = [
    ...(settings.address ? settings.address.split('\n') : []),
    settings.phone ? `Phone: ${settings.phone}` : null,
    settings.email ? `Email: ${settings.email}` : null
  ].filter(Boolean);
  doc.text(companyLines, headerTextX, y + 32);

  // Right meta block
  doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...ACCENT);
  // Truncate title if it's too long for the right side
  let displayTitle = artifact.title || 'DOCUMENT';
  if (displayTitle.length > 30) displayTitle = displayTitle.substring(0, 27) + '...';
  doc.text(displayTitle.toUpperCase(), rightX, y + 14, { align: 'right' });
  
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...INK);
  doc.text([
    `Project: ${project.name || 'N/A'}`,
    `Date: ${new Date(artifact.updatedAt || Date.now()).toLocaleDateString()}`,
    client?.name ? `Client: ${client.name}` : ''
  ].filter(Boolean), rightX, y + 30, { align: 'right' });

  y += 92;
  doc.setDrawColor(...INK).setLineWidth(1).line(margin, y, rightX, y);
  y += 30;

  // --- Document Sections ---
  if (!artifact.sections || artifact.sections.length === 0) {
    doc.setFont('helvetica', 'italic').setFontSize(12).setTextColor(...MUTED);
    doc.text('This document is empty.', margin, y);
  } else {
    artifact.sections.forEach(sec => {
      // Check if we need a page break before the heading
      if (y > pageH - margin - 40) {
        doc.addPage();
        y = margin;
      }

      // Heading
      if (sec.heading) {
        doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...INK);
        doc.text(sec.heading, margin, y);
        y += 18;
      }

      // Content
      if (sec.content) {
        doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...INK);
        // Split text to fit width
        const lines = doc.splitTextToSize(sec.content, pageW - (margin * 2));
        
        for (let i = 0; i < lines.length; i++) {
          if (y > pageH - margin - 20) {
            doc.addPage();
            y = margin;
          }
          doc.text(lines[i], margin, y);
          y += 14; // Line height
        }
        y += 16; // Extra space after paragraph
      }
    });
  }

  // --- Footer ---
  // Add page numbers
  const pageCount = doc.internal.getNumberOfPages();
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...MUTED);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, pageW / 2, pageH - 24, { align: 'center' });
  }

  doc.save(`Doc_${safeName(artifact.title)}.pdf`);
}
