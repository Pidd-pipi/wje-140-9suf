export function generateOrderNo(prefix = 'DSP', seq = 1) { return `${prefix}-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${String(seq).padStart(4,'0')}`; }
