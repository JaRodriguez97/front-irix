import { Injectable } from '@angular/core';
import * as pica from 'pica';

export interface ProcessingOptions {
  targetWidth: number;
  targetHeight: number;
  quality: number;
  format: 'jpeg' | 'png' | 'webp';
}

export interface ProcessingStats {
  originalSize: { width: number; height: number; megapixels: number };
  processedSize: { width: number; height: number; megapixels: number };
  processingTime: number;
  compressionRatio: number;
  blobSize: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageProcessorService {
  private picaInstance: any;
  private processingCanvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private stats: ProcessingStats | null = null;

  constructor() {
    this.initializePica();
    this.createOptimizedCanvas();
  }

  /**
   * Procesar imagen a 300x300 píxeles
   */
  async processImageTo300x300(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Blob> {
    const startTime = performance.now();
    
    try {
      console.log('🔄 Iniciando procesamiento de imagen...');

      const options: ProcessingOptions = {
        targetWidth: 300,
        targetHeight: 300,
        quality: 0.75, // Compresión agresiva para objetivo < 15KB
        format: 'webp'
      };

      // Crear ImageBitmap si la fuente es un video element
      let sourceBitmap: ImageBitmap;
      if (source instanceof HTMLVideoElement) {
        sourceBitmap = await createImageBitmap(source);
      } else if (source instanceof HTMLCanvasElement) {
        sourceBitmap = await createImageBitmap(source);
      } else {
        sourceBitmap = source;
      }

      // Redimensionar usando Pica
      const resizedCanvas = await this.resizeImageBitmap(sourceBitmap, options.targetWidth, options.targetHeight);
      
      // Comprimir a WebP
      const blob = await this.compressToWebP(resizedCanvas, options.quality);

      // Calcular estadísticas
      const processingTime = performance.now() - startTime;
      this.calculateStats(sourceBitmap, resizedCanvas, blob, processingTime);

      // Liberar recursos
      if (source instanceof HTMLVideoElement || source instanceof HTMLCanvasElement) {
        sourceBitmap.close();
      }

      console.log(`✅ Imagen procesada en ${processingTime.toFixed(2)}ms`);
      console.log(`📊 Tamaño final: ${(blob.size / 1024).toFixed(2)}KB`);

      return blob;

    } catch (error) {
      console.error('❌ Error procesando imagen:', error);
      throw error;
    }
  }

  /**
   * Comprimir canvas a WebP con compresión ultra agresiva
   */
  async compressToWebP(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
    const TARGET_SIZE_KB = 15; // Objetivo: < 15KB
    let currentQuality = quality;
    let attempts = 0;
    const maxAttempts = 5;
    
    try {
      // Compresión iterativa hasta alcanzar el tamaño objetivo
      while (attempts < maxAttempts) {
        const webpBlob = await this.tryCompressToFormat(canvas, 'image/webp', currentQuality);
        const sizeKB = webpBlob.size / 1024;
        
        console.log(`🔄 Intento ${attempts + 1}: Calidad ${currentQuality.toFixed(2)} = ${sizeKB.toFixed(2)}KB`);
        
        if (sizeKB <= TARGET_SIZE_KB) {
          console.log(`✅ WebP optimizado: ${sizeKB.toFixed(2)}KB (objetivo: ${TARGET_SIZE_KB}KB)`);
          return webpBlob;
        }
        
        // Reducir calidad agresivamente
        currentQuality *= 0.8;
        attempts++;
        
        if (currentQuality < 0.3) {
          console.log(`⚠️ Calidad mínima alcanzada: ${currentQuality.toFixed(2)}`);
          return webpBlob;
        }
      }
      
      // Si no se logra el objetivo, usar la última compresión
      const finalBlob = await this.tryCompressToFormat(canvas, 'image/webp', currentQuality);
      console.log(`✅ WebP final: ${(finalBlob.size / 1024).toFixed(2)}KB con calidad ${currentQuality.toFixed(2)}`);
      return finalBlob;
      
    } catch (webpError) {
      console.warn('⚠️ WebP no soportado, usando fallback JPEG:', webpError);
      
      // Fallback a JPEG con compresión agresiva
      try {
        const jpegBlob = await this.tryCompressToFormat(canvas, 'image/jpeg', Math.min(quality * 0.6, 0.5));
        console.log(`✅ Fallback JPEG: ${(jpegBlob.size / 1024).toFixed(2)}KB`);
        return jpegBlob;
      } catch (jpegError) {
        console.error('❌ Error con ambos formatos:', jpegError);
        throw new Error('Error comprimiendo imagen: WebP y JPEG fallaron');
      }
    }
  }

  /**
   * Intentar comprimir a un formato específico
   */
  private async tryCompressToFormat(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size > 0) {
            resolve(blob);
          } else {
            reject(new Error(`Error comprimiendo a ${mimeType}`));
          }
        },
        mimeType,
        quality
      );
    });
  }

  /**
   * Redimensionar ImageBitmap usando Pica
   */
  async resizeImageBitmap(source: ImageBitmap, targetW: number, targetH: number): Promise<HTMLCanvasElement> {
    try {
      // Crear canvas fuente
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = source.width;
      sourceCanvas.height = source.height;
      const sourceCtx = sourceCanvas.getContext('2d');
      
      if (!sourceCtx) {
        throw new Error('No se pudo obtener contexto 2D del canvas fuente');
      }

      // Dibujar ImageBitmap en canvas fuente
      sourceCtx.drawImage(source, 0, 0);

      // Configurar canvas destino
      this.processingCanvas.width = targetW;
      this.processingCanvas.height = targetH;

      // Redimensionar con Pica (alta calidad)
      const resizedCanvas = await this.picaInstance.resize(sourceCanvas, this.processingCanvas, {
        algorithm: 'lanczos',
        unsharpAmount: 80,
        unsharpRadius: 0.6,
        transferable: true
      });

      return resizedCanvas;

    } catch (error) {
      console.error('❌ Error redimensionando con Pica:', error);
      
      // Fallback: redimensionado nativo del canvas
      return this.fallbackResize(source, targetW, targetH);
    }
  }

  /**
   * Crear canvas optimizado reutilizable
   */
  createOptimizedCanvas(): HTMLCanvasElement {
    if (!this.processingCanvas) {
      this.processingCanvas = document.createElement('canvas');
      this.ctx = this.processingCanvas.getContext('2d', { 
        willReadFrequently: true,
        alpha: true // WebP soporta transparencia
      })!;

      if (!this.ctx) {
        throw new Error('No se pudo crear contexto 2D del canvas');
      }
    }

    return this.processingCanvas;
  }

  /**
   * Limpiar memoria y recursos
   */
  memoryCleanup(): void {
    if (this.ctx && this.processingCanvas) {
      // Limpiar canvas
      this.ctx.clearRect(0, 0, this.processingCanvas.width, this.processingCanvas.height);
      
      // Resetear dimensiones para liberar memoria
      this.processingCanvas.width = 1;
      this.processingCanvas.height = 1;
    }

    // Limpiar estadísticas
    this.stats = null;

    console.log('🧹 Memoria limpiada');
  }

  /**
   * Obtener estadísticas del último procesamiento
   */
  getLastProcessingStats(): ProcessingStats | null {
    return this.stats;
  }

  /**
   * Procesar múltiples imágenes con pool de canvas
   */
  async processBatch(sources: (HTMLVideoElement | HTMLCanvasElement | ImageBitmap)[]): Promise<Blob[]> {
    const results: Blob[] = [];
    
    console.log(`🔄 Procesando lote de ${sources.length} imágenes...`);

    for (let i = 0; i < sources.length; i++) {
      try {
        const blob = await this.processImageTo300x300(sources[i]);
        results.push(blob);
        
        // Limpiar memoria entre procesamiento
        if (i < sources.length - 1) {
          this.memoryCleanup();
        }

      } catch (error) {
        console.error(`❌ Error procesando imagen ${i + 1}:`, error);
      }
    }

    console.log(`✅ Lote procesado: ${results.length}/${sources.length} imágenes`);
    return results;
  }

  // --- MÉTODOS PRIVADOS ---

  private async initializePica(): Promise<void> {
    try {
      this.picaInstance = pica({
        features: ['js', 'wasm', 'ww'], // JavaScript, WebAssembly, Web Workers
        idle: 2000 // Timeout para Web Workers
      });
      
      console.log('✅ Pica inicializado correctamente');
    } catch (error) {
      console.error('⚠️ Error inicializando Pica, usando fallback:', error);
      this.picaInstance = null;
    }
  }

  private async fallbackResize(source: ImageBitmap, targetW: number, targetH: number): Promise<HTMLCanvasElement> {
    console.log('⚠️ Usando redimensionado nativo del canvas (fallback)');

    this.processingCanvas.width = targetW;
    this.processingCanvas.height = targetH;

    // Redimensionado nativo (menor calidad pero compatible)
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.drawImage(source, 0, 0, targetW, targetH);

    return this.processingCanvas;
  }

  private calculateStats(
    source: ImageBitmap, 
    processed: HTMLCanvasElement, 
    blob: Blob, 
    processingTime: number
  ): void {
    const originalMegapixels = (source.width * source.height) / 1000000;
    const processedMegapixels = (processed.width * processed.height) / 1000000;

    this.stats = {
      originalSize: {
        width: source.width,
        height: source.height,
        megapixels: Math.round(originalMegapixels * 100) / 100
      },
      processedSize: {
        width: processed.width,
        height: processed.height,
        megapixels: Math.round(processedMegapixels * 100) / 100
      },
      processingTime: Math.round(processingTime * 100) / 100,
      compressionRatio: Math.round((originalMegapixels / processedMegapixels) * 100) / 100,
      blobSize: blob.size
    };

    console.log('📊 Estadísticas de procesamiento:', this.stats);
  }
}
