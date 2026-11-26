import { Document, Page, Path, StyleSheet, Svg, Text, View, Image } from "@react-pdf/renderer";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { INVOICE_STATUS_LABEL } from "@/lib/labels";
import { TOOTH_PATH } from "@/components/brand/brand-logo";
import type { getInvoiceById } from "@/server/billing/queries";
import type { getClinicSettings } from "@/server/settings/queries";

type Invoice = NonNullable<Awaited<ReturnType<typeof getInvoiceById>>>;
type Clinic = Awaited<ReturnType<typeof getClinicSettings>>;

const NAVY = "#0b2a55";
const LINE = "#dbe6f1";
const PALE = "#f6faff";

const STATUS: Record<string, { bg: string; fg: string }> = {
  UNPAID: { bg: "#fde8ec", fg: "#be123c" },
  PARTIALLY_PAID: { bg: "#fef3c7", fg: "#92400e" },
  PAID: { bg: "#dcfce7", fg: "#047857" },
};

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40, fontSize: 10, color: "#0f172a", fontFamily: "Helvetica" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  clinicName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#073b7a" },
  muted: { fontSize: 8.5, color: "#64748b", marginTop: 2 },
  title: { fontSize: 26, fontFamily: "Helvetica-Bold", color: NAVY, textAlign: "right" },
  pill: { marginTop: 6, alignSelf: "flex-end", borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10, fontSize: 9.5, fontFamily: "Helvetica-Bold" },
  rule: { borderBottomWidth: 1, borderBottomColor: "#cfdcea", marginTop: 16, marginBottom: 16 },
  metaCell: { width: "33.33%", paddingRight: 12, minWidth: 0 },
  metaDivider: { borderLeftWidth: 1, borderLeftColor: LINE, paddingLeft: 12 },
  label: { fontSize: 9, color: "#64748b", marginBottom: 3 },
  metaValue: { fontSize: 12, color: NAVY },
  invNo: { fontSize: 16, fontFamily: "Helvetica-Bold", color: NAVY },
  people: { flexDirection: "row", marginTop: 16, borderWidth: 1, borderColor: LINE, borderRadius: 10, backgroundColor: PALE, padding: 14 },
  personName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY },
  body: { flexDirection: "row", marginTop: 20, gap: 14, alignItems: "flex-start" },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY, marginBottom: 8 },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 8 },
  thead: { flexDirection: "row", backgroundColor: "#e8f1fb", paddingVertical: 7, paddingHorizontal: 8 },
  th: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: NAVY },
  tr: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e6edf5" },
  cNo: { width: 18 },
  cDesc: { flex: 3 },
  cQty: { width: 28, textAlign: "center" },
  cPrice: { width: 62, textAlign: "right" },
  cAmt: { width: 66, textAlign: "right" },
  summary: { width: 190, borderWidth: 1, borderColor: LINE, borderRadius: 10, backgroundColor: "#f9fbfe", padding: 10 },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#e6edf5" },
  sumBox: { flexDirection: "row", justifyContent: "space-between", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, marginTop: 6 },
  notes: { marginTop: 20, borderWidth: 1, borderColor: LINE, borderRadius: 10, backgroundColor: PALE, padding: 12 },
  footer: { position: "absolute", left: 40, right: 40, bottom: 24, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#cfdcea", paddingTop: 8, fontSize: 8, color: "#64748b" },
});

/**
 * Downloadable A4 invoice (react-pdf). `logoSrc` is the clinic logo as a file path or data
 * the renderer can load; without it the DentalHub tooth mark is drawn.
 */
export function InvoicePdf({ invoice, clinic, logoSrc }: { invoice: Invoice; clinic: Clinic; logoSrc?: string | null }) {
  const money=(value:unknown)=>formatCurrency(value,clinic.currency);
  const total = Number(invoice.total);
  const paid = invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = invoice.voidedAt ? 0 : Math.max(0, Math.round((total - paid) * 100) / 100);
  const status = STATUS[invoice.status] ?? STATUS.UNPAID;
  const contact = [clinic.phone, clinic.email, clinic.website].filter(Boolean).join("  ·  ");
  const generated = formatDateTime(new Date());

  return (
    <Document title={`Invoice ${invoice.invoiceNumber}`} author={clinic.clinicName}>
      <Page size="A4" style={s.page}>
        <View style={s.between}>
          <View style={s.brand}>
            {logoSrc ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoSrc} style={{ width: 40, height: 40, objectFit: "contain" }} />
            ) : (
              <Svg viewBox="0 0 24 24" width={40} height={40}>
                <Path d={TOOTH_PATH} fill="#1aa6e0" />
              </Svg>
            )}
            <View>
              <Text style={s.clinicName}>{clinic.clinicName}</Text>
              {clinic.address ? <Text style={s.muted}>{clinic.address}</Text> : null}
              {contact ? <Text style={s.muted}>{contact}</Text> : null}
            </View>
          </View>
          <View>
            <Text style={s.title}>{invoice.voidedAt ? "VOIDED INVOICE" : "INVOICE"}</Text>
            <Text style={[s.pill, { backgroundColor: status.bg, color: status.fg }]}>{invoice.voidedAt ? "VOIDED" : INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}</Text>
          </View>
        </View>

        <View style={s.rule} />
        {invoice.voidedAt ? <Text>VOIDED {formatDateTime(invoice.voidedAt)}: {invoice.voidReason}</Text> : null}

        <View style={s.row}>
          <View style={s.metaCell}>
            <Text style={s.label}>Invoice #</Text>
            <Text style={s.invNo}>{invoice.invoiceNumber.match(/.{1,18}/g)?.join("\n")}</Text>
          </View>
          <View style={[s.metaCell, s.metaDivider]}>
            <Text style={s.label}>Invoice Date</Text>
            <Text style={s.metaValue}>{formatDate(invoice.date)}</Text>
          </View>
          <View style={[s.metaCell, s.metaDivider]}>
            <Text style={s.label}>Patient ID</Text>
            <Text style={s.metaValue}>{invoice.patient.patientCode.match(/.{1,22}/g)?.join("\n")}</Text>
          </View>
        </View>

        <View style={s.people}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={s.label}>Patient</Text>
            <Text style={s.personName}>{invoice.patient.fullName}</Text>
            <Text style={s.muted}>
              {invoice.patient.phone}
              {invoice.patient.email ? `  ·  ${invoice.patient.email}` : ""}
            </Text>
          </View>
          <View style={{ flex: 1, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: LINE }}>
            <Text style={s.label}>Doctor</Text>
            <Text style={s.personName}>{invoice.dentist?.name ?? "—"}</Text>
          </View>
        </View>

        <View style={s.body}>
          <View style={{ flex: 1 }}>
            <Text style={s.h2}>Line Items</Text>
            <View style={s.table}>
              <View style={s.thead}>
                <Text style={[s.th, s.cNo]}>#</Text>
                <Text style={[s.th, s.cDesc]}>Description</Text>
                <Text style={[s.th, s.cQty]}>Qty</Text>
                <Text style={[s.th, s.cPrice]}>Unit Price</Text>
                <Text style={[s.th, s.cAmt]}>Amount</Text>
              </View>
              {invoice.items.map((item, i) => (
                <View key={item.id} style={s.tr} wrap={false}>
                  <Text style={[s.cNo, { color: "#64748b" }]}>{i + 1}</Text>
                  <Text style={s.cDesc}>{item.description}</Text>
                  <Text style={s.cQty}>{item.quantity}</Text>
                  <Text style={s.cPrice}>{money(item.unitPrice)}</Text>
                  <Text style={[s.cAmt, { fontFamily: "Helvetica-Bold" }]}>{money(item.amount)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={s.summary} wrap={false}>
            <Text style={s.h2}>Invoice Summary</Text>
            <View style={s.sumRow}>
              <Text>Subtotal</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{money(invoice.subtotal)}</Text>
            </View>
            <View style={s.sumRow}>
              <Text>Discount</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>-{money(invoice.discount)}</Text>
            </View>
            <View style={[s.sumRow, { borderBottomWidth: 0 }]}>
              <Text>Tax</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>+{money(invoice.tax)}</Text>
            </View>
            <View style={[s.sumBox, { backgroundColor: "#e3effb" }]}>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY }}>Total</Text>
              <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: NAVY }}>{money(total)}</Text>
            </View>
            <View style={[s.sumBox, { backgroundColor: "#ecfdf5" }]}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: "#047857" }}>Paid</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", color: "#047857" }}>{money(paid)}</Text>
            </View>
            <View style={[s.sumBox, { backgroundColor: remaining > 0 ? "#fff1f2" : "#f1f5f9" }]}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: remaining > 0 ? "#be123c" : "#64748b" }}>Remaining</Text>
              <Text style={{ fontFamily: "Helvetica-Bold", color: remaining > 0 ? "#be123c" : "#64748b" }}>{money(remaining)}</Text>
            </View>
          </View>
        </View>

        <View style={s.notes} wrap={false}>
          <Text style={[s.h2, { marginBottom: 4 }]}>Notes</Text>
          <Text style={{ color: "#334155" }}>{invoice.notes || "No additional notes."}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={{flex:1,paddingRight:12}}>
            {invoice.voidedAt ? "VOIDED · " : ""}{invoice.invoiceNumber} · Generated on {generated} · {clinic.clinicName}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
