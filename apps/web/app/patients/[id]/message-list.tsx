import { formatDate } from "@/lib/format";

type Message = {
  id: string;
  channel: string;
  recipient: string;
  body: string;
  status: string;
  attempts: number;
  providerId: string | null;
  errorMessage: string | null;
  createdAt: string;
};

function statusLabel({ channel, status, providerId }: Message) {
  if (providerId === "simulated") return "Simulated";
  if (status === "sent") return "Sent";
  if (status === "failed") return "Failed";
  return channel === "whatsapp" ? "Waiting for patient to message" : "Sending";
}

// `showDelivery` is for staff: patients don't see attempts or provider errors.
export function MessageList({
  messages,
  showDelivery,
}: {
  messages: Message[];
  showDelivery: boolean;
}) {
  return messages.map((message) => (
    <div className="message" key={message.id}>
      <p className="status-cell">
        <strong>{message.channel === "whatsapp" ? "WhatsApp" : "Email"}</strong>
        <span className={message.status === "failed" ? "badge badge-warn" : "badge badge-good"}>
          {statusLabel(message)}
        </span>
        <span className="muted">
          {message.recipient}, {formatDate(message.createdAt)}
          {showDelivery && `, ${message.attempts} ${message.attempts === 1 ? "attempt" : "attempts"}`}
        </span>
      </p>
      {showDelivery && message.status === "failed" && message.errorMessage && (
        <p className="field-error">{message.errorMessage}</p>
      )}
      <pre>{message.body}</pre>
    </div>
  ));
}
