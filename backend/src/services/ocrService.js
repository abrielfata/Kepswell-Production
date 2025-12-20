const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

/**
 * Ekstrak teks dari gambar dengan retry mechanism
 */
const extractTextFromImage = async (imagePath = null, imageUrl = null, retryCount = 0) => {
    const maxRetries = parseInt(process.env.OCR_MAX_RETRIES || '3', 10);
    const timeout = parseInt(process.env.OCR_TIMEOUT_MS || '45000', 10); // default 45 detik

    try {
        console.log(`\n🔍 ========== OCR ATTEMPT ${retryCount + 1}/${maxRetries + 1} ==========`);
        console.log('📂 Image Path:', imagePath);
        
        const apiKey = process.env.OCRSPACE_API_KEY;

        if (!apiKey) {
            console.error('❌ OCRSPACE_API_KEY not configured');
            throw new Error('OCRSPACE_API_KEY not configured in .env');
        }

        const formData = new FormData();
        formData.append('apikey', apiKey);
        formData.append('language', 'eng');
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('OCREngine', '2'); // Engine 2 lebih baik untuk angka

        if (imagePath && fs.existsSync(imagePath)) {
            const fileStats = fs.statSync(imagePath);
            console.log('📊 File Size:', (fileStats.size / 1024).toFixed(2), 'KB');
            
            formData.append('file', fs.createReadStream(imagePath));
        } else if (imageUrl) {
            formData.append('url', imageUrl);
        } else {
            throw new Error('No valid image path or URL provided');
        }

        console.log('⏳ Sending to OCR.Space API...');
        const startTime = Date.now();

        const response = await axios.post(
            'https://api.ocr.space/parse/image',
            formData,
            {
                headers: {
                    ...formData.getHeaders()
                },
                timeout: timeout
            }
        );

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`⏱️ Response Time: ${duration}s`);

        if (!response.data) {
            throw new Error('Empty response from OCR.Space');
        }

        console.log('📨 OCR Exit Code:', response.data.OCRExitCode);
        
        if (response.data.IsErroredOnProcessing) {
            const errorMsg = response.data.ErrorMessage?.[0] || 'Unknown OCR error';
            console.error('❌ OCR Processing Error:', errorMsg);
            throw new Error(errorMsg);
        }

        if (!response.data.ParsedResults || response.data.ParsedResults.length === 0) {
            throw new Error('No text detected in image');
        }

        const ocrResult = response.data.ParsedResults[0];
        const rawText = ocrResult.ParsedText;

        console.log('✅ OCR Success! Text length:', rawText.length);
        console.log('📄 Raw Text (first 500 chars):', rawText.substring(0, 500));

        // ✅ NEW: Use platform detection (multi-platform)
        const platformData = detectAndParsePlatform(rawText);

        console.log('🎯 Primary Platform:', platformData.primaryPlatform);
        console.log('📦 Platforms Detected:', platformData.platforms.length);
        console.log('💰 Parsed GMV (primary):', platformData.platforms[0]?.parsedGMV || 0);
        console.log('⏱️ Parsed Duration (primary):', platformData.platforms[0]?.parsedDuration || 'Not found');
        console.log('========== OCR SUCCESS ==========\n');

        return {
            success: true,
            rawText: rawText,
            platforms: platformData.platforms,               // Array of detected platforms
            primaryPlatform: platformData.primaryPlatform,
            isDualPlatform: platformData.isDualPlatform,
            // Backward compatibility (single platform)
            platform: platformData.primaryPlatform,
            parsedGMV: platformData.platforms[0]?.parsedGMV || 0,
            parsedDuration: platformData.platforms[0]?.parsedDuration || null,
            confidence: ocrResult.TextOrientation || 0
        };

    } catch (error) {
        console.error(`❌ OCR Attempt ${retryCount + 1} Failed:`, error.message);

        // Retry jika belum max retries dan bukan API key error
        if (retryCount < maxRetries && !error.message.includes('API')) {
            const waitTime = (retryCount + 1) * 2; // 2s, 4s, 6s
            console.log(`🔄 Retrying in ${waitTime} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            return extractTextFromImage(imagePath, imageUrl, retryCount + 1);
        }

        console.error('❌ All OCR attempts failed');
        console.log('========== OCR FAILED ==========\n');

        return {
            success: false,
            error: error.message,
            rawText: null,
            parsedGMV: 0
        };
    }
};

/**
 * ========================================
 * ✅ NEW FUNCTION: Parse Shopee Duration
 * ========================================
 * Extract duration dari Shopee Live screenshot
 * 
 * Format yang didukung:
 * - "Durasi Live: 2 jam 30 menit"
 * - "Durasi: 45 menit"
 * - "2 jam 15 menit"
 * - "01:45:30" (HH:MM:SS format)
 * 
 * @param {string} text - Cleaned OCR text (uppercase)
 * @returns {string|null} Duration string atau null
 */
const parseShopeeDuration = (text) => {
    try {
        console.log('\n⏱️ Parsing Shopee Duration...');
        
        // Pattern 1: "Durasi Live: X jam Y menit" atau "Durasi: X jam Y menit"
        const pattern1 = /Durasi(?:\s*Live)?[:\s]*(\d+)\s*jam(?:\s*(\d+)\s*(?:menit|mnt))?/i;
        const match1 = text.match(pattern1);
        
        if (match1) {
            const hours = parseInt(match1[1]) || 0;
            const minutes = parseInt(match1[2]) || 0;
            
            if (hours > 0 || minutes > 0) {
                let duration = '';
                if (hours > 0) duration += `${hours} jam`;
                if (minutes > 0) {
                    if (duration) duration += ' ';
                    duration += `${minutes} menit`;
                }
                console.log('✅ Found Shopee Duration (Pattern 1):', duration);
                console.log('   Match:', match1[0]);
                return duration;
            }
        }

        // Pattern 2: "Durasi: X menit" (tanpa jam)
        const pattern2 = /Durasi(?:\s*Live)?[:\s]*(\d+)\s*(?:menit|mnt)/i;
        const match2 = text.match(pattern2);
        
        if (match2) {
            const minutes = parseInt(match2[1]) || 0;
            if (minutes > 0) {
                const duration = `${minutes} menit`;
                console.log('✅ Found Shopee Duration (Pattern 2):', duration);
                console.log('   Match:', match2[0]);
                return duration;
            }
        }

        // Pattern 3: Time format "HH:MM:SS"
        const pattern3 = /(\d{1,2}):(\d{2}):(\d{2})/;
        const match3 = text.match(pattern3);
        
        if (match3) {
            const hours = parseInt(match3[1]) || 0;
            const minutes = parseInt(match3[2]) || 0;
            
            if (hours > 0 || minutes > 0) {
                let duration = '';
                if (hours > 0) duration += `${hours} jam`;
                if (minutes > 0) {
                    if (duration) duration += ' ';
                    duration += `${minutes} menit`;
                }
                console.log('✅ Found Shopee Duration (Time format):', duration);
                console.log('   Match:', match3[0]);
                return duration;
            }
        }

        // Pattern 4: Just "X jam Y menit" (tanpa prefix)
        const pattern4 = /(\d+)\s*jam(?:\s*(\d+)\s*(?:menit|mnt))?/i;
        const match4 = text.match(pattern4);
        
        if (match4) {
            const hours = parseInt(match4[1]) || 0;
            const minutes = parseInt(match4[2]) || 0;
            
            if (hours > 0 || minutes > 0) {
                let duration = '';
                if (hours > 0) duration += `${hours} jam`;
                if (minutes > 0) {
                    if (duration) duration += ' ';
                    duration += `${minutes} menit`;
                }
                console.log('✅ Found Shopee Duration (Pattern 4):', duration);
                console.log('   Match:', match4[0]);
                return duration;
            }
        }

        console.log('⚠️ No Shopee Duration pattern found');
        return null;

    } catch (error) {
        console.error('❌ Parse Shopee Duration Error:', error.message);
        return null;
    }
};

/**
 * Parse GMV dari raw text OCR
 */
const parseGMVFromText = (text) => {
    try {
        console.log('\n🔍 Starting GMV parsing...');
        
        let cleanText = text.replace(/\s+/g, ' ').toUpperCase();
        // Toleransi kesalahan OCR: BMV/GMY/GMW sering salah baca sebagai GMV
        cleanText = cleanText
            .replace(/BMV/g, 'GMV')
            .replace(/GMY/g, 'GMV')
            .replace(/GMW/g, 'GMV');
        console.log('📝 Cleaned text (first 200 chars):', cleanText.substring(0, 200));

        const numericRegex = /[\d.,K]+/i;

        // ===================================
        // PRIORITY 1: GMV LANGSUNG
        // ===================================
        const directMatch = cleanText.match(new RegExp(`GMV\\s*LANGSUNG[^a-zA-Z]*RP\\s*(${numericRegex.source})`, 'i'));
        
        if (directMatch && directMatch[1]) {
            const gmv = applyMultiplier(directMatch[1]);
            if (gmv > 0) {
                console.log('✅ Found GMV (PRIORITY: LANGSUNG):', gmv);
                return gmv;
            }
        }

        // ===================================
        // PRIORITY 2: GMV TOTAL
        // ===================================
        const totalMatch = cleanText.match(new RegExp(`GMV[^a-zA-Z]*RP\\s*(${numericRegex.source})`, 'i'));
        if (totalMatch && totalMatch[1]) {
            const gmv = applyMultiplier(totalMatch[1]);
            if (gmv > 0) {
                console.log('✅ Found GMV (Total):', gmv);
                return gmv;
            }
        }
        
        // ===================================
        // PRIORITY 3: Max Rupiah
        // ===================================
        const rupiah = cleanText.match(new RegExp(`RP\\s*(${numericRegex.source})`, 'gi'));
        if (rupiah && rupiah.length > 0) {
            console.log('💰 Found Rupiah values:', rupiah);
            
            const amounts = rupiah.map(r => {
                let numStr = r.replace(/RP\s*/i, '');
                return applyMultiplier(numStr);
            }).filter(n => n > 0);

            if (amounts.length > 0) {
                const maxAmount = Math.max(...amounts);
                console.log('✅ Found GMV (Max Rupiah):', maxAmount);
                return maxAmount;
            }
        }

        console.log('⚠️ No GMV pattern found, returning 0');
        return 0;

    } catch (error) {
        console.error('❌ Parse GMV Error:', error.message);
        return 0;
    }
};
/**
 * Parse Durasi dari raw text OCR
 */
const parseDurationFromText = (text) => {
    try {
        console.log('\n⏱️ Starting Duration parsing...');
        
        let cleanText = text.replace(/\s+/g, ' ').trim();
        console.log('📝 Text for duration (first 300 chars):', cleanText.substring(0, 300));

        // Pattern 1: "Durasi: X jam Y menit" atau "Durasi: X jam"
        const pattern1 = /Durasi[:\s]*(\d+)\s*jam(?:\s*(\d+)\s*(?:menit|mnt))?/i;
        const match1 = cleanText.match(pattern1);
        
        if (match1) {
            const hours = parseInt(match1[1]) || 0;
            const minutes = parseInt(match1[2]) || 0;
            
            if (hours > 0 || minutes > 0) {
                let duration = '';
                if (hours > 0) duration += `${hours} jam`;
                if (minutes > 0) {
                    if (duration) duration += ' ';
                    duration += `${minutes} menit`;
                }
                
                console.log('✅ Found Duration (Pattern 1):', duration);
                return duration;
            }
        }

        // Pattern 2: "Durasi: X menit" saja
        const pattern2 = /Durasi[:\s]*(\d+)\s*(?:menit|mnt)/i;
        const match2 = cleanText.match(pattern2);
        
        if (match2) {
            const minutes = parseInt(match2[1]) || 0;
            if (minutes > 0) {
                const duration = `${minutes} menit`;
                console.log('✅ Found Duration (Pattern 2):', duration);
                return duration;
            }
        }

        // Pattern 3: Hanya angka jam "X jam"
        const pattern3 = /(\d+)\s*jam/i;
        const match3 = cleanText.match(pattern3);
        
        if (match3) {
            const hours = parseInt(match3[1]) || 0;
            if (hours > 0 && hours <= 24) {
                const duration = `${hours} jam`;
                console.log('✅ Found Duration (Pattern 3):', duration);
                return duration;
            }
        }

        console.log('⚠️ No Duration pattern found');
        return null;

    } catch (error) {
        console.error('❌ Parse Duration Error:', error.message);
        return null;
    }
};
/**
 * ========================================
 * ✅ ENHANCED: Multi-Platform Detection
 * ========================================
 * Detect dan parse MULTIPLE platforms dari satu screenshot
 * Mendukung dual screenshot (TikTok + Shopee bersamaan)
 * 
 * @param {string} text - Raw OCR text
 * @returns {object} {platforms: Array, primaryPlatform: string}
 */
const detectAndParsePlatform = (text) => {
    const cleanText = text.replace(/\s+/g, ' ').toUpperCase();
    
    console.log('\n🔍 ========== PLATFORM DETECTION ==========');
    console.log('📄 Text Length:', text.length, 'characters');
    
    // Detect keywords untuk setiap platform
    const isTikTok = cleanText.includes('TIKTOK') || 
                     cleanText.includes('GMV') ||
                     (cleanText.includes('LIVE') && cleanText.includes('DURASI'));
    
    const isShopee = cleanText.includes('SHOPEE') || 
                     cleanText.includes('PENJUALAN') ||
                     cleanText.includes('PRODUK TERJUAL') ||
                     cleanText.includes('PERSENTASE KLIK') ||
                     cleanText.includes('PESANAN');

    const detectedPlatforms = [];
    
    // ✅ NEW: Check TikTok
    if (isTikTok) {
        console.log('⚫ TikTok keywords detected');
        const tiktokGMV = parseTikTokGMV(cleanText);
        const tiktokDuration = parseTikTokDuration(cleanText);
        
        if (tiktokGMV > 0) {
            detectedPlatforms.push({
                platform: 'TIKTOK',
                parsedGMV: tiktokGMV,
                parsedDuration: tiktokDuration
            });
            console.log('   ✅ TikTok GMV:', tiktokGMV);
            console.log('   ✅ TikTok Duration:', tiktokDuration || 'Not found');
        }
    }
    
    // ✅ NEW: Check Shopee
    if (isShopee) {
        console.log('🟠 Shopee keywords detected');
        const shopeeGMV = parseShopeeGMV(cleanText);
        const shopeeDuration = parseShopeeDuration(cleanText);
        
        if (shopeeGMV > 0) {
            detectedPlatforms.push({
                platform: 'SHOPEE',
                parsedGMV: shopeeGMV,
                parsedDuration: shopeeDuration
            });
            console.log('   ✅ Shopee GMV:', shopeeGMV);
            console.log('   ✅ Shopee Duration:', shopeeDuration || 'Not found');
        }
    }

    // Determine primary platform (highest GMV)
    let primaryPlatform = 'TIKTOK'; // default
    if (detectedPlatforms.length > 0) {
        const sorted = detectedPlatforms.sort((a, b) => b.parsedGMV - a.parsedGMV);
        primaryPlatform = sorted[0].platform;
    }

    console.log('\n🎯 DETECTION RESULT:');
    console.log('   Total Platforms Found:', detectedPlatforms.length);
    console.log('   Primary Platform:', primaryPlatform);
    detectedPlatforms.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.platform}: GMV ${p.parsedGMV}, Duration ${p.parsedDuration || 'N/A'}`);
    });
    console.log('========== DETECTION COMPLETE ==========' + '\n');

    return {
        platforms: detectedPlatforms,           // ✅ NEW: Array of detected platforms
        primaryPlatform: primaryPlatform,       // ✅ NEW: Primary platform
        isDualPlatform: detectedPlatforms.length > 1  // ✅ NEW: Flag
    };
};
/**
 * Apply multiplier (K = 1000)
 */
const applyMultiplier = (numStr) => {
    let multiplier = 1;
    let tempStr = numStr.toUpperCase();

    // Check suffix 'K'
    if (tempStr.endsWith('K')) {
        multiplier = 1000;
        tempStr = tempStr.slice(0, -1);
    }

    // Clean dan convert to float
    const num = cleanNumber(tempStr);
    
    return num * multiplier;
};



/**
 * ========================================
 * ✅ ENHANCED: Parse Shopee GMV
 * ========================================
 * Handle berbagai format OCR:
 * - "PENJUALAN RP 142,350"
 * - "PENJUALAN(RP) 142.350"  (dengan kurung & newline)
 * - "Penjualan(Rp)\n142.350"
 * 
 * @param {string} text - Cleaned OCR text (uppercase)
 * @returns {number} GMV amount atau 0
 */
const parseShopeeGMV = (text) => {
    try {
        console.log('\n🔍 Parsing Shopee GMV...');
        console.log('📝 Input text length:', text.length);
        
        // Clean text: remove extra spaces and newlines
        const cleanedText = text.replace(/\s+/g, ' ').trim();
        console.log('🧹 Cleaned text (first 300 chars):', cleanedText.substring(0, 300));
        
        const numericRegex = /[\d.,K]+/i;

        // ========================================
        // Priority 1: PENJUALAN dengan berbagai format
        // ========================================
        
        // Format A: "PENJUALAN RP 142.350"
        // Format B: "PENJUALAN(RP) 142.350"
        // Format C: "PENJUALAN (RP) 142.350"
        const salesPattern1 = new RegExp(
            `PENJUALAN[\\s\\(]*RP[\\)\\s]*(${numericRegex.source})`,
            'i'
        );
        const salesMatch1 = cleanedText.match(salesPattern1);
        
        if (salesMatch1 && salesMatch1[1]) {
            const gmv = applyMultiplier(salesMatch1[1]);
            if (gmv > 0) {
                console.log('✅ Found Shopee GMV (Pattern 1: PENJUALAN):', gmv);
                console.log('   Match:', salesMatch1[0]);
                console.log('   Extracted number:', salesMatch1[1]);
                return gmv;
            }
        }

        // ========================================
        // Priority 2: Look for numbers AFTER "PENJUALAN" keyword
        // ========================================
        
        const penjualanIndex = cleanedText.indexOf('PENJUALAN');
        if (penjualanIndex !== -1) {
            console.log('   Found PENJUALAN keyword at index:', penjualanIndex);
            
            // Extract text after PENJUALAN (next 50 chars)
            const afterPenjualan = cleanedText.substring(penjualanIndex, penjualanIndex + 50);
            console.log('   Text after PENJUALAN:', afterPenjualan);
            
            // Find first number after PENJUALAN
            const numberMatch = afterPenjualan.match(new RegExp(numericRegex.source));
            if (numberMatch && numberMatch[0]) {
                const gmv = applyMultiplier(numberMatch[0]);
                if (gmv > 0 && gmv > 1000) { // Must be > 1000 to be valid GMV
                    console.log('✅ Found Shopee GMV (After PENJUALAN):', gmv);
                    console.log('   Extracted number:', numberMatch[0]);
                    return gmv;
                }
            }
        }

        // ========================================
        // Priority 3: TOTAL PENJUALAN
        // ========================================
        
        const totalSalesPattern = new RegExp(
            `TOTAL[\\s]*PENJUALAN[\\s\\(]*RP[\\)\\s]*(${numericRegex.source})`,
            'i'
        );
        const totalSalesMatch = cleanedText.match(totalSalesPattern);
        
        if (totalSalesMatch && totalSalesMatch[1]) {
            const gmv = applyMultiplier(totalSalesMatch[1]);
            if (gmv > 0) {
                console.log('✅ Found Shopee GMV (TOTAL PENJUALAN):', gmv);
                console.log('   Match:', totalSalesMatch[0]);
                return gmv;
            }
        }

        // ========================================
        // Priority 4: PRODUK TERJUAL keyword (alternative indicator)
        // ========================================
        
        const produkIndex = cleanedText.indexOf('PRODUK TERJUAL');
        if (produkIndex !== -1) {
            console.log('   Found PRODUK TERJUAL keyword (Shopee indicator)');
            
            // Look for largest RP value in text (likely GMV)
            const rupiahValues = [];
            const rupiahRegex = new RegExp(`RP[\\s]*(${numericRegex.source})`, 'gi');
            let match;
            
            while ((match = rupiahRegex.exec(cleanedText)) !== null) {
                const value = applyMultiplier(match[1]);
                if (value > 1000) { // Filter out small values
                    rupiahValues.push(value);
                    console.log('   Found RP value:', value);
                }
            }
            
            if (rupiahValues.length > 0) {
                const maxValue = Math.max(...rupiahValues);
                console.log('✅ Found Shopee GMV (Max RP near PRODUK TERJUAL):', maxValue);
                return maxValue;
            }
        }

        // ========================================
        // Priority 5: Generic RP pattern (as last resort)
        // ========================================
        
        console.log('   Trying generic RP pattern...');
        const rupiahAll = cleanedText.match(new RegExp(`RP[\\s]*(${numericRegex.source})`, 'gi'));
        
        if (rupiahAll && rupiahAll.length > 0) {
            console.log(`   Found ${rupiahAll.length} RP values:`, rupiahAll);
            
            const amounts = rupiahAll.map(r => {
                let numStr = r.replace(/RP[\s]*/i, '');
                return applyMultiplier(numStr);
            }).filter(n => n > 1000); // Filter: must be > 1000

            if (amounts.length > 0) {
                // If we have PENJUALAN keyword, take max value
                // Otherwise, be cautious (might be TikTok value)
                if (cleanedText.includes('PENJUALAN')) {
                    const maxAmount = Math.max(...amounts);
                    console.log('✅ Found Shopee GMV (Max Rupiah with PENJUALAN):', maxAmount);
                    console.log('   All amounts:', amounts);
                    return maxAmount;
                } else {
                    console.log('⚠️ Found RP values but no PENJUALAN keyword');
                    console.log('   Might be TikTok data, returning 0');
                    return 0;
                }
            }
        }

        console.log('⚠️ No Shopee GMV pattern found');
        return 0;

    } catch (error) {
        console.error('❌ Parse Shopee GMV Error:', error.message);
        return 0;
    }
};

/**
 * Clean number string
 */
const cleanNumber = (numStr) => {
    try {
        // Format Indonesia: titik = ribuan, koma = desimal
        let cleaned = numStr.replace(/\./g, ''); // Hapus titik (ribuan)
        cleaned = cleaned.replace(/,/g, '.'); // Koma jadi titik (desimal)
        
        // Hapus karakter non-digit/non-titik
        const finalCleaned = cleaned.replace(/[^\d.]/g, '');
        const num = parseFloat(finalCleaned);
        
        return isNaN(num) ? 0 : num;
    } catch (error) {
        return 0;
    }
};

/**
 * Validasi GMV
 */
const isValidGMV = (gmv) => {
    return gmv && gmv > 0 && gmv < 10000000000; // Max 10 Miliar
};

/**
 * Fallback TikTok parsers (simple wrappers to existing generic parsers)
 * Provided so exports reference valid functions for testing.
 */
const parseTikTokGMV = (text) => {
    console.log('\n🔁 Fallback parseTikTokGMV called');
    return parseGMVFromText(text);
};

const parseTikTokDuration = (text) => {
    console.log('\n🔁 Fallback parseTikTokDuration called');
    return parseDurationFromText(text);
};

module.exports = {
    extractTextFromImage,
    detectAndParsePlatform,    // ✅ NEW
    parseTikTokGMV,            // ✅ NEW (untuk testing)
    parseShopeeGMV,            // ✅ NEW
    parseTikTokDuration,       // ✅ NEW (untuk testing)
    parseShopeeDuration,       // ✅ NEW
    isValidGMV
};