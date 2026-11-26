import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { calculateAge, formatDate } from "@/lib/format";
import type { getPrescriptionById } from "@/server/prescriptions/queries";
import type { getClinicSettings } from "@/server/settings/queries";

type Prescription = NonNullable<Awaited<ReturnType<typeof getPrescriptionById>>>;
type Clinic = Awaited<ReturnType<typeof getClinicSettings>>;

const styles = StyleSheet.create({
  page: { padding: 40, paddingBottom: 60, fontSize: 10, color: "#171717", fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingBottom: 16, borderBottom: "1 solid #e5e5e5" },
  clinicName: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  muted: { color: "#737373", fontSize: 9 },
  docLabel: { fontSize: 12, fontWeight: 700, textTransform: "uppercase" },
  section: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  label: { fontSize: 8, color: "#a3a3a3", textTransform: "uppercase", marginBottom: 3 },
  value: { fontSize: 10, fontWeight: 700, marginBottom: 2 },
  rxMark: { fontSize: 20, fontWeight: 700, marginBottom: 10 },
  table: { marginBottom: 20 },
  tableHeaderRow: { flexDirection: "row", borderBottom: "1 solid #d4d4d4", paddingBottom: 6, marginBottom: 6 },
  tableRow: { flexDirection: "row", paddingVertical: 6, borderBottom: "1 solid #f5f5f5" },
  th: { fontSize: 8, color: "#737373", textTransform: "uppercase" },
  colMed: { flex: 2 },
  colDosage: { flex: 1 },
  colFreq: { flex: 1 },
  colDuration: { flex: 1 },
  colInstr: { flex: 2 },
  signature: { marginTop: 60, alignSelf: "flex-end", width: 200, alignItems: "center" },
  signatureLine: { borderTop: "1 solid #a3a3a3", width: "100%", marginBottom: 4 },
  footer: { position: "absolute", bottom: 32, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#a3a3a3" },
});

export function PrescriptionPdf({ prescription, clinic }: { prescription: Prescription; clinic: Clinic }) {
  return (
    <Document title={`Prescription - ${prescription.patient.fullName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.clinicName}>{clinic.clinicName}</Text>
            {clinic.address && <Text style={styles.muted}>{clinic.address}</Text>}
            <Text style={styles.muted}>{[clinic.phone, clinic.email, clinic.website].filter(Boolean).join("  ·  ")}</Text>
          </View>
          <Text style={styles.docLabel}>Prescription</Text>
        </View>

        <View style={styles.section}>
          <View>
            <Text style={styles.label}>Patient</Text>
            <Text style={styles.value}>{prescription.patient.fullName}</Text>
            <Text style={styles.muted}>
              {prescription.patient.patientCode} · {calculateAge(prescription.patient.dob)} yrs · {prescription.patient.phone}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.label}>Prescribed By</Text>
            <Text style={styles.value}>{prescription.dentist.name}</Text>
            <Text style={styles.muted}>{formatDate(prescription.date)}</Text>
          </View>
        </View>

        <Text style={styles.rxMark}>Rx</Text>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colMed]}>Medicine</Text>
            <Text style={[styles.th, styles.colDosage]}>Dosage</Text>
            <Text style={[styles.th, styles.colFreq]}>Frequency</Text>
            <Text style={[styles.th, styles.colDuration]}>Duration</Text>
            <Text style={[styles.th, styles.colInstr]}>Instructions</Text>
          </View>
          {prescription.medicines.map((m) => (
            <View key={m.id} style={styles.tableRow} wrap={false}>
              <Text style={styles.colMed}>{m.medicineName}</Text>
              <Text style={styles.colDosage}>{[m.dosage,m.route].filter(Boolean).join(" · ")}</Text>
              <Text style={styles.colFreq}>{m.frequency}</Text>
              <Text style={styles.colDuration}>{m.duration}</Text>
              <Text style={styles.colInstr}>{m.instructions || "—"}</Text>
            </View>
          ))}
        </View>

        {prescription.instructions && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.label}>General Instructions</Text>
            <Text>{prescription.instructions}</Text>
          </View>
        )}

        <View style={styles.signature} wrap={false}>
          <View style={styles.signatureLine} />
          <Text style={styles.muted}>{prescription.dentist.name} — Signature</Text>
        </View>

        <Text style={styles.footer} fixed render={({pageNumber,totalPages})=>`${clinic.clinicName} · ${prescription.patient.patientCode} · Page ${pageNumber} of ${totalPages}`}/>
      </Page>
    </Document>
  );
}
