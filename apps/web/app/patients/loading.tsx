export default function Loading() {
  return (
    <div className="skeleton" role="status" aria-label="Loading">
      {[0, 1, 2, 3, 4, 5].map((row) => <span key={row} />)}
    </div>
  );
}
