package com.primestack.taptopay.data.model

data class SaleRequest(
    val protocol: String = "101.6",
    val message_type: String = "SALE",
    val amount: Amount,
    val card: CardData,
    val merchant: MerchantData,
    val transaction_flags: TransactionFlags,
    val transaction_id: String,
    val timestamp: String,
    val security: SecurityData? = null
)

data class SecurityData(
    val nonce: String,
    val signature: String,
    val algorithm: String
)
