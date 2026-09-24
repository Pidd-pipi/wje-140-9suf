export function generateOrderNo(prefix = 'DSP', sequence = 1) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${date}-${String(sequence).padStart(4, '0')}`;
}
