export async function initiate3DS(pan: string, amount: number) {
  return {
    status: "CHALLENGE_REQUIRED",
    acs_url: "https://bank.com/acs",
    transaction_id: "3DS-" + Date.now()
  };
}
