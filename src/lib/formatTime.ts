/**
 * Formatea un tiempo en segundos a formato HH:mm:ss.
 *
 * @param {number} seconds - Tiempo en segundos
 * @returns {string} Tiempo formateado como HH:mm:ss
 *
 * @example
 * const formatted = formatTime(3661); // returns "01:01:01"
 * const zero = formatTime(0); // returns "00:00:00"
 */
export function formatTime(seconds: number): string {
  const absSeconds = Math.abs(seconds); // Convertir a valor absoluto
  const hours = Math.floor(absSeconds / 3600);
  const minutes = Math.floor((absSeconds % 3600) / 60);
  const remainingSeconds = absSeconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((val) => val.toString().padStart(2, "0"))
    .join(":");
}
