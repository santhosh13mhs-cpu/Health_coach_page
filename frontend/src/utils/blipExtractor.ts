// Dynamic import for transformers to handle potential loading issues
let transformersModule: any = null
let pdfjsLib: any = null

// Lazy load transformers module
async function loadTransformers() {
  if (!transformersModule) {
    try {
      transformersModule = await import('@huggingface/transformers')
      return transformersModule
    } catch (error) {
      console.error('Failed to load @huggingface/transformers:', error)
      return null
    }
  }
  return transformersModule
}

// Lazy load pdfjs-dist
async function loadPdfJs() {
  if (!pdfjsLib) {
    try {
      pdfjsLib = await import('pdfjs-dist')
      // Configure PDF.js worker BEFORE any PDF operations
      if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
        // Priority 1: Use local worker file from public folder (most reliable)
        // This file is copied during setup and served directly by Vite
        const localWorkerPath = '/pdf.worker.min.mjs'
        pdfjsLib.GlobalWorkerOptions.workerSrc = localWorkerPath
        console.log('✓ PDF.js worker configured from local file:', pdfjsLib.GlobalWorkerOptions.workerSrc)
        
        // Verify worker is accessible (optional check)
        try {
          const response = await fetch(localWorkerPath, { method: 'HEAD' })
          if (!response.ok) {
            console.warn('Local worker file not found, falling back to CDN...')
            // Fallback to CDN if local file not found
            const version = pdfjsLib.version || '5.4.530'
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`
            console.log('✓ PDF.js worker configured from CDN (fallback):', pdfjsLib.GlobalWorkerOptions.workerSrc)
          }
        } catch (fetchError) {
          // If fetch fails (CORS or network), still use local path (Vite will serve it)
          console.log('Worker verification skipped, using local path:', localWorkerPath)
        }
      }
      return pdfjsLib
    } catch (error) {
      console.error('Failed to load pdfjs-dist:', error)
      throw new Error('PDF.js library failed to load. Please refresh the page and try again.')
    }
  }
  return pdfjsLib
}

// Initialize BLIP model (lazy loading)
let blipPipeline: any = null
let blipLoadError: Error | null = null

async function getBLIPPipeline() {
  if (blipLoadError) {
    throw blipLoadError
  }
  
  if (!blipPipeline) {
    try {
      const transformers = await loadTransformers()
      if (!transformers) {
        throw new Error('Transformers module not available')
      }

      const { pipeline, env } = transformers
      
      // Configure Transformers.js to use local models or CDN
      env.allowLocalModels = false
      env.allowRemoteModels = true

      console.log('Loading BLIP model (Salesforce/blip-image-captioning-large)...')
      blipPipeline = await pipeline(
        'image-to-text',
        'Salesforce/blip-image-captioning-large',
        {
          device: 'cpu', // Use CPU for browser compatibility
        }
      )
      console.log('BLIP model loaded successfully')
    } catch (error) {
      console.error('Failed to load BLIP large model:', error)
      // Fallback to base model if large fails
      console.log('Attempting to load base model as fallback...')
      try {
        const transformers = await loadTransformers()
        if (!transformers) {
          throw new Error('Transformers module not available')
        }
        const { pipeline } = transformers
        blipPipeline = await pipeline(
          'image-to-text',
          'Salesforce/blip-image-captioning-base',
          {
            device: 'cpu',
          }
        )
        console.log('BLIP base model loaded as fallback')
      } catch (fallbackError) {
        console.error('Failed to load fallback model:', fallbackError)
        blipLoadError = error as Error
        throw error
      }
    }
  }
  return blipPipeline
}

// Convert PDF to images
export async function pdfToImages(file: File): Promise<HTMLImageElement[]> {
  try {
    // Validate file type
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('File is not a PDF. Please upload a valid PDF file.')
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      throw new Error('PDF file is too large. Maximum size is 50MB.')
    }

    if (file.size === 0) {
      throw new Error('PDF file is empty.')
    }

    const pdfjs = await loadPdfJs()
    if (!pdfjs) {
      throw new Error('PDF.js library not available. Please refresh the page and try again.')
    }

    let arrayBuffer: ArrayBuffer
    try {
      arrayBuffer = await file.arrayBuffer()
    } catch (error) {
      throw new Error('Failed to read PDF file. The file may be corrupted or in an unsupported format.')
    }

    // Validate PDF header (PDF files start with %PDF)
    const uint8Array = new Uint8Array(arrayBuffer.slice(0, 4))
    const header = String.fromCharCode(...uint8Array)
    if (!header.startsWith('%PDF')) {
      throw new Error('File does not appear to be a valid PDF. Please check the file format.')
    }

    let pdf: any
    try {
      // Ensure worker is configured before loading document
      if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
        // Re-configure worker if it's missing
        const version = pdfjs.version || '5.4.530'
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`
        console.log('Re-configured PDF.js worker:', pdfjs.GlobalWorkerOptions.workerSrc)
      }
      
      pdf = await pdfjs.getDocument({ 
        data: arrayBuffer,
        verbosity: 0, // Suppress console warnings
      }).promise
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error'
      if (errorMessage.includes('Invalid PDF') || errorMessage.includes('corrupted')) {
        throw new Error('The PDF file appears to be corrupted or invalid. Please try a different file.')
      } else if (errorMessage.includes('password')) {
        throw new Error('This PDF is password-protected. Please remove the password and try again.')
      } else {
        throw new Error(`Failed to read PDF: ${errorMessage}. Please ensure the file is a valid PDF.`)
      }
    }

    if (!pdf || !pdf.numPages || pdf.numPages === 0) {
      throw new Error('The PDF file appears to be empty or has no pages.')
    }

    const images: HTMLImageElement[] = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum)
        const viewport = page.getViewport({ scale: 2.0 }) // Higher scale for better quality

        // Create canvas to render PDF page
        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d')
        if (!context) {
          throw new Error('Could not get canvas context')
        }
        canvas.height = viewport.height
        canvas.width = viewport.width

        try {
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise
        } catch (renderError: any) {
          console.warn(`Failed to render PDF page ${pageNum}:`, renderError)
          // Continue with other pages
          continue
        }

        // Convert canvas to image
        const img = new Image()
        img.src = canvas.toDataURL('image/png')
        await new Promise((resolve, reject) => {
          img.onload = resolve
          img.onerror = () => reject(new Error(`Failed to convert page ${pageNum} to image`))
          // Timeout after 10 seconds
          setTimeout(() => reject(new Error(`Timeout converting page ${pageNum} to image`)), 10000)
        })
        images.push(img)
      } catch (pageError: any) {
        console.warn(`Error processing PDF page ${pageNum}:`, pageError)
        // Continue with other pages instead of failing completely
        if (pageNum === 1 && images.length === 0) {
          // If first page fails, throw error
          throw new Error(`Failed to process PDF page ${pageNum}: ${pageError.message || 'Unknown error'}`)
        }
      }
    }

    if (images.length === 0) {
      throw new Error('Failed to convert any PDF pages to images. The PDF may be corrupted or in an unsupported format.')
    }

    return images
  } catch (error: any) {
    console.error('PDF to images conversion error:', error)
    // Re-throw with a user-friendly message
    if (error.message) {
      throw error
    }
    throw new Error('Failed to read PDF file. Please ensure the file is a valid, non-password-protected PDF.')
  }
}

// Convert File to Image element
export async function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// Extract text using BLIP model
export async function extractTextWithBLIP(image: HTMLImageElement | HTMLImageElement[]): Promise<string> {
  try {
    const blipModel = await getBLIPPipeline()
    let allText = ''

    const images = Array.isArray(image) ? image : [image]

    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      console.log(`Processing image ${i + 1}/${images.length} with BLIP...`)
      
      // Convert image to format expected by BLIP
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        console.warn('Could not get canvas context')
        continue
      }
      
      ctx.drawImage(img, 0, 0)

      try {
        // Use BLIP to generate caption/description
        // BLIP can understand the image content and structure
        const result = await blipModel(canvas)
        
        if (result && Array.isArray(result) && result.length > 0) {
          // BLIP returns captions/descriptions
          const caption = result[0]?.generated_text || result[0] || ''
          allText += `Page ${i + 1}: ${caption}\n`
          console.log(`BLIP result for page ${i + 1}:`, caption)
        } else if (typeof result === 'string') {
          allText += `Page ${i + 1}: ${result}\n`
        }
      } catch (blipError) {
        console.warn(`BLIP processing failed for image ${i + 1}:`, blipError)
        // Continue with other images
      }
    }

    return allText.trim()
  } catch (error) {
    console.error('BLIP extraction error:', error)
    // Don't throw, return empty string so OCR can still work
    return ''
  }
}

// Extract structured data from image using BLIP + OCR hybrid approach
export async function extractDataWithBLIP(file: File): Promise<{
  blipDescription: string
  structuredText: string
}> {
  try {
    let images: HTMLImageElement[]

    // Handle PDF files
    if (file.type === 'application/pdf') {
      console.log('Converting PDF to images...')
      images = await pdfToImages(file)
      console.log(`Converted ${images.length} PDF pages to images`)
    } else {
      // Handle image files
      console.log('Converting image file...')
      images = [await fileToImage(file)]
    }

    // Use BLIP to understand the image structure and content
    console.log('Extracting text with BLIP model...')
    const blipDescription = await extractTextWithBLIP(images)

    return {
      blipDescription,
      structuredText: blipDescription, // Can be enhanced with OCR
    }
  } catch (error) {
    console.error('BLIP extraction error:', error)
    // Return empty strings so OCR can still work
    return {
      blipDescription: '',
      structuredText: '',
    }
  }
}
