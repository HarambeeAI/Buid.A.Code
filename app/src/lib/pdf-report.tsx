import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// Types for report data
export interface ReportData {
  report_ref: string;
  document_name: string;
  page_count: number;
  region: string;
  selected_codes: string[];
  overall_status: "PASS" | "CONDITIONAL" | "FAIL" | null;
  compliance_score: number | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  project: {
    name: string;
  };
  summary: {
    total_findings: number;
    critical_count: number;
    warning_count: number;
    compliant_count: number;
    not_assessed_count: number;
    total_checks: number;
  };
  findings_by_category: Record<string, Finding[]>;
}

export interface Finding {
  id: string;
  code_reference: string;
  category: string;
  status: "COMPLIANT" | "WARNING" | "CRITICAL" | "NOT_ASSESSED";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  required_value: string;
  proposed_value: string | null;
  page_number: number | null;
  location: string | null;
  analysis_notes: string;
  recommendation: string | null;
}

// Styles
const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 50,
    lineHeight: 1.4,
  },
  // Cover page
  coverPage: {
    fontFamily: "Helvetica",
    paddingTop: 100,
    paddingHorizontal: 50,
    paddingBottom: 50,
  },
  logo: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1a56db",
    marginBottom: 40,
  },
  coverTitle: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#111827",
  },
  coverSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 40,
  },
  coverMeta: {
    fontSize: 12,
    marginBottom: 8,
    color: "#374151",
  },
  coverMetaLabel: {
    fontWeight: "bold",
    color: "#111827",
  },
  statusBadge: {
    marginTop: 30,
    padding: 12,
    borderRadius: 4,
    alignSelf: "flex-start",
  },
  statusPass: {
    backgroundColor: "#dcfce7",
  },
  statusConditional: {
    backgroundColor: "#fef3c7",
  },
  statusFail: {
    backgroundColor: "#fee2e2",
  },
  statusText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statusTextPass: {
    color: "#166534",
  },
  statusTextConditional: {
    color: "#92400e",
  },
  statusTextFail: {
    color: "#991b1b",
  },
  // Header & Footer
  header: {
    position: "absolute",
    top: 20,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 9,
    color: "#6b7280",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 8,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 50,
    right: 50,
    fontSize: 8,
    color: "#9ca3af",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  // Section styles
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    marginTop: 20,
    color: "#111827",
    borderBottomWidth: 2,
    borderBottomColor: "#1a56db",
    paddingBottom: 6,
  },
  // Executive Summary
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 20,
  },
  summaryCard: {
    width: "48%",
    backgroundColor: "#f9fafb",
    padding: 12,
    marginRight: "2%",
    marginBottom: 8,
    borderRadius: 4,
  },
  summaryCardLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginBottom: 4,
  },
  summaryCardValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
  },
  // Score display
  scoreContainer: {
    alignItems: "center",
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#1a56db",
  },
  scoreLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  // Breakdown
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  breakdownLabel: {
    fontSize: 10,
    color: "#374151",
  },
  breakdownValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#111827",
  },
  // Findings
  categoryHeader: {
    backgroundColor: "#f3f4f6",
    padding: 8,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 4,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#374151",
  },
  findingCard: {
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 4,
  },
  findingCritical: {
    borderColor: "#fca5a5",
    borderLeftWidth: 4,
    borderLeftColor: "#dc2626",
  },
  findingWarning: {
    borderColor: "#fcd34d",
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  findingCompliant: {
    borderColor: "#86efac",
    borderLeftWidth: 4,
    borderLeftColor: "#22c55e",
  },
  findingNotAssessed: {
    borderColor: "#d1d5db",
    borderLeftWidth: 4,
    borderLeftColor: "#6b7280",
  },
  findingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  findingCodeRef: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#111827",
  },
  findingStatus: {
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  findingStatusCritical: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
  },
  findingStatusWarning: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
  },
  findingStatusCompliant: {
    backgroundColor: "#dcfce7",
    color: "#166534",
  },
  findingStatusNotAssessed: {
    backgroundColor: "#f3f4f6",
    color: "#6b7280",
  },
  findingDescription: {
    fontSize: 10,
    color: "#374151",
    marginBottom: 8,
  },
  findingDetails: {
    flexDirection: "row",
    marginBottom: 4,
  },
  findingDetailLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#6b7280",
    width: 80,
  },
  findingDetailValue: {
    fontSize: 9,
    color: "#111827",
    flex: 1,
  },
  findingRecommendation: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "#eff6ff",
    borderRadius: 4,
  },
  recommendationLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1e40af",
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 9,
    color: "#1e3a8a",
  },
  // Compliance Matrix
  matrixTable: {
    marginTop: 12,
  },
  matrixHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  matrixHeaderCell: {
    padding: 8,
    fontSize: 9,
    fontWeight: "bold",
    color: "#374151",
  },
  matrixRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  matrixCell: {
    padding: 6,
    fontSize: 8,
    color: "#374151",
  },
  matrixCellCode: {
    width: 80,
  },
  matrixCellDesc: {
    flex: 1,
  },
  matrixCellStatus: {
    width: 80,
    textAlign: "center",
  },
  matrixCellConf: {
    width: 60,
    textAlign: "center",
  },
  // Disclaimer
  disclaimer: {
    marginTop: 30,
    padding: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 4,
  },
  disclaimerTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 6,
  },
  disclaimerText: {
    fontSize: 8,
    color: "#6b7280",
    lineHeight: 1.5,
  },
});

// Helper functions
const formatDate = (date: Date | string | null): string => {
  if (!date) return "N/A";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatCategory = (category: string): string => {
  return category.replace(/_/g, " ");
};

const getStatusStyles = (status: string) => {
  switch (status) {
    case "CRITICAL":
      return { card: styles.findingCritical, badge: styles.findingStatusCritical };
    case "WARNING":
      return { card: styles.findingWarning, badge: styles.findingStatusWarning };
    case "COMPLIANT":
      return { card: styles.findingCompliant, badge: styles.findingStatusCompliant };
    default:
      return { card: styles.findingNotAssessed, badge: styles.findingStatusNotAssessed };
  }
};

const getOverallStatusStyles = (status: string | null) => {
  switch (status) {
    case "PASS":
      return { badge: styles.statusPass, text: styles.statusTextPass };
    case "CONDITIONAL":
      return { badge: styles.statusConditional, text: styles.statusTextConditional };
    case "FAIL":
      return { badge: styles.statusFail, text: styles.statusTextFail };
    default:
      return { badge: styles.statusConditional, text: styles.statusTextConditional };
  }
};

// Components
const Header = ({ reportRef }: { reportRef: string }) => (
  <View style={styles.header} fixed>
    <Text>Build.A.Code Compliance Report</Text>
    <Text>{reportRef}</Text>
  </View>
);

const Footer = () => (
  <View style={styles.footer} fixed>
    <Text>
      This report is generated by Build.A.Code AI-powered compliance analysis. It does not
      constitute professional legal or engineering advice. Always verify findings with a qualified
      professional.
    </Text>
  </View>
);

const CoverPage = ({ data }: { data: ReportData }) => {
  const statusStyles = getOverallStatusStyles(data.overall_status);

  return (
    <Page size="A4" style={styles.coverPage}>
      <Text style={styles.logo}>Build.A.Code</Text>
      <Text style={styles.coverTitle}>Building Compliance Report</Text>
      <Text style={styles.coverSubtitle}>AI-Powered Analysis</Text>

      <View style={{ marginTop: 40 }}>
        <Text style={styles.coverMeta}>
          <Text style={styles.coverMetaLabel}>Report Reference: </Text>
          {data.report_ref}
        </Text>
        <Text style={styles.coverMeta}>
          <Text style={styles.coverMetaLabel}>Project: </Text>
          {data.project.name}
        </Text>
        <Text style={styles.coverMeta}>
          <Text style={styles.coverMetaLabel}>Document: </Text>
          {data.document_name} ({data.page_count} pages)
        </Text>
        <Text style={styles.coverMeta}>
          <Text style={styles.coverMetaLabel}>Region: </Text>
          {data.region}
        </Text>
        <Text style={styles.coverMeta}>
          <Text style={styles.coverMetaLabel}>Codes Assessed: </Text>
          {(data.selected_codes as string[]).join(", ")}
        </Text>
        <Text style={styles.coverMeta}>
          <Text style={styles.coverMetaLabel}>Date: </Text>
          {formatDate(data.completed_at || data.created_at)}
        </Text>
      </View>

      <View style={[styles.statusBadge, statusStyles.badge]}>
        <Text style={[styles.statusText, statusStyles.text]}>
          {data.overall_status || "PENDING"}
        </Text>
      </View>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerTitle}>Disclaimer</Text>
        <Text style={styles.disclaimerText}>
          This automated compliance report is provided for informational purposes only and does not
          constitute professional engineering, architectural, or legal advice. The analysis is based
          on AI interpretation of building codes and submitted documents. Results should be verified
          by qualified professionals before making any decisions. Build.A.Code assumes no liability
          for actions taken based on this report.
        </Text>
      </View>
    </Page>
  );
};

const ExecutiveSummary = ({ data }: { data: ReportData }) => (
  <Page size="A4" style={styles.page}>
    <Header reportRef={data.report_ref} />
    <Footer />

    <Text style={styles.sectionTitle}>Executive Summary</Text>

    <View style={styles.scoreContainer}>
      <Text style={styles.scoreValue}>
        {data.compliance_score !== null ? `${Math.round(data.compliance_score)}%` : "N/A"}
      </Text>
      <Text style={styles.scoreLabel}>Compliance Score</Text>
    </View>

    <View style={styles.summaryGrid}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryCardLabel}>Total Checks</Text>
        <Text style={styles.summaryCardValue}>{data.summary.total_checks}</Text>
      </View>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryCardLabel}>Total Findings</Text>
        <Text style={styles.summaryCardValue}>{data.summary.total_findings}</Text>
      </View>
    </View>

    <Text style={[styles.sectionTitle, { marginTop: 10 }]}>Findings Breakdown</Text>

    <View>
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Critical Issues</Text>
        <Text style={[styles.breakdownValue, { color: "#dc2626" }]}>
          {data.summary.critical_count}
        </Text>
      </View>
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Warnings</Text>
        <Text style={[styles.breakdownValue, { color: "#f59e0b" }]}>
          {data.summary.warning_count}
        </Text>
      </View>
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Compliant</Text>
        <Text style={[styles.breakdownValue, { color: "#22c55e" }]}>
          {data.summary.compliant_count}
        </Text>
      </View>
      <View style={styles.breakdownRow}>
        <Text style={styles.breakdownLabel}>Not Assessed</Text>
        <Text style={[styles.breakdownValue, { color: "#6b7280" }]}>
          {data.summary.not_assessed_count}
        </Text>
      </View>
    </View>

    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Scope of Analysis</Text>
    <Text style={styles.findingDescription}>
      This report covers the compliance analysis of &quot;{data.document_name}&quot; against the
      following building codes: {(data.selected_codes as string[]).join(", ")}. The analysis was
      performed on {data.page_count} page(s) of the submitted document.
    </Text>

    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Limitations</Text>
    <Text style={styles.findingDescription}>
      This automated analysis relies on AI vision technology to interpret architectural drawings and
      may not capture all compliance issues. The following limitations apply:
    </Text>
    <Text style={[styles.findingDescription, { marginLeft: 12 }]}>
      • Measurement accuracy depends on drawing quality and scale clarity{"\n"}
      • Complex three-dimensional relationships may not be fully assessed{"\n"}
      • Site-specific conditions require on-site verification{"\n"}
      • Code interpretations may vary by local jurisdiction{"\n"}
      • Updates to building codes after analysis date are not reflected
    </Text>
  </Page>
);

const FindingsSection = ({ data }: { data: ReportData }) => {
  const categories = Object.keys(data.findings_by_category);

  return (
    <Page size="A4" style={styles.page} wrap>
      <Header reportRef={data.report_ref} />
      <Footer />

      <Text style={styles.sectionTitle}>Detailed Findings</Text>

      {categories.map((category) => (
        <View key={category} wrap={false}>
          <View style={styles.categoryHeader}>
            <Text style={styles.categoryTitle}>{formatCategory(category)}</Text>
          </View>

          {data.findings_by_category[category].map((finding) => {
            const statusStyles = getStatusStyles(finding.status);
            return (
              <View key={finding.id} style={[styles.findingCard, statusStyles.card]} wrap={false}>
                <View style={styles.findingHeader}>
                  <Text style={styles.findingCodeRef}>{finding.code_reference}</Text>
                  <Text style={[styles.findingStatus, statusStyles.badge]}>{finding.status}</Text>
                </View>

                <Text style={styles.findingDescription}>{finding.description}</Text>

                <View style={styles.findingDetails}>
                  <Text style={styles.findingDetailLabel}>Required:</Text>
                  <Text style={styles.findingDetailValue}>{finding.required_value}</Text>
                </View>

                {finding.proposed_value && (
                  <View style={styles.findingDetails}>
                    <Text style={styles.findingDetailLabel}>As Shown:</Text>
                    <Text style={styles.findingDetailValue}>{finding.proposed_value}</Text>
                  </View>
                )}

                {finding.page_number && (
                  <View style={styles.findingDetails}>
                    <Text style={styles.findingDetailLabel}>Page:</Text>
                    <Text style={styles.findingDetailValue}>{finding.page_number}</Text>
                  </View>
                )}

                {finding.location && (
                  <View style={styles.findingDetails}>
                    <Text style={styles.findingDetailLabel}>Location:</Text>
                    <Text style={styles.findingDetailValue}>{finding.location}</Text>
                  </View>
                )}

                <View style={styles.findingDetails}>
                  <Text style={styles.findingDetailLabel}>Confidence:</Text>
                  <Text style={styles.findingDetailValue}>{finding.confidence}</Text>
                </View>

                {finding.recommendation && (
                  <View style={styles.findingRecommendation}>
                    <Text style={styles.recommendationLabel}>Recommendation</Text>
                    <Text style={styles.recommendationText}>{finding.recommendation}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </Page>
  );
};

const ComplianceMatrix = ({ data }: { data: ReportData }) => {
  const allFindings = Object.values(data.findings_by_category).flat();

  return (
    <Page size="A4" style={styles.page} wrap>
      <Header reportRef={data.report_ref} />
      <Footer />

      <Text style={styles.sectionTitle}>Appendix A: Compliance Matrix</Text>

      <View style={styles.matrixTable}>
        <View style={styles.matrixHeader}>
          <Text style={[styles.matrixHeaderCell, styles.matrixCellCode]}>Code Ref</Text>
          <Text style={[styles.matrixHeaderCell, styles.matrixCellDesc]}>Description</Text>
          <Text style={[styles.matrixHeaderCell, styles.matrixCellStatus]}>Status</Text>
          <Text style={[styles.matrixHeaderCell, styles.matrixCellConf]}>Conf.</Text>
        </View>

        {allFindings.map((finding) => (
          <View key={finding.id} style={styles.matrixRow} wrap={false}>
            <Text style={[styles.matrixCell, styles.matrixCellCode]}>{finding.code_reference}</Text>
            <Text style={[styles.matrixCell, styles.matrixCellDesc]}>
              {finding.description.substring(0, 80)}
              {finding.description.length > 80 ? "..." : ""}
            </Text>
            <Text style={[styles.matrixCell, styles.matrixCellStatus]}>{finding.status}</Text>
            <Text style={[styles.matrixCell, styles.matrixCellConf]}>{finding.confidence}</Text>
          </View>
        ))}
      </View>
    </Page>
  );
};

const MethodologyPage = ({ data }: { data: ReportData }) => (
  <Page size="A4" style={styles.page}>
    <Header reportRef={data.report_ref} />
    <Footer />

    <Text style={styles.sectionTitle}>Appendix B: Methodology</Text>

    <Text style={[styles.findingDescription, { marginBottom: 16 }]}>
      This compliance analysis was performed using Build.A.Code&apos;s AI-powered analysis pipeline,
      which employs the following methodology:
    </Text>

    <Text style={[styles.categoryTitle, { marginTop: 12, marginBottom: 8 }]}>
      1. Document Normalisation
    </Text>
    <Text style={styles.findingDescription}>
      Uploaded documents are converted to standardised image formats at 300 DPI resolution to ensure
      consistent analysis quality. Multi-page documents are processed page by page.
    </Text>

    <Text style={[styles.categoryTitle, { marginTop: 12, marginBottom: 8 }]}>
      2. Page Classification
    </Text>
    <Text style={styles.findingDescription}>
      Each page is classified by type (floor plan, elevation, section, site plan, detail, schedule,
      title block) using multimodal AI vision. This determines which building code requirements
      apply to each page.
    </Text>

    <Text style={[styles.categoryTitle, { marginTop: 12, marginBottom: 8 }]}>
      3. Code × Page Matrix Analysis
    </Text>
    <Text style={styles.findingDescription}>
      A matrix is constructed pairing each applicable building code requirement with relevant pages.
      Each pair is analysed individually, with the AI extracting measurements and specifications
      from the drawings and comparing them against code requirements.
    </Text>

    <Text style={[styles.categoryTitle, { marginTop: 12, marginBottom: 8 }]}>
      4. Cross-Validation
    </Text>
    <Text style={styles.findingDescription}>
      Findings from multiple pages are cross-validated for consistency. Conflicting measurements are
      flagged, and the highest-confidence result is retained after deduplication.
    </Text>

    <Text style={[styles.categoryTitle, { marginTop: 12, marginBottom: 8 }]}>
      5. Scoring and Recommendations
    </Text>
    <Text style={styles.findingDescription}>
      A compliance score is calculated as: COMPLIANT / (COMPLIANT + WARNING + CRITICAL) × 100.
      Overall status is determined as PASS (≥90% with no critical), CONDITIONAL (≥70% or has
      critical), or FAIL (&lt;70%). Coordinated recommendations are generated for all non-compliant
      findings.
    </Text>

    <Text style={[styles.categoryTitle, { marginTop: 12, marginBottom: 8 }]}>
      Confidence Levels
    </Text>
    <Text style={styles.findingDescription}>
      Each finding includes a confidence level:{"\n"}• HIGH: Clear measurements visible, high
      certainty in extraction{"\n"}• MEDIUM: Measurements partially visible or scale unclear{"\n"}•
      LOW: Manual verification recommended due to drawing quality or ambiguity
    </Text>
  </Page>
);

// Main Document Component
export const ComplianceReportDocument = ({ data }: { data: ReportData }) => (
  <Document
    title={`Build.A.Code Report - ${data.report_ref}`}
    author="Build.A.Code"
    subject="Building Compliance Report"
    creator="Build.A.Code AI Analysis Platform"
  >
    <CoverPage data={data} />
    <ExecutiveSummary data={data} />
    <FindingsSection data={data} />
    <ComplianceMatrix data={data} />
    <MethodologyPage data={data} />
  </Document>
);

// Factory function for renderToBuffer compatibility
export const createReportElement = (data: ReportData) => (
  <Document
    title={`Build.A.Code Report - ${data.report_ref}`}
    author="Build.A.Code"
    subject="Building Compliance Report"
    creator="Build.A.Code AI Analysis Platform"
  >
    <CoverPage data={data} />
    <ExecutiveSummary data={data} />
    <FindingsSection data={data} />
    <ComplianceMatrix data={data} />
    <MethodologyPage data={data} />
  </Document>
);
