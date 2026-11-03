const dateFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export function formatDate(value: string) {
  return dateFormat.format(new Date(value));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOCUMENT_TYPES: Record<string, string> = {
  discharge_summary: "Discharge summary",
  summary_bill: "Summary bill",
  itemised_bill: "Itemised bill",
  pharmacy_bill: "Pharmacy bill",
  investigation_report: "Test report",
  consultation_paper: "Consultation paper",
  policy_copy: "Policy copy",
  kyc: "ID document",
  cancelled_cheque: "Cancelled cheque",
  query_letter: "Query letter",
  other: "Other",
};

export function documentTypeLabel(type: string) {
  return DOCUMENT_TYPES[type] ?? "Other";
}

export function isBeingRead(status: string) {
  return status === "pending" || status === "processing";
}

const QUERY_STATUSES: Record<string, string> = {
  uploaded: "Starting",
  reading: "Reading letter",
  checking_locker: "Checking locker",
  sending: "Sending",
  delivery_failed: "Delivery failed",
  failed: "Failed",
};

export function isBeingWorkedOn(status: string) {
  return ["uploaded", "reading", "checking_locker", "sending"].includes(status);
}

type PointState = { status: string; resolvedAt: string | null };

export function waitingForTeam(point: PointState) {
  return point.status === "needs_team" && !point.resolvedAt;
}

export function queryStatusLabel(status: string, points: PointState[]) {
  if (status !== "completed") return QUERY_STATUSES[status] ?? "Unknown";
  const sent = points.some((point) => point.status === "needed_from_patient");
  const team = points.some(waitingForTeam);
  if (sent) return team ? "Sent, needs team" : "Sent";
  return team ? "Needs team" : "No action needed";
}

export function queryBadgeClass(label: string) {
  if (/fail|team/i.test(label)) return "badge badge-warn";
  if (label === "Sent" || label === "No action needed") return "badge badge-good";
  return "badge";
}

export function openItems(points: PointState[]) {
  return points.filter((point) => point.status === "needed_from_patient" || waitingForTeam(point)).length;
}

const POINT_STATUSES: Record<string, string> = {
  already_in_locker: "Already in locker",
  needed_from_patient: "Asked from patient",
  needs_team: "Needs team",
};

export function pointStatusLabel(point: PointState) {
  if (point.status === "needs_team" && point.resolvedAt) return "Handled";
  return POINT_STATUSES[point.status] ?? "Unknown";
}

const ACCESS_ACTIONS: Record<string, string> = {
  view_patient: "Opened patient",
  view_document: "Opened document",
  view_query: "Opened letter",
  upload: "Uploaded",
  delete_file: "Deleted file",
  denied: "Denied",
};

export function accessActionLabel(action: string) {
  return ACCESS_ACTIONS[action] ?? "Unknown";
}

export function timeTaken(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) return null;
  const seconds = (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000;
  return `${seconds.toFixed(1)} seconds`;
}
