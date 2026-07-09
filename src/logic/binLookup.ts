import binData from "../data/bin.json" with { type: "json" };

export interface BinInfo {
  bin: string;
  scheme: string;
  type: string;
  country: string;
}

export function lookupBin(panOrToken: string): BinInfo | null {
  const bin = panOrToken.substring(0, 6);
  return binData.find((b: BinInfo) => b.bin === bin) || null;
}
