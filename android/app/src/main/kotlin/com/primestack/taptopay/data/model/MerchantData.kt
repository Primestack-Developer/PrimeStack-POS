package com.primestack.taptopay.data.model

data class MerchantData(
    val merchant_id: String,
    val store_id: String? = null,
    val terminal_id: String,
    val country: String,
    val currency: String
)
