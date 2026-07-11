package com.primestack.taptopay

/**
 * EmvParser — Real EMV TLV parsing
 *
 * Parses actual card responses from NFC/EMV contactless transactions.
 * Extracts PAN, expiry, AID, cryptogram from card APDU responses.
 */
object EmvParser {

    // ── TLV Tags ──────────────────────────────────────────────
    private const val TAG_PPSE_FCI         = 0x6F
    private const val TAG_DF_NAME          = 0x84
    private const val TAG_FCI_PROP         = 0xA5
    private const val TAG_FCI_ISSUER       = 0xBF0C
    private const val TAG_APP_TEMPLATE     = 0x61
    private const val TAG_AID              = 0x4F
    private const val TAG_APP_LABEL        = 0x50
    private const val TAG_PRIORITY         = 0x87

    private const val TAG_PAN              = 0x5A
    private const val TAG_EXPIRY           = 0x5F24
    private const val TAG_TRACK2_EQ        = 0x57
    private const val TAG_CARD_HOLDER      = 0x5F20
    private const val TAG_AIP              = 0x82
    private const val TAG_AFL              = 0x94
    private const val TAG_CRYPTOGRAM       = 0x9F26
    private const val TAG_CRYPTOGRAM_INFO  = 0x9F27
    private const val TAG_ATC              = 0x9F36
    private const val TAG_TVR              = 0x95
    private const val TAG_UNPRED_NUMBER    = 0x9F37
    private const val TAG_AID_RESPONSE     = 0x9F06
    private const val TAG_PDOL             = 0x9F38

    // ── Visa / Mastercard AIDs ────────────────────────────────
    private val KNOWN_AIDS = mapOf(
        "A0000000031010" to "VISA",
        "A0000000032010" to "VISA ELECTRON",
        "A0000000033010" to "VISA INTERLINK",
        "A0000000038010" to "VISA PLUS",
        "A0000000041010" to "MASTERCARD",
        "A0000000043060" to "MAESTRO",
        "A0000000046000" to "CIRRUS",
        "A000000025010801" to "AMEX",
        "A0000000651010" to "JCB",
        "A0000001523010" to "DISCOVER",
        "A000000333010101" to "UNIONPAY"
    )

    // ─────────────────────────────────────────────────────────
    // Step 1: Extract AID from PPSE response
    // ─────────────────────────────────────────────────────────
    fun extractAid(ppseResponse: ByteArray): ByteArray {
        // Try to parse TLV from PPSE response
        val tlv = parseTLV(ppseResponse)

        // Look for Application Template (0x61) → AID (0x4F)
        val appTemplate = findTag(tlv, TAG_APP_TEMPLATE.toByte())
        if (appTemplate != null) {
            val innerTlv = parseTLV(appTemplate)
            val aid = findTag(innerTlv, TAG_AID.toByte())
            if (aid != null && aid.isNotEmpty()) return aid
        }

        // Look directly for DF Name (0x84)
        val dfName = findTagInFCI(ppseResponse, 0x84.toByte())
        if (dfName != null && dfName.isNotEmpty()) return dfName

        // Default to Visa credit AID if parsing fails
        return byteArrayOf(
            0xA0.toByte(), 0x00, 0x00, 0x00, 0x03, 0x10, 0x10
        )
    }

    fun buildSelectAidCommand(aid: ByteArray): ByteArray {
        return byteArrayOf(0x00, 0xA4.toByte(), 0x04, 0x00, aid.size.toByte()) + aid
    }

    // ─────────────────────────────────────────────────────────
    // Step 2: Build GPO command from AID response
    // Reads PDOL if present and builds correct GPO data
    // ─────────────────────────────────────────────────────────
    fun buildGpoCommand(aidResponse: ByteArray): ByteArray {
        val pdol = findTagInFCI(aidResponse, 0x9F.toByte(), 0x38.toByte())

        if (pdol != null && pdol.isNotEmpty()) {
            // Build GPO data according to PDOL
            val gpoData = buildPdolData(pdol)
            val lcLen = (gpoData.size + 2).toByte()
            return byteArrayOf(
                0x80.toByte(), 0xA8.toByte(), 0x00, 0x00,
                lcLen,
                0x83.toByte(), gpoData.size.toByte()
            ) + gpoData + byteArrayOf(0x00)
        }

        // Standard GPO without PDOL data
        return byteArrayOf(
            0x80.toByte(), 0xA8.toByte(), 0x00, 0x00,
            0x02, 0x83.toByte(), 0x00, 0x00
        )
    }

    // ─────────────────────────────────────────────────────────
    // Step 3: Extract real card data from GPO + record responses
    // ─────────────────────────────────────────────────────────
    fun extractCardData(gpoResponse: ByteArray): Map<String, String> {
        val result = mutableMapOf<String, String>()

        // Parse all TLV data from response
        val tlvData = parseTLVFlat(gpoResponse)

        // Extract PAN (tag 5A)
        val panBytes = tlvData[TAG_PAN]
        if (panBytes != null) {
            val pan = bytesToPan(panBytes)
            result["pan"]   = pan
            result["last4"] = pan.takeLast(4)
            result["token"] = pan.take(6) + "******" + pan.takeLast(4)
        }

        // Extract expiry (tag 5F24) — format YYMMDD
        val expiryBytes = tlvData[TAG_EXPIRY]
        if (expiryBytes != null && expiryBytes.size >= 3) {
            val yy = String.format("%02X", expiryBytes[0].toInt() and 0xFF)
            val mm = String.format("%02X", expiryBytes[1].toInt() and 0xFF)
            result["expiry_month"] = mm
            result["expiry_year"]  = yy
        }

        // Extract Track 2 Equivalent (tag 57) — contains PAN + expiry
        if (!result.containsKey("pan")) {
            val track2 = tlvData[TAG_TRACK2_EQ]
            if (track2 != null) {
                val track2Str = track2.joinToString("") { String.format("%02X", it.toInt() and 0xFF) }
                val dIdx = track2Str.indexOf('D')
                if (dIdx > 0) {
                    val pan   = track2Str.substring(0, dIdx).trimEnd('F')
                    val expYY = track2Str.substring(dIdx + 1, dIdx + 3)
                    val expMM = track2Str.substring(dIdx + 3, dIdx + 5)
                    result["pan"]           = pan
                    result["last4"]         = pan.takeLast(4)
                    result["token"]         = pan.take(6) + "******" + pan.takeLast(4)
                    result["expiry_month"]  = expMM
                    result["expiry_year"]   = expYY
                }
            }
        }

        // Extract AC cryptogram (tag 9F26)
        val cryptogram = tlvData[TAG_CRYPTOGRAM]
        if (cryptogram != null) {
            result["cryptogram"] = cryptogram.joinToString("") {
                String.format("%02X", it.toInt() and 0xFF)
            }
        }

        // Extract AID (tag 9F06)
        val aidTag = tlvData[TAG_AID_RESPONSE]
        if (aidTag != null) {
            val aidHex = aidTag.joinToString("") { String.format("%02X", it.toInt() and 0xFF) }
            result["aid"]    = aidHex
            result["scheme"] = KNOWN_AIDS[aidHex] ?: detectSchemeFromAid(aidHex)
        }

        // Detect scheme from PAN BIN if AID not found
        if (!result.containsKey("scheme") && result.containsKey("pan")) {
            result["scheme"] = detectSchemeFromPan(result["pan"] ?: "")
        }

        return result
    }

    // ─────────────────────────────────────────────────────────
    // TLV Parsing utilities
    // ─────────────────────────────────────────────────────────

    private fun parseTLV(data: ByteArray): Map<Int, ByteArray> {
        val result = mutableMapOf<Int, ByteArray>()
        var i = 0
        while (i < data.size) {
            if (i >= data.size) break
            val tag = data[i].toInt() and 0xFF
            i++

            // Multi-byte tag
            val fullTag = if ((tag and 0x1F) == 0x1F && i < data.size) {
                val nextByte = data[i].toInt() and 0xFF
                i++
                (tag shl 8) or nextByte
            } else {
                tag
            }

            if (i >= data.size) break

            // Length
            val lenByte = data[i].toInt() and 0xFF
            i++
            val length = if (lenByte == 0x81 && i < data.size) {
                val l = data[i].toInt() and 0xFF; i++; l
            } else if (lenByte == 0x82 && i + 1 < data.size) {
                val l = ((data[i].toInt() and 0xFF) shl 8) or (data[i + 1].toInt() and 0xFF); i += 2; l
            } else {
                lenByte
            }

            if (i + length > data.size) break

            result[fullTag] = data.copyOfRange(i, i + length)
            i += length
        }
        return result
    }

    private fun parseTLVFlat(data: ByteArray): Map<Int, ByteArray> {
        val result = mutableMapOf<Int, ByteArray>()
        collectTLV(data, result)
        return result
    }

    private fun collectTLV(data: ByteArray, result: MutableMap<Int, ByteArray>) {
        var i = 0
        while (i < data.size) {
            if (i >= data.size) break
            val tagByte = data[i].toInt() and 0xFF
            i++

            val fullTag = if ((tagByte and 0x1F) == 0x1F && i < data.size) {
                val nb = data[i].toInt() and 0xFF; i++; (tagByte shl 8) or nb
            } else tagByte

            if (i >= data.size) break
            val lenByte = data[i].toInt() and 0xFF
            i++
            val length = when {
                lenByte == 0x81 && i < data.size -> { val l = data[i].toInt() and 0xFF; i++; l }
                lenByte == 0x82 && i + 1 < data.size -> {
                    val l = ((data[i].toInt() and 0xFF) shl 8) or (data[i+1].toInt() and 0xFF); i += 2; l
                }
                else -> lenByte
            }

            if (i + length > data.size) break
            val value = data.copyOfRange(i, i + length)

            // Store — don't overwrite first occurrence
            if (!result.containsKey(fullTag)) result[fullTag] = value

            // Recurse into constructed TLVs (bit 5 of first byte set)
            if ((tagByte and 0x20) != 0) collectTLV(value, result)

            i += length
        }
    }

    private fun findTag(tlv: Map<Int, ByteArray>, tag: Byte): ByteArray? =
        tlv[tag.toInt() and 0xFF]

    private fun findTagInFCI(data: ByteArray, vararg tagBytes: Byte): ByteArray? {
        val flat = parseTLVFlat(data)
        val tag = if (tagBytes.size == 1) {
            tagBytes[0].toInt() and 0xFF
        } else {
            ((tagBytes[0].toInt() and 0xFF) shl 8) or (tagBytes[1].toInt() and 0xFF)
        }
        return flat[tag]
    }

    private fun buildPdolData(pdol: ByteArray): ByteArray {
        // Build terminal data matching PDOL requirements
        // Standard terminal data for contactless
        val terminalData = mutableListOf<Byte>()
        var i = 0
        while (i < pdol.size) {
            val tag = pdol[i].toInt() and 0xFF; i++
            if (i >= pdol.size) break
            val len = pdol[i].toInt() and 0xFF; i++

            // Fill with appropriate terminal values
            val value = when (tag) {
                0x9F -> when (if (i <= pdol.size) pdol.getOrNull(i - 1)?.toInt()?.and(0xFF) else 0) {
                    0x66 -> ByteArray(len) { if (it == 0) 0xB6.toByte() else 0x00 } // Terminal Transaction Qualifiers
                    0x02 -> ByteArray(len) { 0x00 } // Amount, Authorized
                    0x03 -> ByteArray(len) { 0x00 } // Amount, Other
                    0x1A -> byteArrayOf(0x08, 0x40) + ByteArray(maxOf(0, len - 2)) // Terminal Country Code (UAE 840)
                    0x37 -> ByteArray(len) { (System.currentTimeMillis() shr (it * 8)).toByte() } // Unpredictable Number
                    else -> ByteArray(len) { 0x00 }
                }
                0x5F -> ByteArray(len) { 0x00 }
                else -> ByteArray(len) { 0x00 }
            }
            terminalData.addAll(value.toList())
        }
        return terminalData.toByteArray()
    }

    private fun bytesToPan(bytes: ByteArray): String {
        return bytes.joinToString("") { String.format("%02X", it.toInt() and 0xFF) }
            .trimEnd('F')
    }

    private fun detectSchemeFromAid(aidHex: String): String = when {
        aidHex.startsWith("A00000000310") || aidHex.startsWith("A00000000320") ||
        aidHex.startsWith("A00000000330") || aidHex.startsWith("A00000000380") -> "VISA"
        aidHex.startsWith("A00000000410") || aidHex.startsWith("A00000000430") ||
        aidHex.startsWith("A00000000460") -> "MASTERCARD"
        aidHex.startsWith("A000000025") -> "AMEX"
        aidHex.startsWith("A000000065") -> "JCB"
        aidHex.startsWith("A000000152") -> "DISCOVER"
        aidHex.startsWith("A000000333") -> "UNIONPAY"
        else -> "UNKNOWN"
    }

    private fun detectSchemeFromPan(pan: String): String = when {
        pan.startsWith("4")             -> "VISA"
        pan.startsWith("5") || pan.startsWith("2") -> "MASTERCARD"
        pan.startsWith("34") || pan.startsWith("37") -> "AMEX"
        pan.startsWith("6011") || pan.startsWith("65") -> "DISCOVER"
        pan.startsWith("35")            -> "JCB"
        pan.startsWith("62")            -> "UNIONPAY"
        else                            -> "UNKNOWN"
    }
}
