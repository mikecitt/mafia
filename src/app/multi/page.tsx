import styles from "./page.module.css";

export default async function MultiPage({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>;
}) {
  const params = await searchParams;
  const raw = parseInt(params.n ?? "8", 10);
  const count = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 64) : 8;

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  return (
    <div
      className={styles.container}
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {Array.from({ length: count }, (_, i) => (
        <iframe key={i} src="/" className={styles.frame} title={`Screen ${i + 1}`} />
      ))}
    </div>
  );
}
