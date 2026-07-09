package com.primestack.taptopay.data.model

data class TransactionFlags(
    val offline: Boolean,
    val moto: Boolean,
    val recurring: Boolean
)
