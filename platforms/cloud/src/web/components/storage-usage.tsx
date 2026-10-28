/** "12.3 MB of 100 MB" with a bar; just the amount when there is no limit. */
export function StorageUsage({ usedBytes, limitBytes }: { usedBytes: number; limitBytes: number | null }) {
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  const share = limitBytes ? Math.min(1, usedBytes / limitBytes) : 0;
  return (
    <div className="grid max-w-sm gap-1.5">
      <p>
        {mb(usedBytes)}
        {limitBytes !== null ? ` of ${mb(limitBytes)}` : " (no limit)"}
      </p>
      {limitBytes !== null && (
        <div
          className="h-2 overflow-hidden rounded-full bg-secondary"
          role="meter"
          aria-label="Storage used"
          aria-valuemin={0}
          aria-valuemax={limitBytes}
          aria-valuenow={usedBytes}
        >
          <div
            className={share > 0.9 ? "h-full bg-destructive" : "h-full bg-primary"}
            style={{ width: `${share * 100}%` }}
          />
        </div>
      )}
      <p className="text-sm text-muted-foreground">Counts the files of all books owned; built websites do not count.</p>
    </div>
  );
}
