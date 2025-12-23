// Utilitário para exportação de dados

// Exportar para CSV (abre como Excel)
export function exportToCSV(data: any[], filename: string, columns: { key: string; label: string }[]) {
  if (data.length === 0) {
    alert('Nenhum dado para exportar');
    return;
  }

  // Cabeçalho
  const header = columns.map(col => col.label).join(';');
  
  // Linhas de dados
  const rows = data.map(item => 
    columns.map(col => {
      let value = item[col.key];
      // Formatar valores
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') return value.toString().replace('.', ',');
      if (value instanceof Date) return value.toLocaleDateString('pt-BR');
      if (typeof value === 'string' && value.includes('T')) {
        // Tentar formatar como data
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date.toLocaleDateString('pt-BR');
      }
      return String(value).replace(/;/g, ',');
    }).join(';')
  );

  const csv = [header, ...rows].join('\n');
  
  // BOM para UTF-8 (Excel reconhecer acentos)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  
  downloadBlob(blob, `${filename}.csv`);
}

// Exportar para PDF (usando impressão do navegador)
export function exportToPDF(title: string, content: string) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Permita pop-ups para exportar PDF');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { color: #6366f1; border-bottom: 2px solid #6366f1; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #6366f1; color: white; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        .header { display: flex; justify-content: space-between; align-items: center; }
        .date { color: #666; font-size: 14px; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <span class="date">Gerado em: ${new Date().toLocaleString('pt-BR')}</span>
      </div>
      ${content}
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

// Gerar tabela HTML para PDF
export function generateTableHTML(data: any[], columns: { key: string; label: string }[]): string {
  if (data.length === 0) return '<p>Nenhum dado encontrado.</p>';

  const headerRow = columns.map(col => `<th>${col.label}</th>`).join('');
  
  const bodyRows = data.map(item => {
    const cells = columns.map(col => {
      let value = item[col.key];
      if (value === null || value === undefined) return '<td>-</td>';
      if (typeof value === 'number') {
        if (col.key.toLowerCase().includes('price') || col.key.toLowerCase().includes('value') || col.key.toLowerCase().includes('amount')) {
          return `<td>R$ ${value.toFixed(2).replace('.', ',')}</td>`;
        }
        return `<td>${value}</td>`;
      }
      if (typeof value === 'string' && value.includes('T')) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) return `<td>${date.toLocaleDateString('pt-BR')}</td>`;
      }
      return `<td>${value}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
