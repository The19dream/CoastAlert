import Report from "../models/Report";
import OfficialAlert from "../models/OfficialAlert";

export async function getCoastalIntelligence(location: string) {
  const now = new Date();

  // Only consider reports from the last 24 hours.
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Get recent, non-false-alarm reports.
  const reports = await Report.find({
    createdAt: { $gte: since },
    status: { $ne: "false_alarm" }
  }).lean();

  // Get currently active official alerts for the requested region.
  const officialAlerts = await OfficialAlert.find({
    region: { $regex: new RegExp(`^${location}$`, "i") },
    issuedAt: { $lte: now },
    expiresAt: { $gte: now }
  }).lean();

  // Reports with at least community verification are
  // treated as credible evidence for the intelligence result.
  const credibleReports = reports.filter(
    (report) =>
      report.status === "community_verified" ||
      report.status === "high_confidence"
  );

  // Calculate risk from real report severity.
  let reportRiskScore = 0;

  for (const report of credibleReports) {
    const severityWeight = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4
    }[report.severity];

    reportRiskScore += severityWeight;

    // Credibility score is 0-80+, so normalize it to 0-1.
    const credibilityMultiplier = Math.min(
      report.credibilityScore / 80,
      1
    );

    reportRiskScore += severityWeight * credibilityMultiplier;
  }

  // Official alerts are stronger evidence than community reports.
  let officialRiskScore = 0;

  for (const alert of officialAlerts) {
    const severityWeight = {
      low: 2,
      medium: 4,
      high: 6,
      critical: 8
    }[alert.severity];

    officialRiskScore += severityWeight;
  }

  const totalRiskScore = reportRiskScore + officialRiskScore;

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  if (totalRiskScore >= 12) {
    riskLevel = "CRITICAL";
  } else if (totalRiskScore >= 7) {
    riskLevel = "HIGH";
  } else if (totalRiskScore >= 3) {
    riskLevel = "MEDIUM";
  } else {
    riskLevel = "LOW";
  }

  /*
   * Confidence is based on the quality and amount of evidence.
   *
   * Community evidence:
   * - More credible reports increase confidence.
   *
   * Official evidence:
   * - Active official alerts provide strong confidence.
   */
  const communityConfidence = Math.min(
    credibleReports.length / 5,
    1
  );

  const officialConfidence = Math.min(
    officialAlerts.length / 2,
    1
  );

  let confidence =
    communityConfidence * 0.5 +
    officialConfidence * 0.5;

  // With no evidence, confidence should be zero.
  if (
    credibleReports.length === 0 &&
    officialAlerts.length === 0
  ) {
    confidence = 0;
  }

  return {
    location,
    riskLevel,
    confidence: Number(confidence.toFixed(2)),
    activeHazards: credibleReports.length,
    officialAlerts: officialAlerts.length
  };
}
