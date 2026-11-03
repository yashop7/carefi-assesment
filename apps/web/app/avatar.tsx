export function Avatar({ name, large }: { name: string; large?: boolean }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return (
    <span className={large ? "avatar avatar-large" : "avatar"} aria-hidden="true">
      {initials}
    </span>
  );
}
