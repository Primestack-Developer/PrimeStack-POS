package com.primestack.taptopay.data.model

data class SaleResponse(
    val approved: Boolean,
    val auth_code: String? = null,
    val rrn: String? = null,
    val message: String,
    val last4: String,
    val card_brand: String
)
