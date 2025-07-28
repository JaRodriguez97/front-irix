import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface BrowserCapabilities {
  webP: {
    supported: boolean;
    lossy: boolean;
    lossless: boolean;
    animation: boolean;
    method: string;
  };
  canvas: {
    supported: boolean;
    webgl: boolean;
    webgl2: boolean;
    imageBitmapSupported: boolean;
    offscreenSupported: boolean;
  };
  camera: {
    supported: boolean;
    constraints: any;
    devices: MediaDeviceInfo[];
  };
  download: {
    blobSupported: boolean;
    urlSupported: boolean;
    linkDownloadSupported: boolean;
  };
  browser: {
    name: string;
    version: string;
    mobile: boolean;
    platform: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BrowserCapabilitiesService {
  private capabilities = new BehaviorSubject<BrowserCapabilities | null>(null);
  private showModal = new BehaviorSubject<boolean>(false);

  constructor() {
    this.detectAllCapabilities();
  }

  /**
   * Detectar todas las capacidades del navegador
   */
  async detectAllCapabilities(): Promise<BrowserCapabilities> {
    console.log('🔍 Detectando capacidades completas del navegador...');

    const capabilities: BrowserCapabilities = {
      webP: await this.detectWebPCapabilities(),
      canvas: this.detectCanvasCapabilities(),
      camera: await this.detectCameraCapabilities(),
      download: this.detectDownloadCapabilities(),
      browser: this.detectBrowserInfo()
    };

    this.capabilities.next(capabilities);
    console.log('✅ Capacidades detectadas:', capabilities);
    
    return capabilities;
  }

  /**
   * Detectar capacidades WebP completas
   */
  private async detectWebPCapabilities() {
    const webP = {
      supported: false,
      lossy: false,
      lossless: false,
      animation: false,
      method: 'none'
    };

    // Test 1: WebP Lossy
    webP.lossy = await this.testWebPLossy();
    
    // Test 2: WebP Lossless
    webP.lossless = await this.testWebPLossless();
    
    // Test 3: WebP Animation
    webP.animation = await this.testWebPAnimation();
    
    // Test 4: Canvas toBlob
    const canvasSupport = await this.testWebPCanvas();
    
    webP.supported = webP.lossy || webP.lossless || canvasSupport;
    
    if (webP.supported) {
      webP.method = webP.lossy ? 'image-test' : 'canvas-test';
    }

    return webP;
  }

  /**
   * Test WebP Lossy
   */
  private testWebPLossy(): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.height === 2 && img.width === 2);
      img.onerror = () => resolve(false);
      img.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAwAAAARBxAR/Q9ERP8DAABWUDggGAAAABQBAJ0BKgEAAQAAAP4AAA3AAP7mtQAAAA==';
    });
  }

  /**
   * Test WebP Lossless
   */
  private testWebPLossless(): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.height === 2 && img.width === 2);
      img.onerror = () => resolve(false);
      img.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    });
  }

  /**
   * Test WebP Animation
   */
  private testWebPAnimation(): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.height === 2 && img.width === 2);
      img.onerror = () => resolve(false);
      img.src = 'data:image/webp;base64,UklGRlIAAABXRUJQVlA4WAoAAAASAAAAAAAAAAAAQU5JTQYAAAD/////AABBTk1GJgAAAAAAAAAAAAAAAAAAAGQAAABWUDhMDQAAAC8AAAAQBxAREYiI/gcA';
    });
  }

  /**
   * Test WebP con Canvas
   */
  private testWebPCanvas(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        canvas.toBlob((blob) => {
          resolve(blob !== null && blob.type === 'image/webp');
        }, 'image/webp', 0.5);
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Detectar capacidades de Canvas
   */
  private detectCanvasCapabilities() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    return {
      supported: !!ctx,
      webgl: !!canvas.getContext('webgl'),
      webgl2: !!canvas.getContext('webgl2'),
      imageBitmapSupported: typeof createImageBitmap === 'function',
      offscreenSupported: typeof OffscreenCanvas !== 'undefined'
    };
  }

  /**
   * Detectar capacidades de cámara
   */
  private async detectCameraCapabilities() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      const constraints = await navigator.mediaDevices.getSupportedConstraints();

      return {
        supported: !!navigator.mediaDevices?.getUserMedia,
        constraints,
        devices: videoDevices
      };
    } catch (error) {
      return {
        supported: false,
        constraints: {},
        devices: []
      };
    }
  }

  /**
   * Detectar capacidades de descarga
   */
  private detectDownloadCapabilities() {
    return {
      blobSupported: typeof Blob !== 'undefined',
      urlSupported: typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function',
      linkDownloadSupported: 'download' in document.createElement('a')
    };
  }

  /**
   * Detectar información del navegador
   */
  private detectBrowserInfo() {
    const userAgent = navigator.userAgent;
    let name = 'Unknown';
    let version = 'Unknown';

    // Chrome
    if (/Chrome\/([0-9]+)/.test(userAgent)) {
      name = 'Chrome';
      version = RegExp.$1;
    }
    // Firefox
    else if (/Firefox\/([0-9]+)/.test(userAgent)) {
      name = 'Firefox';
      version = RegExp.$1;
    }
    // Safari
    else if (/Version\/([0-9]+).*Safari/.test(userAgent)) {
      name = 'Safari';
      version = RegExp.$1;
    }
    // Edge
    else if (/Edg\/([0-9]+)/.test(userAgent)) {
      name = 'Edge';
      version = RegExp.$1;
    }

    return {
      name,
      version,
      mobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent),
      platform: navigator.platform
    };
  }

  /**
   * Mostrar modal de capacidades
   */
  showCapabilitiesModal(): void {
    this.showModal.next(true);
  }

  /**
   * Ocultar modal de capacidades
   */
  hideCapabilitiesModal(): void {
    this.showModal.next(false);
  }

  /**
   * Observable de capacidades
   */
  getCapabilities(): Observable<BrowserCapabilities | null> {
    return this.capabilities.asObservable();
  }

  /**
   * Observable del estado del modal
   */
  getModalState(): Observable<boolean> {
    return this.showModal.asObservable();
  }

  /**
   * Obtener formato preferido basado en las capacidades
   */
  getPreferredImageFormat(): string {
    const caps = this.capabilities.value;
    if (!caps) return 'image/jpeg';

    if (caps.webP.supported && (caps.webP.lossy || caps.webP.lossless)) {
      return 'image/webp';
    }

    return 'image/jpeg';
  }

  /**
   * Obtener calidad óptima para el formato
   */
  getOptimalQuality(format: string): number {
    switch (format) {
      case 'image/webp':
        return 0.9; // WebP permite mejor calidad con menor tamaño
      case 'image/jpeg':
        return 0.85;
      default:
        return 0.8;
    }
  }
}
