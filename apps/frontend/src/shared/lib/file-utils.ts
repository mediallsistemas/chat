export function fileIcon(mime: string): string {
  if (mime.startsWith('image/')) return 'ti-photo'
  if (mime.includes('pdf')) return 'ti-file-type-pdf'
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'ti-file-type-xls'
  if (mime.includes('word') || mime.includes('document')) return 'ti-file-type-doc'
  if (mime.includes('video')) return 'ti-video'
  return 'ti-file'
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
