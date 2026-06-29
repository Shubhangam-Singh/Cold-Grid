/**
 * Generates a downloadable PDF of the operator certificate. jsPDF is imported
 * dynamically so it is code-split out of the main bundle and only fetched when
 * the operator actually clicks "Download".
 */

export interface CertificateData {
  name: string;
  level: string;
  totalStars: number;
  maxStars: number;
  pct: number;
  preScore: number | null;
  postScore: number | null;
  corrected: number | null;
  scenariosCompleted: number;
  scenariosTotal: number;
}

export async function downloadCertificatePdf(d: CertificateData): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const cx = W / 2;
  const name = d.name.trim() || "Operator";

  // Dark control-room background + double border (amber over cyan).
  doc.setFillColor(7, 9, 13);
  doc.rect(0, 0, W, H, "F");
  doc.setDrawColor(245, 176, 0);
  doc.setLineWidth(3);
  doc.rect(24, 24, W - 48, H - 48);
  doc.setDrawColor(0, 200, 230);
  doc.setLineWidth(1);
  doc.rect(32, 32, W - 64, H - 64);

  doc.setTextColor(0, 210, 235);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("COLDGRID TRAINING ACADEMY", cx, 78, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.text("Chennai Cold-Chain Operator Certificate", cx, 124, { align: "center" });

  doc.setTextColor(150, 160, 175);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("This certifies that", cx, 178, { align: "center" });

  doc.setTextColor(245, 176, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(name, cx, 222, { align: "center" });

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(16);
  doc.text(`has qualified as ${d.level}`, cx, 262, { align: "center" });

  doc.setTextColor(245, 176, 0);
  doc.setFontSize(13);
  doc.text(`${d.totalStars} / ${d.maxStars} stars  ·  ${d.pct.toFixed(0)}%`, cx, 288, {
    align: "center",
  });

  doc.setTextColor(205, 213, 225);
  doc.setFontSize(13);
  let y = 340;
  if (d.preScore != null && d.postScore != null) {
    doc.text(
      `Pre-assessment: ${d.preScore.toFixed(0)}%      →      Post-assessment: ${d.postScore.toFixed(0)}%`,
      cx,
      y,
      { align: "center" }
    );
    y += 26;
    if (d.corrected != null && d.corrected > 0) {
      doc.text(`Misconceptions corrected: ${d.corrected}`, cx, y, { align: "center" });
      y += 26;
    }
  }
  doc.text(`Scenarios completed: ${d.scenariosCompleted} / ${d.scenariosTotal}`, cx, y, {
    align: "center",
  });

  const date = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setTextColor(120, 130, 145);
  doc.setFontSize(10);
  doc.text(`Issued by ColdGrid Training Academy  ·  ${date}`, cx, H - 56, { align: "center" });

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "operator";
  doc.save(`coldgrid-certificate-${slug}.pdf`);
}
