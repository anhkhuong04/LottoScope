export function parseCombination(
  raw: string | null,
  min: number,
  max: number,
  count: number,
): number[] {
  if (!raw || !/^\d+(,\d+)*$/.test(raw)) return []
  const numbers = raw.split(',').map(Number)
  if (
    numbers.length !== count ||
    new Set(numbers).size !== count ||
    numbers.some((n) => !Number.isInteger(n) || n < min || n > max)
  )
    return []
  return numbers.sort((a, b) => a - b)
}
