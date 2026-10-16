/** Descarga un archivo generado en el navegador (plantilla, reporte) sin pasar por el servidor. */
export function downloadFile(data: ArrayBuffer | Blob, filename: string, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  // Se libera después: algunos navegadores cancelan la descarga si se revoca al momento.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
