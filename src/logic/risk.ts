export function riskScore(msg: any) {
  let score = 0;

  if (msg.amount.value > 1000) score += 20;
  if (msg.transaction_flags.offline) score += 15;
  if (msg.card.entry_mode === "MOTO") score += 25;

  const riskyCountries = ["NG", "PK", "RU"];
  if (riskyCountries.includes(msg.merchant.country)) score += 30;

  return score;
}
