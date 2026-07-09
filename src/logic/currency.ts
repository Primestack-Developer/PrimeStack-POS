import rates from "../data/rates.json" with { type: "json" };

export function convert(amount: number, from: string, to: string): number | null {
  const key = `${from}_${to}`;
  return rates[key as keyof typeof rates] ? amount * (rates[key as keyof typeof rates] as number) : null;
}
