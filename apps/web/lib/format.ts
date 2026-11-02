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
