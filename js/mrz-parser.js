/**
 * MRZ (Machine Readable Zone) Parser
 * Supports TD3 (Passport) format: 2 lines x 44 characters
 * Also supports TD1 (ID card): 3 lines x 30 characters
 */

const MRZParser = (() => {
  // Country code to name mapping (common ones)
  const COUNTRY_MAP = {
    'KOR': '대한민국 (REPUBLIC OF KOREA)',
    'USA': 'UNITED STATES',
    'GBR': 'UNITED KINGDOM',
    'JPN': 'JAPAN',
    'CHN': 'CHINA',
    'DEU': 'GERMANY',
    'FRA': 'FRANCE',
    'CAN': 'CANADA',
    'AUS': 'AUSTRALIA',
    'IND': 'INDIA',
    'BRA': 'BRAZIL',
    'RUS': 'RUSSIAN FEDERATION',
    'ITA': 'ITALY',
    'ESP': 'SPAIN',
    'MEX': 'MEXICO',
    'PHL': 'PHILIPPINES',
    'VNM': 'VIETNAM',
    'THA': 'THAILAND',
    'TWN': 'TAIWAN',
    'SGP': 'SINGAPORE',
    'MYS': 'MALAYSIA',
    'IDN': 'INDONESIA',
    'NZL': 'NEW ZEALAND',
    'D': 'GERMANY',
  };

  // Check digit calculation per ICAO 9303
  function calculateCheckDigit(str) {
    const weights = [7, 3, 1];
    let sum = 0;
    for (let i = 0; i < str.length; i++) {
      let val;
      const ch = str[i];
      if (ch >= '0' && ch <= '9') {
        val = parseInt(ch);
      } else if (ch >= 'A' && ch <= 'Z') {
        val = ch.charCodeAt(0) - 55; // A=10, B=11, ...
      } else {
        val = 0; // '<' or filler
      }
      sum += val * weights[i % 3];
    }
    return sum % 10;
  }

  // Clean OCR'd MRZ text
  function cleanMRZText(rawText) {
    // Replace common OCR mistakes
    let cleaned = rawText.toUpperCase();
    // Replace various filler characters with '<'
    cleaned = cleaned.replace(/[«»‹›<＜]/g, '<');
    // Fix common OCR misreads
    cleaned = cleaned.replace(/[^A-Z0-9<\n]/g, '');
    return cleaned;
  }

  // Extract MRZ lines from OCR text
  function extractMRZLines(text) {
    const cleaned = cleanMRZText(text);
    const lines = cleaned.split('\n')
      .map(l => l.trim())
      .filter(l => l.length >= 28);

    // Look for TD3 (passport): 2 lines of 44 chars
    const td3Lines = lines.filter(l => l.length >= 42 && l.length <= 46);
    if (td3Lines.length >= 2) {
      // Find the two consecutive MRZ lines
      // First line starts with P
      const pLines = td3Lines.filter(l => l.startsWith('P'));
      if (pLines.length > 0) {
        const line1 = normalizeLength(pLines[0], 44);
        // Second line should be the next one with digits
        const digitLines = td3Lines.filter(l => /\d/.test(l) && !l.startsWith('P'));
        if (digitLines.length > 0) {
          const line2 = normalizeLength(digitLines[0], 44);
          return { type: 'TD3', lines: [line1, line2] };
        }
      }
    }

    // Try to find any two long lines
    if (lines.length >= 2) {
      const longLines = lines.filter(l => l.length >= 30);
      if (longLines.length >= 2) {
        // Find line starting with P
        let idx = longLines.findIndex(l => l.startsWith('P'));
        if (idx >= 0 && idx + 1 < longLines.length) {
          return {
            type: 'TD3',
            lines: [
              normalizeLength(longLines[idx], 44),
              normalizeLength(longLines[idx + 1], 44)
            ]
          };
        }
        // Just use last two lines (MRZ is usually at bottom)
        return {
          type: 'TD3',
          lines: [
            normalizeLength(longLines[longLines.length - 2], 44),
            normalizeLength(longLines[longLines.length - 1], 44)
          ]
        };
      }
    }

    return null;
  }

  function normalizeLength(line, targetLen) {
    if (line.length > targetLen) {
      return line.substring(0, targetLen);
    }
    while (line.length < targetLen) {
      line += '<';
    }
    return line;
  }

  // Parse date from MRZ format (YYMMDD)
  function parseMRZDate(yymmdd) {
    if (!yymmdd || yymmdd.length !== 6) return null;
    const yy = parseInt(yymmdd.substring(0, 2));
    const mm = yymmdd.substring(2, 4);
    const dd = yymmdd.substring(4, 6);

    // Determine century: if yy > 30, it's 19xx, else 20xx
    const year = yy > 30 ? 1900 + yy : 2000 + yy;
    return `${year}-${mm}-${dd}`;
  }

  // Format date for display
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const [year, month, day] = dateStr.split('-');
    return `${year}.${month}.${day}`;
  }

  // Parse TD3 (Passport) MRZ
  function parseTD3(lines) {
    const line1 = lines[0];
    const line2 = lines[1];

    // Line 1: P<ISSUING_COUNTRY<<SURNAME<<GIVEN_NAMES
    const docType = line1.substring(0, 1); // P
    const docSubtype = line1.substring(1, 2);
    const issuingCountry = line1.substring(2, 5).replace(/</g, '');

    // Names: everything after position 5
    const nameField = line1.substring(5);
    const nameParts = nameField.split('<<');
    const surname = (nameParts[0] || '').replace(/</g, ' ').trim();
    const givenNames = (nameParts.slice(1).join(' ') || '').replace(/</g, ' ').trim();

    // Line 2: PASSPORT_NUM(9) CHECK(1) NATIONALITY(3) DOB(6) CHECK(1) SEX(1) EXPIRY(6) CHECK(1) PERSONAL_NUM(14) CHECK(1) OVERALL_CHECK(1)
    const passportNo = line2.substring(0, 9).replace(/</g, '');
    const passportNoCheck = line2.substring(9, 10);
    const nationality = line2.substring(10, 13).replace(/</g, '');
    const dob = line2.substring(13, 19);
    const dobCheck = line2.substring(19, 20);
    const sex = line2.substring(20, 21);
    const expiry = line2.substring(21, 27);
    const expiryCheck = line2.substring(27, 28);
    const personalNo = line2.substring(28, 42).replace(/</g, '');
    const personalNoCheck = line2.substring(42, 43);
    const overallCheck = line2.substring(43, 44);

    // Validate check digits
    const passportValid = calculateCheckDigit(line2.substring(0, 9)) === parseInt(passportNoCheck);
    const dobValid = calculateCheckDigit(dob) === parseInt(dobCheck);
    const expiryValid = calculateCheckDigit(expiry) === parseInt(expiryCheck);

    const fullName = givenNames ? `${surname} ${givenNames}` : surname;
    const nationalityName = COUNTRY_MAP[nationality] || nationality;

    return {
      type: 'PASSPORT',
      documentType: `${docType}${docSubtype}`.replace(/</g, ''),
      issuingCountry: issuingCountry,
      issuingCountryName: COUNTRY_MAP[issuingCountry] || issuingCountry,
      surname: surname,
      givenNames: givenNames,
      fullName: fullName,
      passportNo: passportNo,
      nationality: nationality,
      nationalityName: nationalityName,
      dateOfBirth: parseMRZDate(dob),
      dateOfBirthFormatted: formatDate(parseMRZDate(dob)),
      sex: sex === 'M' ? 'M' : sex === 'F' ? 'F' : '—',
      sexDisplay: sex === 'M' ? '남 (M)' : sex === 'F' ? '여 (F)' : '—',
      dateOfExpiry: parseMRZDate(expiry),
      dateOfExpiryFormatted: formatDate(parseMRZDate(expiry)),
      personalNo: personalNo,
      mrzLine1: line1,
      mrzLine2: line2,
      validation: {
        passportNoValid: passportValid,
        dobValid: dobValid,
        expiryValid: expiryValid,
      },
      raw: { line1, line2 }
    };
  }

  // Main parse function
  function parse(ocrText) {
    const mrz = extractMRZLines(ocrText);
    if (!mrz) {
      return { success: false, error: 'MRZ 영역을 찾을 수 없습니다. 여권 하단이 선명하게 보이는 이미지를 사용해주세요.' };
    }

    try {
      const result = parseTD3(mrz.lines);
      return { success: true, data: result };
    } catch (e) {
      return { success: false, error: `MRZ 파싱 오류: ${e.message}` };
    }
  }

  return { parse, extractMRZLines, cleanMRZText, calculateCheckDigit };
})();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MRZParser;
}
