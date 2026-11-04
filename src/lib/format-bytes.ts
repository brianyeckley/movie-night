/**
 * Human-readable file sizes.
 *
 * Deliberately free of imports: the upload panel renders this in the browser
 * and the Discord notifier sends it from the server, and a movie's size should
 * read the same in both places.
 */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
