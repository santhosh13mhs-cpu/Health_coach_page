import Tesseract from 'tesseract.js'
import { extractDataWithBLIP, pdfToImages, fileToImage } from './blipExtractor.js'

export interface ExtractedData {
  patient_name: string
  age: string
  gender: string
  lab_name: string
  doctor_name: string
  blood_sugar_fasting: string
  blood_sugar_pp: string
  hba1c_value: string
  total_cholesterol: string
  // Confidence scores (0-100, where 100 is highest confidence)
  confidence?: Record<string, number>
  // Flags for low confidence values
  low_confidence_flags?: string[]
}

export async function extractDataFromImage(file: File): Promise<ExtractedData> {
  try {
    let text = ''
    let words: any[] = []
    let blipDescription = ''

    // Try BLIP first for better understanding of image structure (especially for PDFs)
    try {
      console.log('Attempting BLIP extraction...')
      const blipResult = await extractDataWithBLIP(file)
      blipDescription = blipResult.blipDescription
      console.log('BLIP description:', blipDescription)
    } catch (blipError) {
      console.warn('BLIP extraction failed, falling back to OCR:', blipError)
    }

    // Perform OCR on the image/PDF with better settings
    // For PDFs, convert to images first
    if (file.type === 'application/pdf') {
      console.log('Processing PDF with OCR...')
      let images: HTMLImageElement[]
      try {
        images = await pdfToImages(file)
      } catch (pdfError: any) {
        console.error('PDF conversion error:', pdfError)
        // Re-throw with a more specific error message
        throw new Error(pdfError.message || 'Failed to read PDF file. Please ensure the file is a valid PDF.')
      }
      
      if (!images || images.length === 0) {
        throw new Error('Failed to convert PDF to images. The PDF may be corrupted or empty.')
      }
      
      let allText = ''
      let allWords: any[] = []

      // Process each PDF page sequentially
      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        if (!img || !img.width || !img.height) {
          console.warn(`Skipping invalid image for page ${i + 1}`)
          continue
        }
        
        console.log(`Processing PDF page ${i + 1}/${images.length} with OCR...`)
        
        try {
          // Convert image to File for Tesseract
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            console.warn(`Could not get canvas context for page ${i + 1}`)
            continue
          }
          
          ctx.drawImage(img, 0, 0)
          
          // Convert canvas to blob and then to File (properly awaited)
          const blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/png')
          })
          
          if (blob) {
            const imageFile = new File([blob], `page-${i + 1}.png`, { type: 'image/png' })
            try {
              const { data } = await Tesseract.recognize(imageFile, 'eng', {
                logger: (m) => {
                  if (m.status === 'recognizing text') {
                    console.log(`OCR Progress (Page ${i + 1}): ${Math.round(m.progress * 100)}%`)
                  }
                },
              })
              allText += `\n--- Page ${i + 1} ---\n` + data.text + '\n'
              allWords.push(...(((data as any).words || []) as any[]))
            } catch (ocrError: any) {
              console.warn(`OCR failed for page ${i + 1}:`, ocrError)
              // Continue with other pages
            }
          }
        } catch (pageError: any) {
          console.warn(`Error processing page ${i + 1}:`, pageError)
          // Continue with other pages
        }
      }

      if (!allText.trim() && images.length > 0) {
        throw new Error('Failed to extract any text from the PDF. The PDF may contain only images or be of poor quality.')
      }

      text = allText
      words = allWords
    } else {
      // For regular images, use Tesseract directly
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
          }
        },
      })

      text = data.text
      words = ((data as any).words || []) as any[]
    }
    
    console.log('Extracted text:', text)
    console.log('Text lines:', text.split('\n'))
    console.log('OCR Words with confidence:', words.map(w => ({ text: w.text, confidence: w.confidence })))
    if (blipDescription) {
      console.log('BLIP description:', blipDescription)
      // Combine BLIP understanding with OCR text for better context
      text = blipDescription + '\n' + text
    }

    // Parse the extracted text to find relevant fields with confidence scores
    const extracted = parseExtractedText(text, words)

    return extracted
  } catch (error: any) {
    console.error('Extraction Error:', error)
    // Preserve the original error message if it's user-friendly
    if (error?.message && (
      error.message.includes('PDF') || 
      error.message.includes('corrupted') || 
      error.message.includes('password') ||
      error.message.includes('read') ||
      error.message.includes('convert')
    )) {
      throw error
    }
    throw new Error(error?.message || 'Failed to extract data from image/PDF. Please try again or enter data manually.')
  }
}

interface OCRWord {
  text: string
  confidence: number
  bbox: { x0: number; y0: number; x1: number; y1: number }
}

function parseExtractedText(text: string, words: OCRWord[] = []): ExtractedData {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  const textLower = text.toLowerCase()
  const fullText = text

  // Initialize result
  const result: ExtractedData = {
    patient_name: '',
    age: '',
    gender: '',
    lab_name: '',
    doctor_name: '',
    blood_sugar_fasting: '',
    blood_sugar_pp: '',
    hba1c_value: '',
    total_cholesterol: '',
    confidence: {},
    low_confidence_flags: [],
  }

  // Helper function to calculate confidence for a matched text
  const calculateConfidence = (matchedText: string, matchIndex: number = -1): number => {
    if (!words || words.length === 0) {
      // If no word data, return medium confidence (50)
      return 50
    }

    // Find words that overlap with the matched text
    const matchedLower = matchedText.toLowerCase()
    const relevantWords = words.filter(word => {
      const wordLower = word.text.toLowerCase()
      return matchedLower.includes(wordLower) || wordLower.includes(matchedLower) || 
             matchedText.toLowerCase().includes(word.text.toLowerCase())
    })

    if (relevantWords.length === 0) {
      // Try to find words near the match position
      if (matchIndex >= 0) {
        const matchPosition = matchIndex
        const nearbyWords = words.filter(word => {
          // Check if word is near the match position in text
          const wordPos = text.toLowerCase().indexOf(word.text.toLowerCase())
          return wordPos >= 0 && Math.abs(wordPos - matchPosition) < 50
        })
        if (nearbyWords.length > 0) {
          const avgConfidence = nearbyWords.reduce((sum, w) => sum + (w.confidence || 0), 0) / nearbyWords.length
          return Math.max(0, Math.min(100, avgConfidence))
        }
      }
      return 30 // Low confidence if no matching words found
    }

    // Calculate average confidence of relevant words
    const avgConfidence = relevantWords.reduce((sum, w) => sum + (w.confidence || 0), 0) / relevantWords.length
    return Math.max(0, Math.min(100, avgConfidence))
  }

  type ExtractedField = Exclude<keyof ExtractedData, 'confidence' | 'low_confidence_flags'>

  // Helper function to set value with confidence
  const setValueWithConfidence = (
    field: ExtractedField,
    value: string,
    confidence: number,
    matchIndex: number = -1
  ) => {
    if (value && value.trim()) {
      (result as any)[field] = value
      if (!result.confidence) result.confidence = {}
      result.confidence[field as string] = confidence
      
      // Flag low confidence values (< 60)
      if (confidence < 60) {
        if (!result.low_confidence_flags) result.low_confidence_flags = []
        result.low_confidence_flags.push(field as string)
      }
    }
  }

  // ========== LINE-BY-LINE PARSING FOR STRUCTURED DATA ==========
  // Many reports have structured format, parse line by line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineLower = line.toLowerCase()
    
    // Patient Name in structured format - improved to handle "Patient Name:" label
    if (!result.patient_name && (lineLower.includes('patient name') || (lineLower.includes('name') && lineLower.includes(':')))) {
      // Try to get name from same line or next line
      let nameMatch = line.match(/(?:patient\s+name|name)[\s:]+(?:mr\.?|mrs\.?|ms\.?|miss)?\s*([A-Z][A-Za-z\s]{2,40})(?:\s|$)/i)
      if (!nameMatch && i < lines.length - 1) {
        // Check next line if current line only has the label
        const nextLine = lines[i + 1]
        if (nextLine && nextLine.match(/^(?:mr\.?|mrs\.?|ms\.?|miss)?\s*[A-Z][A-Za-z\s]{2,40}$/i)) {
          nameMatch = nextLine.match(/(?:mr\.?|mrs\.?|ms\.?|miss)?\s*([A-Z][A-Za-z\s]{2,40})/i)
        }
      }
      if (nameMatch && nameMatch[1]) {
        const name = nameMatch[1].trim()
        // Exclude lab-related terms more aggressively
        if (!name.match(/(?:years|age|sex|gender|male|female|lab|laboratory|diagnostic|hospital|centre|center|vascular|renal|mount|superspeciality|speciality|clinic|medical)/i) && 
            name.length > 2 && name.length < 50) {
          const confidence = calculateConfidence(name, text.indexOf(line))
          setValueWithConfidence('patient_name', name.replace(/\s+/g, ' '), confidence, text.indexOf(line))
        }
      }
    }
    
    // Age/Sex in structured format
    if (!result.age && (lineLower.includes('age/sex') || lineLower.includes('age :'))) {
      const ageMatch = line.match(/(?:age\/sex|age)[\s:]+(\d{2,3})\s*[\/\s]*([MF])?/i)
      if (ageMatch && ageMatch[1]) {
        const age = parseInt(ageMatch[1])
        if (age >= 18 && age < 150) {
          const confidence = calculateConfidence(ageMatch[1], text.indexOf(line))
          setValueWithConfidence('age', ageMatch[1].trim(), confidence, text.indexOf(line))
          if (!result.gender && ageMatch[2]) {
            const genderConfidence = calculateConfidence(ageMatch[2], text.indexOf(line))
            setValueWithConfidence('gender', ageMatch[2] === 'M' ? 'MALE' : 'FEMALE', genderConfidence, text.indexOf(line))
          }
        }
      }
    }
    
    // Doctor Name in structured format - improved to handle "Doctor:" label
    if (!result.doctor_name) {
      // Check for "Doctor:" or "Ref.By Dr:" patterns
      if (lineLower.includes('doctor') || (lineLower.includes('ref') && lineLower.includes('dr'))) {
        let doctorMatch = line.match(/(?:doctor|ref\.?\s*by\s*dr|referred\s+by)[\s:]+(.+?)(?:\n|$)/i)
        if (!doctorMatch && lineLower.includes('doctor') && i < lines.length - 1) {
          // Check next line if current line only has "Doctor:" label
          const nextLine = lines[i + 1]
          if (nextLine && nextLine.match(/^dr\.?\s*[A-Z]/i)) {
            doctorMatch = nextLine.match(/(dr\.?\s*[A-Z][A-Za-z\s.,]{5,80})/i)
          }
        }
        if (doctorMatch && doctorMatch[1]) {
          let doctor = doctorMatch[1].trim()
          // Clean up doctor name - remove trailing punctuation but keep qualifications
          doctor = doctor.replace(/[,\s]+$/, '').replace(/\s+/g, ' ')
          const confidence = calculateConfidence(doctor, text.indexOf(line))
          if (doctor.match(/^self/i)) {
            setValueWithConfidence('doctor_name', 'SELF', confidence, text.indexOf(line))
          } else if (doctor.length > 5 && doctor.length < 100) {
            // Allow longer doctor names with qualifications
            setValueWithConfidence('doctor_name', doctor, confidence, text.indexOf(line))
          }
        }
      }
    }
    
    // Fasting Blood Sugar in structured format - improved for table format
    if (!result.blood_sugar_fasting && (lineLower.includes('fasting') || (lineLower.includes('blood sugar') && (lineLower.includes('f') || lineLower.includes('(f)'))))) {
      // Try same line first
      let fastingMatch = line.match(/(?:fasting\s+blood\s+sugar|blood\s+sugar\s*\(?\s*f\s*\)?)[\s:]+(\d{2,3}\.?\d*)/i)
      // If not found, check if this is a table row - look for result in same line or nearby
      if (!fastingMatch) {
        // Check if line contains "fasting" and look for number nearby
        const numberMatch = line.match(/(?:fasting|blood\s+sugar\s*\(?\s*f\s*\)?)[^\d]*(\d{2,3}\.?\d*)\s*(?:mg|mgs|mg%|mg\/dl|normal|value)?/i)
        if (numberMatch) {
          fastingMatch = numberMatch
        } else if (i < lines.length - 2) {
          // Check next 2 lines for result value
          for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
            const resultLine = lines[j]
            const resultMatch = resultLine.match(/^(\d{2,3}\.?\d*)\s*(?:mg|mgs|mg%|mg\/dl)?$/i)
            if (resultMatch) {
              fastingMatch = resultMatch
              break
            }
          }
        }
      }
      if (fastingMatch && fastingMatch[1]) {
        const value = parseFloat(fastingMatch[1])
        if (value >= 50 && value < 500) {
          const confidence = calculateConfidence(fastingMatch[1], text.indexOf(line))
          setValueWithConfidence('blood_sugar_fasting', fastingMatch[1].trim(), confidence, text.indexOf(line))
        }
      }
    }
    
    // Post Prandial Blood Sugar in structured format
    if (!result.blood_sugar_pp && (lineLower.includes('post prandial') || lineLower.includes('pp') || lineLower.includes('p.p'))) {
      // Handle "BLOOD SUGAR(P.P):" format with parentheses and no space
      const ppMatch = line.match(/(?:post\s+prandial\s+blood\s+sugar|blood\s+sugar\s*\(?\s*p\.?\s*p\.?\s*\)?|blood\s+sugar\s*\(?pp\)?)[\s:]+(?:↑|↑\s*)?(\d{2,3}\.?\d*)\s*(?:mg|mgs|mg%|mg\/dl)?/i)
      if (ppMatch && ppMatch[1]) {
        const value = parseFloat(ppMatch[1])
        if (value >= 50 && value < 500) {
          const confidence = calculateConfidence(ppMatch[1], text.indexOf(line))
          setValueWithConfidence('blood_sugar_pp', ppMatch[1].trim(), confidence, text.indexOf(line))
        }
      }
    }
    
    // HbA1c in structured format - improved for table format
    if (!result.hba1c_value && lineLower.includes('hba1c')) {
      // Try same line first
      let hba1cMatch = line.match(/(?:hba1c|hba\s*1c|hba1c\s*\(?\s*biorad\s*\)?)[\s:]*(\d+\.?\d*)\s*%/i)
      // If not found, check if this is a table row - look for result in same line or nearby
      if (!hba1cMatch) {
        // Check if line contains "hba1c" and look for number with % nearby
        const numberMatch = line.match(/(?:hba1c|hba\s*1c)[^\d]*(\d+\.?\d*)\s*%/i)
        if (numberMatch) {
          hba1cMatch = numberMatch
        } else if (i < lines.length - 2) {
          // Check next 2 lines for result value with %
          for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
            const resultLine = lines[j]
            const resultMatch = resultLine.match(/^(\d+\.?\d*)\s*%$/i)
            if (resultMatch) {
              hba1cMatch = resultMatch
              break
            }
          }
        }
      }
      if (hba1cMatch && hba1cMatch[1]) {
        const value = parseFloat(hba1cMatch[1])
        // Check if it's not a common reference range value or if it's clearly a result
        if (value >= 3.0 && value < 15.0) {
          // Check if it's NOT in a range context (like "4.0 to 6.0")
          const isRangeContext = line.match(/(?:to|and|-|>|<|range|diabetic|non|control|good|fair|poor|normal\s+value)/i)
          // If it's a single value with % and not in range context, it's likely a result
          if (!isRangeContext || (value !== 4.0 && value !== 6.0 && value !== 8.0)) {
            const confidence = calculateConfidence(hba1cMatch[1], text.indexOf(line))
            setValueWithConfidence('hba1c_value', hba1cMatch[1].trim(), confidence, text.indexOf(line))
          }
        }
      }
    }
  }

  // ========== EXTRACT PATIENT NAME ==========
  // Strategy: Look for "Patient Name:" or "Name:" followed by name, or "Mr./Mrs." patterns
  const namePatterns = [
    // Pattern 1: "Patient Name:" or "Name:" followed by name (improved)
    /(?:patient\s+name|name)[\s:]+(?:mr\.?|mrs\.?|ms\.?|miss)?\s*([A-Z][A-Za-z\s]{2,40}?)(?:\s|age|sex|gender|male|female|years|yrs|yr|\/|received|ref|date|doctor|dr|$)/i,
    // Pattern 2: "MR." or "MRS." followed by name (most common in reports) - improved
    /(?:mr\.?|mrs\.?|ms\.?|miss)\s+([A-Z][A-Za-z\s]{2,40}?)(?:\s|age|sex|gender|male|female|years|yrs|yr|\/|received|ref|date|doctor|dr|$)/i,
  ]
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const name = match[1].trim()
      // Validate it's not a common false positive - more aggressive exclusion
      if (!name.match(/(?:years|age|sex|gender|male|female|lab|laboratory|diagnostic|report|date|blood|sugar|glucose|hba1c|patient|name|doctor|dr|ref|by|sample|collection|received|reported|technician|microbiologist|unit|group|vignash|jeyasurya|mount|st\.?\s*vincent|superspeciality|speciality|hospital|hospitals|centre|center|vascular|renal|clinic|medical|and)/i) &&
          name.length > 2 && name.length < 50) {
        result.patient_name = name.replace(/\s+/g, ' ')
        break
      }
    }
  }

  // If still not found, search line by line for name patterns
  if (!result.patient_name) {
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i]
      // Look for "Mr." or "Mrs." followed by name
      const mrMatch = line.match(/(?:mr\.?|mrs\.?|ms\.?|miss)\s+([A-Z][A-Za-z\s]{2,40})/i)
      if (mrMatch && mrMatch[1]) {
        const name = mrMatch[1].trim()
        // More aggressive exclusion of lab/hospital terms
        if (!name.match(/(?:lab|laboratory|diagnostic|report|date|blood|sugar|glucose|hba1c|patient|name|age|sex|gender|doctor|dr|ref|by|sample|collection|received|reported|technician|microbiologist|unit|group|vignash|jeyasurya|mount|st\.?\s*vincent|established|estd|years|superspeciality|speciality|hospital|hospitals|centre|center|vascular|renal|clinic|medical|and)/i) &&
            name.length > 2 && name.length < 50) {
          result.patient_name = name.replace(/\s+/g, ' ')
          break
        }
      }
      // Also check for lines that look like names (capitalized, reasonable length, not common words)
      if (line.match(/^[A-Z][A-Za-z\s]{2,40}$/) && 
          !line.match(/(?:lab|laboratory|diagnostic|report|date|blood|sugar|glucose|hba1c|patient|name|age|sex|gender|doctor|dr|ref|by|sample|collection|received|reported|technician|microbiologist|unit|group|vignash|jeyasurya|mount|st\.?\s*vincent|established|estd|years|male|female|superspeciality|speciality|hospital|hospitals|centre|center|vascular|renal|clinic|medical|and)/i) &&
          !line.match(/^\d+/) &&
          line.length > 2 && line.length < 50) {
        const confidence = calculateConfidence(line, text.indexOf(line))
        setValueWithConfidence('patient_name', line.trim(), confidence, text.indexOf(line))
        break
      }
    }
  }

  // ========== EXTRACT AGE ==========
  // Only if not found in line-by-line parsing
  if (!result.age) {
    // Priority: Look for "Age/Sex:" pattern first (most reliable)
    const ageSexMatch = text.match(/(?:age\/sex|age\s*\/\s*sex)[\s:]*(\d{2,3})\s*[\/\s]*([MF])/i)
    if (ageSexMatch && ageSexMatch[1]) {
      const age = parseInt(ageSexMatch[1])
      if (age >= 18 && age < 150) {
        const confidence = calculateConfidence(ageSexMatch[1], ageSexMatch.index || -1)
        setValueWithConfidence('age', ageSexMatch[1].trim(), confidence, ageSexMatch.index || -1)
        if (!result.gender && ageSexMatch[2]) {
          const genderConfidence = calculateConfidence(ageSexMatch[2], ageSexMatch.index || -1)
          setValueWithConfidence('gender', ageSexMatch[2] === 'M' ? 'MALE' : 'FEMALE', genderConfidence, ageSexMatch.index || -1)
        }
      }
    }

    // If not found, try other age patterns
    if (!result.age) {
      const agePatterns = [
        /age[\s\/:]+(\d{2,3})\s*(?:years?|yrs?|yr|y)?/i,
        /(\d{2,3})\s*(?:years?|yrs?|yr)\s*(?:old|of\s+age)?/i,
        /(\d{2,3})\s*\/\s*[MF]/i, // Pattern like "61/M" or "43/M"
      ]
      
      for (const pattern of agePatterns) {
        const match = text.match(pattern)
        if (match && match[1]) {
          const age = parseInt(match[1])
          // Prefer ages between 18-100 for adults (most common in medical reports)
          if (age >= 18 && age < 150) {
            const confidence = calculateConfidence(match[1], match.index || -1)
            setValueWithConfidence('age', match[1].trim(), confidence, match.index || -1)
            break
          } else if (age > 0 && age < 150 && !result.age) {
            // Keep as fallback
            const confidence = calculateConfidence(match[1], match.index || -1)
            setValueWithConfidence('age', match[1].trim(), confidence, match.index || -1)
          }
        }
      }
    }
  }

  // ========== EXTRACT GENDER ==========
  // Only if not found in line-by-line parsing
  if (!result.gender) {
    const maleMatch = textLower.match(/\bmale\b/)
    if (maleMatch) {
      const confidence = calculateConfidence('male', maleMatch.index || -1)
      setValueWithConfidence('gender', 'MALE', confidence, maleMatch.index || -1)
    } else {
      const femaleMatch = textLower.match(/\bfemale\b/)
      if (femaleMatch) {
        const confidence = calculateConfidence('female', femaleMatch.index || -1)
        setValueWithConfidence('gender', 'FEMALE', confidence, femaleMatch.index || -1)
      } else {
        // Look for M/F pattern in various formats
        const genderMatch = text.match(/(?:age\/sex|sex|gender)[\s:]*\d+\s*[\/\s]+([MF])/i) || 
                           text.match(/\d{2,3}\s*\/\s*([MF])/i) ||
                           text.match(/\b([MF])\b(?:\s|$)/)
        if (genderMatch) {
          const confidence = calculateConfidence(genderMatch[1], genderMatch.index || -1)
          setValueWithConfidence('gender', genderMatch[1] === 'M' ? 'MALE' : 'FEMALE', confidence, genderMatch.index || -1)
        }
      }
    }
  }

  // ========== EXTRACT LAB NAME ==========
  // Only if not found in line-by-line parsing
  if (!result.lab_name) {
    // Look for lab names in header area - handle various formats
    const labPatterns = [
      // Pattern: "JOTHI X-RAY, E.C.G. & LABORATORY A/c" - full lab name with special characters
      /([A-Z][A-Za-z\s&.,'-]{5,100}?)\s+(?:lab|laboratory|laboratories|diagnostic|centre|center|hospital)\s*(?:a\/c|ac|account)?/i,
      // Pattern: "(A Unit of ... Laboratories)" - common format
      /\(?\s*A\s+Unit\s+of\s+([A-Z][A-Za-z\s&.,'-]{5,60}?)\s*(?:laborator|lab)/i,
      // Pattern: Lab name before "Lab" or "Laboratory" (more flexible length)
      /([A-Z][A-Za-z\s&.,'-]{5,100}?)\s+(?:lab|laboratory|laboratories|diagnostic|centre|center|hospital)/i,
      // Pattern: "Lab:" or "Laboratory:" followed by name
      /(?:lab|laboratory|diagnostic|centre|center)[\s:]+([A-Z][A-Za-z\s&.,'-]{5,100}?)(?:\n|address|phone|email|established|estd|patient|name)/i,
    ]
    
    for (const pattern of labPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        let labName = match[1].trim().replace(/\s+/g, ' ')
        
        // Special handling for "Vignash Group" pattern
        if (labName.match(/vignash\s+group/i) && !labName.match(/laborator/i)) {
          labName = 'A Unit of Vignash Group of Laboratories'
        } else if (text.match(/\(?\s*A\s+Unit\s+of/i) && labName.match(/^[A-Z]/)) {
          // Try to get full "A Unit of ..." pattern
          const unitMatch = text.match(/(\(?\s*A\s+Unit\s+of\s+[A-Za-z\s&.,'-]+?laborator)/i)
          if (unitMatch) {
            labName = unitMatch[1].replace(/[()]/g, '').trim()
          }
        }
        
        // Filter out false positives
        if (!labName.match(/(?:patient|name|age|sex|gender|doctor|blood|sugar|glucose|report|date|sample|collection|received|reported)/i) &&
            labName.length > 5) {
          const confidence = calculateConfidence(labName, match.index || -1)
          setValueWithConfidence('lab_name', labName, confidence, match.index || -1)
          break
        }
      }
    }

    // Special handling for known lab names - extract full context
    if (!result.lab_name) {
      const knownLabs = [
        /jothi\s+x[\s-]?ray/i,
        /jeyasurya\s+lab/i,
        /mount\s+superspeciality/i,
        /mount\s+superspeciafity/i, // Handle typo
        /st\.?\s*vincent/i,
        /thyrocare/i,
        /sam\s+diagnostics/i,
      ]
      
      for (const labPattern of knownLabs) {
        const match = text.match(labPattern)
        if (match) {
          // Extract the full lab name from context - look for text before and after
          const matchIndex = match.index || 0
          const beforeContext = text.substring(Math.max(0, matchIndex - 80), matchIndex)
          const afterContext = text.substring(matchIndex, matchIndex + 100)
          
          // Try to extract full lab name - improved pattern
          const fullMatch = text.match(new RegExp(`([A-Z][A-Za-z\s&.,'-]{0,60}?${labPattern.source.replace(/\\/g, '')}[A-Za-z\s&.,'-]{0,60}?(?:lab|laboratory|laboratories|diagnostic|centre|center|hospital|hospitals)?(?:\\s*(?:a\\/c|ac|account))?)`, 'i'))
          if (fullMatch) {
            let fullLabName = fullMatch[1].trim().replace(/\s+/g, ' ')
            // Fix common typos
            fullLabName = fullLabName.replace(/superspeciafity/gi, 'Superspeciality')
            // Ensure it includes additional parts if present (like "RENAL AND VASCULAR CENTRE")
            if (afterContext.match(/(?:renal|vascular|centre|center)/i) && !fullLabName.match(/(?:renal|vascular)/i)) {
              const additionalMatch = text.substring(matchIndex, matchIndex + 150).match(/([A-Za-z\s&.,'-]+?(?:renal|vascular)[A-Za-z\s&.,'-]*?(?:centre|center)?)/i)
              if (additionalMatch) {
                fullLabName = (fullLabName + ' ' + additionalMatch[1]).trim()
              }
            }
            // Ensure it includes "HOSPITALS" if present
            if (afterContext.match(/hospitals/i) && !fullLabName.match(/hospitals/i)) {
              const hospitalsMatch = text.substring(matchIndex, matchIndex + 100).match(/([A-Za-z\s&.,'-]+?hospitals)/i)
              if (hospitalsMatch) {
                fullLabName = hospitalsMatch[1].trim() + ' ' + fullLabName.replace(hospitalsMatch[1], '').trim()
                fullLabName = fullLabName.trim()
              }
            }
            const confidence = calculateConfidence(fullLabName, fullMatch.index || -1)
            setValueWithConfidence('lab_name', fullLabName, confidence, fullMatch.index || -1)
            break
          }
        }
      }
    }
  }

  // ========== EXTRACT DOCTOR NAME ==========
  // Only if not found in line-by-line parsing
  if (!result.doctor_name) {
    // Look for "Doctor:" or "Ref.By Dr:" patterns - improved
    const doctorPatterns = [
      // Pattern: "Doctor:" followed by name (may be on next line)
      /(?:doctor)[\s:]+(.+?)(?:\n|date|sample|report|collection|received|bill|report\s+no|$)/i,
      // Pattern: "REF. BY: DR. SELF" or "REF. BY : DR. SELF" (with colon and space)
      /(?:ref\.?\s*by|referred\s+by|ref\s+by)[\s:]+dr\.?\s*([A-Z][A-Za-z\s.,]{0,80}?)(?:\n|date|sample|report|collection|received|bill|report\s+no|$)/i,
      // Pattern: "Ref.By Dr:" or "Ref By Dr:" followed by name or SELF
      /(?:ref\.?\s*by\s*dr|referred\s+by|ref\s+by\s*dr)[\s:]+([A-Z][A-Za-z\s.,]{2,80}?)(?:\n|date|sample|report|collection|received|self|$)/i,
      // Pattern: "Dr." followed by name with qualifications
      /(?:dr\.?)[\s:]*([A-Z][A-Za-z\s.,]{3,80}?)(?:\n|date|sample|report|collection|received|self|$)/i,
    ]
    
    for (const pattern of doctorPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        let doctorName = match[1].trim()
        // Clean up - remove trailing punctuation but keep qualifications
        doctorName = doctorName.replace(/[,\s]+$/, '').replace(/\s+/g, ' ')
        // Check if it's "SELF" or similar
        if (doctorName.match(/^self/i)) {
          setValueWithConfidence('doctor_name', 'SELF', calculateConfidence('SELF', match.index || -1), match.index || -1)
          break
        }
        // Filter out false positives but allow longer names with qualifications
        if (!doctorName.match(/(?:patient|name|age|sex|gender|blood|sugar|glucose|report|date|sample|collection|received|reported)/i) &&
            doctorName.length > 3 && doctorName.length < 100) {
          const confidence = calculateConfidence(doctorName, match.index || -1)
          setValueWithConfidence('doctor_name', doctorName, confidence, match.index || -1)
          break
        }
      }
    }
    
    // Also check for "Doctor:" label followed by name on next line
    if (!result.doctor_name) {
      for (let i = 0; i < Math.min(lines.length - 1, 30); i++) {
        const line = lines[i]
        if (line.toLowerCase().includes('doctor') && line.toLowerCase().includes(':')) {
          const nextLine = lines[i + 1]
          if (nextLine && nextLine.match(/^dr\.?\s*[A-Z]/i)) {
            const doctorMatch = nextLine.match(/(dr\.?\s*[A-Z][A-Za-z\s.,]{5,80})/i)
            if (doctorMatch) {
              const doctorName = doctorMatch[1].trim().replace(/\s+/g, ' ')
              const confidence = calculateConfidence(doctorName, text.indexOf(nextLine))
              setValueWithConfidence('doctor_name', doctorName, confidence, text.indexOf(nextLine))
              break
            }
          }
        }
      }
    }

    // Special handling for "SELF" case - check various formats including "REF. BY: DR. SELF"
    if (!result.doctor_name || result.doctor_name === '') {
      const selfPatterns = [
        /(?:ref\.?\s*by|referred\s+by|ref\s+by)[\s:]+dr\.?\s*self/i,
        /(?:ref\.?\s*by\s*dr|referred\s+by|ref\s+by)[\s:]*self/i,
      ]
      for (const pattern of selfPatterns) {
        const match = text.match(pattern)
        if (match) {
          setValueWithConfidence('doctor_name', 'SELF', calculateConfidence('SELF', match.index || -1), match.index || -1)
          break
        }
      }
    }
  }

  // ========== EXTRACT BLOOD SUGAR (FASTING) ==========
  // Only if not found in line-by-line parsing
  if (!result.blood_sugar_fasting) {
    // Look for "Fasting Blood Sugar" with value - be very specific to avoid false positives
    const fastingPatterns = [
      // Pattern: "Fasting Blood Sugar:" followed by value with units
      /(?:fasting\s+blood\s+sugar|blood\s+sugar\s*\(?\s*f(?:asting)?\s*\)?)[\s:]+(\d+\.?\d*)\s*(?:mg\/?dl|mg\s*%|mgs\/dl|mg%)/i,
      // Pattern: "Fasting" or "F" followed by value with units
      /(?:fasting|f\.?|fbs)[\s:]+(\d+\.?\d*)\s*(?:mg\/?dl|mg\s*%|mgs\/dl|mg%)/i,
      // Pattern: In table format - "Fasting Blood Sugar" on one line, value on next
      /fasting\s+blood\s+sugar[^\d]*(\d+\.?\d*)\s*(?:mg|mgs)/i,
      // Pattern: "Bl.Sugar (F):" or "Bl Sugar (F):"
      /bl\.?\s*sugar\s*\(f\)[\s:]*(\d+\.?\d*)/i,
      // Pattern: Look for value near "fasting" keyword (more flexible)
      /fasting[^\d]{0,20}(\d{2,3}\.?\d*)\s*(?:mg|mgs|normal|value)/i,
      // Pattern: Table format - "Blood Sugar (Fasting)" test name, then result
      /blood\s+sugar\s*\(?\s*fasting\s*\)?[^\d]{0,50}(\d{2,3}\.?\d*)\s*(?:mg|mgs|mg\/dl)?/i,
    ]
    
    for (const pattern of fastingPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const value = parseFloat(match[1])
        // Blood sugar should be between 50-500 mg/dl for fasting (realistic range)
        if (value >= 50 && value < 500) {
          const confidence = calculateConfidence(match[1], match.index || -1)
          setValueWithConfidence('blood_sugar_fasting', match[1].trim(), confidence, match.index || -1)
          break
        }
      }
    }
    
    // Table-based extraction: Look for "Blood Sugar (Fasting)" or similar, then find result in nearby lines
    if (!result.blood_sugar_fasting) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineLower = line.toLowerCase()
        if ((lineLower.includes('blood sugar') && (lineLower.includes('fasting') || lineLower.includes('(f)'))) ||
            (lineLower.includes('fasting') && lineLower.includes('blood'))) {
          // Check current line for result
          const sameLineMatch = line.match(/(\d{2,3}\.?\d*)\s*(?:mg|mgs|mg\/dl|mg%)/i)
          if (sameLineMatch) {
            const value = parseFloat(sameLineMatch[1])
            if (value >= 50 && value < 500) {
              const confidence = calculateConfidence(sameLineMatch[1], text.indexOf(line))
              setValueWithConfidence('blood_sugar_fasting', sameLineMatch[1].trim(), confidence, text.indexOf(line))
              break
            }
          }
          // Check next few lines for result value
          for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
            const resultLine = lines[j]
            const resultMatch = resultLine.match(/^(\d{2,3}\.?\d*)\s*(?:mg|mgs|mg\/dl|mg%)?$/i)
            if (resultMatch) {
              const value = parseFloat(resultMatch[1])
              if (value >= 50 && value < 500) {
                const confidence = calculateConfidence(resultMatch[1], text.indexOf(resultLine))
                setValueWithConfidence('blood_sugar_fasting', resultMatch[1].trim(), confidence, text.indexOf(resultLine))
                break
              }
            }
          }
          if (result.blood_sugar_fasting) break
        }
      }
    }
  }

  // ========== EXTRACT BLOOD SUGAR (POST-PRANDIAL/PP) ==========
  // Only if not found in line-by-line parsing
  if (!result.blood_sugar_pp) {
    const ppPatterns = [
      // Pattern: "BLOOD SUGAR(P.P):" or "BLOOD SUGAR (P.P):" with parentheses (no space before P.P)
      /(?:blood\s+sugar\s*\(?\s*p\.?\s*p\.?\s*\)?|blood\s+sugar\s*\(?\s*pp\s*\)?)[\s:]+(?:↑|↑\s*)?(\d+\.?\d*)\s*(?:mg\/?dl|mg\s*%|mgs\/dl|mg%|mg)/i,
      // Pattern: "Post Prandial Blood Sugar" or "PP" with value
      /(?:post\s+prandial\s+blood\s+sugar|post\s+meal\s+blood\s+sugar|blood\s+sugar\s*\(?\s*(?:pp|post\s+prandial|post\s+meal)\s*\)?)[\s:]+(?:↑|↑\s*)?(\d+\.?\d*)\s*(?:mg\/?dl|mg\s*%|mgs\/dl|mg%)/i,
      // Pattern: "PPBS", "PP", "Post Prandial", "Post Meal" followed by value with units
      /(?:ppbs|pp|post\s+prandial|post\s+meal|p\.?p\.?)[\s:]+(?:↑|↑\s*)?(\d+\.?\d*)\s*(?:mg\/?dl|mg\s*%|mgs\/dl|mg%)/i,
      // Pattern: In table format
      /(?:post\s+prandial\s+blood\s+sugar|post\s+meal\s+blood\s+sugar|ppbs|pp|blood\s+sugar\s*\(?\s*p\.?\s*p\.?\s*\)?)[^\d]*(?:↑|↑\s*)?(\d+\.?\d*)\s*(?:mg|mgs)/i,
      // Pattern: "Bl.Sugar (PP):" or "BI.Sugar (PP):" or "BI.sugar (PP)"
      /(?:bl|bi)\.?\s*sugar\s*\(pp\)[\s:]*(?:↑|↑\s*)?(\d+\.?\d*)/i,
      // Pattern: Look for value near "pp" or "post prandial" keyword
      /(?:pp|ppbs|post\s+prandial|post\s+meal|blood\s+sugar\s*\(?\s*p\.?\s*p\.?\s*\)?)[^\d]{0,20}(?:↑|↑\s*)?(\d{2,3}\.?\d*)\s*(?:mg|mgs|normal|value|upto)/i,
    ]
    
    for (const pattern of ppPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        const value = parseFloat(match[1])
        // Blood sugar should be between 50-500 mg/dl for PP (realistic range)
        if (value >= 50 && value < 500) {
          const confidence = calculateConfidence(match[1], match.index || -1)
          setValueWithConfidence('blood_sugar_pp', match[1].trim(), confidence, match.index || -1)
          break
        }
      }
    }
  }

  // ========== EXTRACT HbA1c ==========
  // Only if not found in line-by-line parsing
  if (!result.hba1c_value) {
    // Handle alternate labels: HBA1C, HBA1C (BIORAD), HbA1c
    // First, find all HbA1c mentions and their contexts - handle space before BIORAD
    const hba1cPatterns = [
      // Pattern: "HBA1C (BIORAD): 5.4%" - with parentheses and space
      /(?:hba1c|hba\s*1c)\s*\(?\s*biorad\s*\)?[\s:]+(\d+\.?\d*)\s*%/i,
      // Pattern: "HBA1C: 5.4%" - simple format
      /(?:hba1c|hba\s*1c)[\s:]+(\d+\.?\d*)\s*%/i,
      // Pattern: "HBA1C (BIORAD) 5.4%" - without colon
      /(?:hba1c|hba\s*1c)\s*\(?\s*biorad\s*\)?\s+(\d+\.?\d*)\s*%/i,
    ]
    
    for (const pattern of hba1cPatterns) {
      const matches = [...text.matchAll(new RegExp(pattern.source, 'gi'))]
      
      for (const match of matches) {
        const value = parseFloat(match[1])
        const matchIndex = match.index || 0
        const contextBefore = text.substring(Math.max(0, matchIndex - 30), matchIndex)
        const contextAfter = text.substring(matchIndex, matchIndex + 50)
        
        // Valid HbA1c should be between 3.0 and 15.0
        if (value >= 3.0 && value < 15.0) {
          // For values like 5.4, 5.5, 6.5, etc. (not common range boundaries), accept them
          // Only be strict about 4.0, 6.0, 8.0 which are common in reference ranges
          if (value === 4.0 || value === 6.0 || value === 8.0) {
            // Check if it's in a range context (like "4.0 to 6.0" or "Normal Value: 4.0 to 6.0")
            if (contextAfter.match(/(?:to|and|-|>|<|range|diabetic|non|control|good|fair|poor|normal\s+value)/i) ||
                contextBefore.match(/(?:to|and|-|>|<|range|diabetic|non|control|good|fair|poor|normal\s+value)/i)) {
              continue // Skip this match, it's likely a range
            }
          }
          
          // If it's followed by "Result:" or in a result column, or just a single value, accept it
          // Also accept if it's NOT in a range context
          if (contextAfter.match(/(?:result|value|mg|%|method|units|calculated|micro|column)/i) ||
              !contextAfter.match(/(?:to|and|-|>|<|range|diabetic|non|control|normal\s+value)/i) ||
              (value !== 4.0 && value !== 6.0 && value !== 8.0)) {
            const confidence = calculateConfidence(match[1], matchIndex)
            setValueWithConfidence('hba1c_value', match[1].trim(), confidence, matchIndex)
            break // Found a valid match, stop searching
          }
        }
      }
      
      // If we found a value, break from the pattern loop
      if (result.hba1c_value) {
        break
      }
    }
    
    // Table-based extraction: Look for "HbA1c" test name, then find result in nearby lines
    if (!result.hba1c_value) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineLower = line.toLowerCase()
        if (lineLower.includes('hba1c') || lineLower.includes('hba 1c')) {
          // Check current line for result with %
          const sameLineMatch = line.match(/(\d+\.?\d*)\s*%/i)
          if (sameLineMatch) {
            const value = parseFloat(sameLineMatch[1])
            if (value >= 3.0 && value < 15.0) {
              // Check if it's not in a range context
              const isRangeContext = line.match(/(?:to|and|-|>|<|range|diabetic|non|control|normal\s+value)/i)
              if (!isRangeContext || (value !== 4.0 && value !== 6.0 && value !== 8.0)) {
                const confidence = calculateConfidence(sameLineMatch[1], text.indexOf(line))
                setValueWithConfidence('hba1c_value', sameLineMatch[1].trim(), confidence, text.indexOf(line))
                break
              }
            }
          }
          // Check next few lines for result value with %
          for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
            const resultLine = lines[j]
            const resultMatch = resultLine.match(/^(\d+\.?\d*)\s*%$/i)
            if (resultMatch) {
              const value = parseFloat(resultMatch[1])
              if (value >= 3.0 && value < 15.0) {
                // Check if it's not in a range context
                const isRangeContext = resultLine.match(/(?:to|and|-|>|<|range|diabetic|non|control|normal\s+value)/i)
                if (!isRangeContext || (value !== 4.0 && value !== 6.0 && value !== 8.0)) {
                  const confidence = calculateConfidence(resultMatch[1], text.indexOf(resultLine))
                  setValueWithConfidence('hba1c_value', resultMatch[1].trim(), confidence, text.indexOf(resultLine))
                  break
                }
              }
            }
          }
          if (result.hba1c_value) break
        }
      }
    }

    // If still not found, try simpler pattern - be more lenient
    if (!result.hba1c_value) {
      const simplePatterns = [
        /hba1c[^\d]*(\d+\.?\d*)\s*%/i,
        /hba\s*1c[^\d]*(\d+\.?\d*)\s*%/i,
      ]
      
      for (const pattern of simplePatterns) {
        const simpleMatch = text.match(pattern)
        if (simpleMatch) {
          const value = parseFloat(simpleMatch[1])
          const matchIndex = simpleMatch.index || 0
          const contextAfter = text.substring(matchIndex, matchIndex + 50)
          
          // Accept if it's a valid range and not clearly a reference range
          if (value >= 3.0 && value < 15.0) {
            // Only reject if it's a common range boundary AND in range context
            if ((value === 4.0 || value === 6.0 || value === 8.0) &&
                contextAfter.match(/(?:to|and|-|>|<|range|diabetic|non|control|normal\s+value)/i)) {
              continue // Skip this one
            } else {
              // Accept this value
              const confidence = calculateConfidence(simpleMatch[1], matchIndex)
              setValueWithConfidence('hba1c_value', simpleMatch[1].trim(), confidence, matchIndex)
              break
            }
          }
        }
      }
    }
  }

  // ========== EXTRACT TOTAL CHOLESTEROL ==========
  // Handle various labels: Total Cholesterol, Total Cholestral, Cholesterol, CHOL, SERUM CHOLESTROL
  const cholesterolPatterns = [
    // Pattern: "SERUM CHOLESTROL:" or "SERUM CHOLESTEROL:" (common in reports)
    /(?:serum\s+cholestrol|serum\s+cholesterol)[\s:]+(\d+\.?\d*)\s*(?:mg\/?dl|mg\s*%|mgs\/dl|mg%|mg\/dl|mg)/i,
    // Pattern: "Total Cholesterol:" or "Total Cholestral:" with value and units
    /(?:total\s+cholesterol|total\s+cholestral|cholesterol|chol)[\s:]+(\d+\.?\d*)\s*(?:mg\/?dl|mg\s*%|mgs\/dl|mg%|mg\/dl)/i,
    // Pattern: "CHOL" or "Cholesterol" followed by value
    /(?:chol|cholesterol|cholestrol)[\s:]+(\d+\.?\d*)\s*(?:mg|mgs)/i,
    // Pattern: In table format
    /(?:total\s+cholesterol|total\s+cholestral|serum\s+cholestrol|serum\s+cholesterol)[^\d]*(\d+\.?\d*)\s*(?:mg|mgs)/i,
  ]
  
  for (const pattern of cholesterolPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      const value = parseFloat(match[1])
      // Total cholesterol should be between 100-400 mg/dL (realistic range)
      if (value >= 100 && value < 400) {
        const confidence = calculateConfidence(match[1], match.index || -1)
        setValueWithConfidence('total_cholesterol', match[1].trim(), confidence, match.index || -1)
        break
      }
    }
  }
  
  // Also check in line-by-line format
  if (!result.total_cholesterol) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLower = line.toLowerCase()
      
      if (lineLower.includes('cholesterol') || lineLower.includes('cholestral') || lineLower.includes('chol') || lineLower.includes('serum')) {
        const cholMatch = line.match(/(?:total\s+cholesterol|total\s+cholestral|serum\s+cholestrol|serum\s+cholesterol|cholesterol|chol)[\s:]+(\d+\.?\d*)/i)
        if (cholMatch && cholMatch[1]) {
          const value = parseFloat(cholMatch[1])
          if (value >= 100 && value < 400) {
            const confidence = calculateConfidence(cholMatch[1], text.indexOf(line))
            setValueWithConfidence('total_cholesterol', cholMatch[1].trim(), confidence, text.indexOf(line))
            break
          }
        }
      }
    }
  }

  // ========== CLEAN UP AND VALIDATE EXTRACTED VALUES ==========
  // Clean patient name
  if (result.patient_name) {
    result.patient_name = result.patient_name.replace(/\s+/g, ' ').trim()
    // Remove if it's clearly not a name
    if (result.patient_name.match(/^(years|age|sex|gender|male|female|lab|doctor|dr|blood|sugar|technician|microbiologist|unit|group|vignash|jeyasurya|mount|st\.?\s*vincent)$/i) ||
        result.patient_name.length < 2) {
      result.patient_name = ''
    }
  }

  // Clean lab name - ensure completeness
  if (result.lab_name) {
    result.lab_name = result.lab_name.replace(/\s+/g, ' ').trim()
    // If it mentions "Vignash Group" but doesn't have "Laboratories", add it
    if (result.lab_name.match(/vignash\s+group/i) && !result.lab_name.match(/laborator/i)) {
      result.lab_name = 'A Unit of Vignash Group of Laboratories'
    }
    // Remove if it contains patient info
    if (result.lab_name.match(/^(patient|name|age|sex|gender|doctor|dr|blood|sugar)$/i) ||
        result.lab_name.length < 5) {
      result.lab_name = ''
    }
  }

  // Clean doctor name
  if (result.doctor_name && result.doctor_name !== 'SELF') {
    result.doctor_name = result.doctor_name.replace(/\s+/g, ' ').trim()
    // Remove if it's not a doctor name
    if (result.doctor_name.match(/^(patient|name|age|sex|gender|blood|sugar|report|date|sample|collection|received|reported)$/i) ||
        result.doctor_name.length < 2) {
      result.doctor_name = ''
    }
  }

  // Final validation: if age seems wrong, try to find better match
  if (result.age && parseInt(result.age) < 18) {
    // Look for age in context of "Age/Sex" pattern more carefully
    const ageSexMatch = text.match(/(?:age|age\/sex)[\s:]*(\d{2,3})\s*[\/\s]*[MF]/i)
    if (ageSexMatch && parseInt(ageSexMatch[1]) >= 18) {
      result.age = ageSexMatch[1]
    }
  }

  console.log('Final extracted data:', result)
  console.log('Confidence scores:', result.confidence)
  console.log('Low confidence flags:', result.low_confidence_flags)
  return result
}

// Function to convert extracted data to the requested JSON format
export function formatExtractedDataAsJSON(extracted: ExtractedData): {
  patient_name: string
  age: string
  gender: string
  doctor_name: string
  lab_name: string
  sugar_fasting: string
  sugar_pp: string
  hba1c: string
  total_cholestral: string
} {
  return {
    patient_name: extracted.patient_name || '',
    age: extracted.age || '',
    gender: extracted.gender || '',
    doctor_name: extracted.doctor_name || '',
    lab_name: extracted.lab_name || '',
    sugar_fasting: extracted.blood_sugar_fasting || '',
    sugar_pp: extracted.blood_sugar_pp || '',
    hba1c: extracted.hba1c_value || '',
    total_cholestral: extracted.total_cholesterol || '',
  }
}

