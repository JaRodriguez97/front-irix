import { Injectable } from '@angular/core';

interface ImageOptimizationCapabilities {
  supportsWebP: boolean;
  supportsWebPLossless: boolean;
  supportsCreateImageBitmap: boolean;
  supportsOffscreenCanvas: boolean;
  preferredFormat: string;
  maxQuality: number;
}

@Injectable({
  providedIn: 'root'
})
export class WebPDetectionService {
  private capabilities: ImageOptimizationCapabilities | null = null;
  private webPTestCache: boolean | null = null;

  constructor() {
    this.detectCapabilities();
  }

  /**
   * Detecta las capacidades del navegador para optimización de imágenes
   */
  async detectCapabilities(): Promise<ImageOptimizationCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    console.log('🔍 Detectando capacidades de optimización de imágenes...');

    const capabilities: ImageOptimizationCapabilities = {
      supportsWebP: await this.detectWebPSupport(),
      supportsWebPLossless: await this.detectWebPLosslessSupport(),
      supportsCreateImageBitmap: this.detectCreateImageBitmapSupport(),
      supportsOffscreenCanvas: this.detectOffscreenCanvasSupport(),
      preferredFormat: 'image/jpeg', // Default fallback
      maxQuality: 0.85
    };

    // Determinar formato preferido basado en capacidades
    if (capabilities.supportsWebP) {
      capabilities.preferredFormat = 'image/webp';
      capabilities.maxQuality = 0.9; // WebP permite mejor calidad con menor tamaño
    }

    this.capabilities = capabilities;

    console.log('✅ Capacidades detectadas:', {
      webP: capabilities.supportsWebP ? '✅' : '❌',
      webPLossless: capabilities.supportsWebPLossless ? '✅' : '❌',
      createImageBitmap: capabilities.supportsCreateImageBitmap ? '✅' : '❌',
      offscreenCanvas: capabilities.supportsOffscreenCanvas ? '✅' : '❌',
      preferredFormat: capabilities.preferredFormat,
      maxQuality: capabilities.maxQuality
    });

    return capabilities;
  }

  /**
   * Detecta soporte para WebP
   */
  private async detectWebPSupport(): Promise<boolean> {
    if (this.webPTestCache !== null) {
      return this.webPTestCache;
    }

    return new Promise((resolve) => {
      const webP = new Image();
      webP.onload = webP.onerror = () => {
        const result = webP.height === 2;
        this.webPTestCache = result;
        resolve(result);
      };
      // Imagen WebP 1x1 pixel transparente
      webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==';
    });
  }

  /**
   * Detecta soporte para WebP Lossless
   */
  private async detectWebPLosslessSupport(): Promise<boolean> {
    if (!await this.detectWebPSupport()) {
      return false;
    }

    return new Promise((resolve) => {
      const webP = new Image();
      webP.onload = webP.onerror = () => {
        resolve(webP.height === 2);
      };
      // Imagen WebP lossless 1x1 pixel
      webP.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    });
  }

  /**
   * Detecta soporte para createImageBitmap
   */
  private detectCreateImageBitmapSupport(): boolean {
    return typeof createImageBitmap === 'function';
  }

  /**
   * Detecta soporte para OffscreenCanvas
   */
  private detectOffscreenCanvasSupport(): boolean {
    return typeof OffscreenCanvas !== 'undefined';
  }

  /**
   * Obtiene las capacidades actuales
   */
  getCapabilities(): ImageOptimizationCapabilities | null {
    return this.capabilities;
  }

  /**
   * Verifica si WebP está soportado
   */
  async isWebPSupported(): Promise<boolean> {
    const caps = await this.detectCapabilities();
    return caps.supportsWebP;
  }

  /**
   * Obtiene el formato preferido para el navegador actual
   */
  async getPreferredFormat(): Promise<string> {
    const caps = await this.detectCapabilities();
    return caps.preferredFormat;
  }

  /**
   * Obtiene la calidad óptima para el formato
   */
  async getOptimalQuality(): Promise<number> {
    const caps = await this.detectCapabilities();
    return caps.maxQuality;
  }

  /**
   * Convierte canvas a blob optimizado según las capacidades del navegador
   */
  async optimizeCanvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    const caps = await this.detectCapabilities();
    
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to convert canvas to blob'));
          return;
        }

        console.log(`🎨 Imagen optimizada: ${caps.preferredFormat}, ${blob.size} bytes, calidad: ${caps.maxQuality}`);
        resolve(blob);
      }, caps.preferredFormat, caps.maxQuality);
    });
  }

  /**
   * Información sobre el ahorro esperado con las optimizaciones
   */
  getOptimizationStats(): { format: string; expectedSaving: string; avgSize: string } {
    const caps = this.capabilities;
    if (!caps) {
      return { format: 'unknown', expectedSaving: '0%', avgSize: 'unknown' };
    }

    if (caps.supportsWebP) {
      return {
        format: 'WebP',
        expectedSaving: '60-80%',
        avgSize: '7-14KB (vs 36KB JPEG)'
      };
    }

    return {
      format: 'JPEG optimizado',
      expectedSaving: '15-25%',
      avgSize: '25-30KB'
    };
  }
}
