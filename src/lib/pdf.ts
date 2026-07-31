import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { Estimate, Invoice, Settings } from './types';
import { money, formatDate } from './format';

// Wire up the bundled Roboto fonts (works across pdfmake 0.2.x layouts).
(pdfMake as any).vfs =
  (pdfFonts as any)?.vfs ?? (pdfFonts as any)?.pdfMake?.vfs ?? pdfFonts;

const BRAND = '#0f766e';
const MUTED = '#64748b';
const LINE = '#e5e9f0';

function itemRows(
  items: { description: string; quantity: number; rate: number }[],
  currency: string,
) {
  const header = [
    { text: 'Description', style: 'th' },
    { text: 'Qty', style: 'th', alignment: 'right' },
    { text: 'Rate', style: 'th', alignment: 'right' },
    { text: 'Amount', style: 'th', alignment: 'right' },
  ];
  const body = items.map((it) => [
    { text: it.description || '—', margin: [0, 3, 0, 3] as [number, number, number, number] },
    { text: String(it.quantity), alignment: 'right' },
    { text: money(it.rate, currency), alignment: 'right' },
    { text: money(it.quantity * it.rate, currency), alignment: 'right' },
  ]);
  return [header, ...body];
}

function totalsColumn(
  doc: Invoice | Estimate,
  currency: string,
  isInvoice: boolean,
) {
  const rows: any[] = [
    tRow('Subtotal', money(doc.subtotal, currency)),
  ];
  if (doc.discount > 0)
    rows.push(tRow('Discount', `− ${money(doc.discount, currency)}`));
  rows.push(tRow(`Tax (${doc.tax_rate}%)`, money(doc.tax, currency)));
  rows.push({
    columns: [
      { text: 'Total', bold: true, fontSize: 13 },
      {
        text: money(doc.total, currency),
        alignment: 'right',
        bold: true,
        fontSize: 13,
        color: BRAND,
      },
    ],
    margin: [0, 8, 0, 0],
  });
  if (isInvoice) {
    const inv = doc as Invoice;
    if (inv.paid > 0) {
      rows.push(tRow('Paid', `− ${money(inv.paid, currency)}`));
      rows.push({
        columns: [
          { text: 'Balance Due', bold: true },
          { text: money(inv.balance, currency), alignment: 'right', bold: true },
        ],
        margin: [0, 4, 0, 0],
      });
    }
  }
  return rows;
}

function tRow(label: string, value: string) {
  return {
    columns: [
      { text: label, color: MUTED },
      { text: value, alignment: 'right' },
    ],
    margin: [0, 2, 0, 2],
  };
}

function buildDefinition(
  kind: 'invoice' | 'estimate',
  doc: Invoice | Estimate,
  settings: Settings,
): TDocumentDefinitions {
  const isInvoice = kind === 'invoice';
  const currency = settings.currency;
  const client = doc.client;
  const title = isInvoice ? 'INVOICE' : 'ESTIMATE';
  const dateLabel = isInvoice ? 'Due date' : 'Valid until';
  const dateValue = isInvoice
    ? (doc as Invoice).due_date
    : (doc as Estimate).expiry_date;

  // pdfmake's types demand literal unions for alignment/margins; building the
  // definition loosely and casting keeps the content readable.
  const definition: any = {
    pageSize: 'LETTER',
    pageMargins: [48, 48, 48, 60],
    defaultStyle: { fontSize: 10, color: '#1a2230', lineHeight: 1.15 },
    styles: {
      th: {
        bold: true,
        fontSize: 8,
        color: MUTED,
        characterSpacing: 0.5,
      },
      label: { bold: true, fontSize: 8, color: '#94a3b8', characterSpacing: 0.5 },
    },
    content: [
      {
        columns: [
          [
            { text: settings.business_name, fontSize: 16, bold: true },
            {
              text: [
                settings.address,
                settings.email,
                settings.phone,
                settings.website,
              ]
                .filter(Boolean)
                .join('\n'),
              color: MUTED,
              fontSize: 9,
              margin: [0, 4, 0, 0],
            },
          ],
          [
            {
              text: title,
              fontSize: 26,
              bold: true,
              color: BRAND,
              alignment: 'right',
            },
            {
              text: doc.number,
              alignment: 'right',
              color: MUTED,
              margin: [0, 2, 0, 0],
            },
          ],
        ],
      },
      { text: '', margin: [0, 14, 0, 0] },
      {
        columns: [
          [
            { text: 'BILL TO', style: 'label', margin: [0, 0, 0, 4] },
            { text: client?.name ?? '—', bold: true },
            {
              text: [client?.company, client?.address, client?.email]
                .filter(Boolean)
                .join('\n'),
              color: MUTED,
              fontSize: 9,
              margin: [0, 2, 0, 0],
            },
          ],
          {
            width: 200,
            stack: [
              {
                columns: [
                  { text: 'Issue date', color: MUTED, fontSize: 9 },
                  {
                    text: formatDate(doc.issue_date),
                    alignment: 'right',
                    fontSize: 9,
                  },
                ],
                margin: [0, 0, 0, 3],
              },
              {
                columns: [
                  { text: dateLabel, color: MUTED, fontSize: 9 },
                  { text: formatDate(dateValue), alignment: 'right', fontSize: 9 },
                ],
                margin: [0, 0, 0, 3],
              },
              {
                columns: [
                  { text: 'Status', color: MUTED, fontSize: 9 },
                  {
                    text: doc.status.toUpperCase(),
                    alignment: 'right',
                    fontSize: 9,
                    bold: true,
                    color: BRAND,
                  },
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 20],
      },
      {
        table: {
          headerRows: 1,
          widths: ['*', 45, 70, 80],
          body: itemRows(doc.items, currency),
        },
        layout: {
          hLineWidth: (i: number, node: any) =>
            i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5,
          hLineColor: (i: number) => (i === 1 ? '#d3dae5' : LINE),
          vLineWidth: () => 0,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
      },
      {
        columns: [
          { text: '', width: '*' },
          { width: 230, stack: totalsColumn(doc, currency, isInvoice) },
        ],
        margin: [0, 14, 0, 0],
      },
      ...(doc.notes
        ? [
            { text: 'NOTES', style: 'label', margin: [0, 30, 0, 4] },
            { text: doc.notes, color: MUTED, fontSize: 9 },
          ]
        : []),
      ...(settings.footer
        ? [
            {
              text: settings.footer,
              color: MUTED,
              fontSize: 9,
              alignment: 'center',
              margin: [0, 40, 0, 0],
            },
          ]
        : []),
    ],
  };
  return definition as TDocumentDefinitions;
}

export function downloadDocumentPdf(
  kind: 'invoice' | 'estimate',
  doc: Invoice | Estimate,
  settings: Settings,
) {
  const dd = buildDefinition(kind, doc, settings);
  (pdfMake as any).createPdf(dd).download(`${doc.number}.pdf`);
}
