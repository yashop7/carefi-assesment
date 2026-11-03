export function BrandMark({ size = 20 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2 4 5v6.5c0 4.7 3.2 8.6 8 10.5 4.8-1.9 8-5.8 8-10.5V5l-8-3Zm-1 5h2v3.5h3.5v2H13V16h-2v-3.5H7.5v-2H11V7Z" />
    </svg>
  );
}
