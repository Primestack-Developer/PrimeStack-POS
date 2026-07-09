package com.primestack.taptopay

object EmvParser {

    fun extractAid(response: ByteArray): ByteArray {
        // Parse FCI template to find AID
        // Simplified for demo
        return byteArrayOf(0xA0.toByte(), 0x00, 0x00, 0x00, 0x03)
    }

    fun buildSelectAidCommand(aid: ByteArray): ByteArray {
        val header = byteArrayOf(0x00, 0xA4.toByte(), 0x04, 0x00, aid.size.toByte())
        return header + aid
    }

    fun buildGpoCommand(aidResponse: ByteArray): ByteArray {
        return byteArrayOf(
            0x80.toByte(), 0xA8.toByte(), 0x00, 0x00,
            0x02, 0x83.toByte(), 0x00, 0x00
        )
    }

    fun extractCardData(gpoResponse: ByteArray): Map<String, String> {
        return mapOf(
            "token" to "411111******1111",
            "cryptogram" to "9F2608A1B2C3D4E5F6",
            "aid" to "A000000003",
            "last4" to "1111"
        )
    }
}
