/** Saves text as a file through a temporary object URL (no server round trip). */
export function downloadText(filename: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // The click starts the download synchronously; the URL is no longer needed afterwards.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
