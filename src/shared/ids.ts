export function isObjectId(id: string) {
  return /^[a-f\d]{24}$/i.test(id);
}

export function createIdentifier(length = 12) {
  const digits = '0123456789';
  const letters = 'abcdefghijklmnopqrstuvwxyz';

  return new Array(length)
    .fill(0)
    .map(() => (Math.random() > 0.6 ? digits : letters))
    .map((v) => (Math.random() > 0.5 ? v.toUpperCase() : v.toLowerCase()))
    .map((v) => v[Math.floor(Math.random() * v.length)])
    .join('');
}
