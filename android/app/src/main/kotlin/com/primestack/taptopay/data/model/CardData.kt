package com.primestack.taptopay.data.model

data class CardData(
    val entry_mode: String,
    val pan: String? = null,
    val expiry_month: String? = null,
    val expiry_year: String? = null,
    val cvv: String? = null,
    val token: String? = null,
    val cryptogram: String? = null,
    val aid: String? = null
)
