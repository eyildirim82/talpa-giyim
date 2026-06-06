/**
 * T.C. Kimlik Numarası biçim/algoritma doğrulaması (sunucu tarafı).
 * İstemci doğrulamasına güvenilmemesi için claim akışında yeniden uygulanır.
 */
export function isValidTc(tc: string): boolean {
  if (tc.length !== 11 || !/^\d+$/.test(tc) || tc[0] === '0') return false;
  const d = tc.split('').map(Number);
  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8];
  const evenSum = d[1] + d[3] + d[5] + d[7];
  if ((oddSum * 7 - evenSum) % 10 !== d[9]) return false;
  const total = d.slice(0, 10).reduce((a, b) => a + b, 0);
  return total % 10 === d[10];
}
