import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { ImageProcessorService } from './image-processor.service';

interface CameraStats {
  totalFramesCaptured: number;
  averageFPS: number;
  lastCaptureTime: number;
  hdImagesSaved: number;
  thumbnailsSent: number;
  detectedPlates: number;
  totalImages: number;
}

interface CameraConfig {
  // Resolución máxima para HD
  width: number;
  height: number;
  // Configuraciones profesionales
  frameRate: number;
  facingMode: string;
  // Configuraciones avanzadas (si el dispositivo las soporta)
  exposureMode?: string;
  whiteBalanceMode?: string;
  focusMode?: string;
  iso?: number;
  shutterSpeed?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CameraService {
  private stream: MediaStream | null = null;
  private isCapturing = new BehaviorSubject<boolean>(false);
  private statsSubject = new BehaviorSubject<CameraStats>({
    totalFramesCaptured: 0,
    averageFPS: 0,
    lastCaptureTime: 0,
    thumbnailsSent: 0,
    hdImagesSaved: 0,
    detectedPlates: 0,
    totalImages: 0,
  });
  private stats: CameraStats = {
    totalFramesCaptured: 0,
    averageFPS: 0,
    lastCaptureTime: 0,
    hdImagesSaved: 0,
    thumbnailsSent: 0,
    detectedPlates: 0,
    totalImages: 0,
  };

  // Configuración para VISUALIZACIÓN EN MÓVILES (optimizada para UX)
  private mobileDisplayConfig: CameraConfig = {
    width: 640, // Resolución móvil cómoda
    height: 480, // 4:3 para mejor visualización móvil
    frameRate: 30, // Fluido para visualización
    facingMode: 'environment', // Cámara trasera
    focusMode: 'continuous',
  };

  // Configuración para VISUALIZACIÓN EN DESKTOP
  private displayConfig: CameraConfig = {
    width: 1280, // HD cómodo para visualización
    height: 720, // 16:9 estándar
    frameRate: 30, // Fluido para visualización
    facingMode: 'environment', // Cámara trasera
    focusMode: 'continuous',
  };

  // Configuración profesional para CAPTURA HD (cuando se detecta placa)
  private professionalConfig: CameraConfig = {
    width: 7728, // 50MP completos solo para captura
    height: 5792, // Aspect ratio 4:3 para 50MP
    frameRate: 30, // FPS alto para movimiento de vehículos
    facingMode: 'environment', // Cámara trasera
    // Configuraciones ESPECÍFICAS para día soleado y detección de placas
    exposureMode: 'manual',
    whiteBalanceMode: 'daylight',
    focusMode: 'continuous',
    iso: 64, // ISO más bajo para máxima nitidez
    shutterSpeed: 1500, // Velocidad MÁS alta para congelar movimiento de vehículos
    brightness: -0.1, // Ligeramente subexpuesto para evitar saturación de placas blancas
    contrast: 1.3, // MAYOR contraste para definir mejor las placas
    saturation: 0.9, // Saturación reducida para mejor lectura de caracteres
  };

  private readonly CAPTURE_INTERVAL = 500; // 2 FPS para análisis
  private captureInterval: any;
  private startTime: number = 0;

  constructor(private imageProcessor: ImageProcessorService) {}

  /**
   * Inicializar cámara con configuración optimizada para visualización
   */
  async initializeCamera(): Promise<HTMLVideoElement> {
    try {
      console.log('📷 Inicializando cámara con configuración optimizada para visualización...');

      // Detectar si es móvil y usar configuración apropiada
      const isMobile = this.isMobileDevice();
      const config = isMobile ? this.mobileDisplayConfig : this.displayConfig;
      
      console.log(`📱 Dispositivo detectado: ${isMobile ? 'Móvil' : 'Desktop'} - Usando resolución: ${config.width}x${config.height}`);

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: config.width, min: 320 },
          height: { ideal: config.height, min: 240 },
          frameRate: { ideal: config.frameRate, min: 24 },
          facingMode: { ideal: config.facingMode },

          // Configuraciones avanzadas (si el navegador las soporta)
          // Nota: Estas propiedades no están oficialmente en MediaTrackConstraints
          // pero algunos navegadores pueden soportarlas
          ...((this.professionalConfig.exposureMode as any) &&
            ({
              exposureMode: this.professionalConfig.exposureMode,
            } as any)),
          ...((this.professionalConfig.whiteBalanceMode as any) &&
            ({
              whiteBalanceMode: this.professionalConfig.whiteBalanceMode,
            } as any)),
          ...((this.professionalConfig.focusMode as any) &&
            ({
              focusMode: this.professionalConfig.focusMode,
            } as any)),
        },
        audio: false,
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Crear elemento de video
      const videoElement = document.createElement('video');
      videoElement.srcObject = this.stream;
      videoElement.autoplay = true;
      videoElement.playsInline = true;

      // Aplicar configuraciones avanzadas si están disponibles
      await this.applyAdvancedSettings();

      console.log('✅ Cámara inicializada con configuración profesional');
      console.log(`📊 Resolución obtenida: ${this.getActualResolution()}`);

      return videoElement;
    } catch (error) {
      console.error('❌ Error inicializando cámara:', error);
      throw error;
    }
  }

  /**
   * Detectar si es un dispositivo móvil con soporte para SSR
   */
  private isMobileDevice(): boolean {
    if (typeof window === 'undefined') {
      // Asumir ambiente de servidor no móvil
      return false;
    }
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth <= 768;
  }

  /**
   * Aplicar configuraciones avanzadas de la cámara
   */
  private async applyAdvancedSettings(): Promise<void> {
    if (!this.stream) return;

    try {
      const track = this.stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      const settings = track.getSettings();

      console.log('📋 Capacidades de la cámara:', capabilities);
      console.log('⚙️ Configuraciones actuales:', settings);

      // Aplicar configuraciones si están disponibles
      const constraints: any = {}; // Usamos any porque las propiedades avanzadas no están en MediaTrackConstraints

      // ISO (si está disponible)
      if ('iso' in capabilities && this.professionalConfig.iso) {
        constraints.iso = this.professionalConfig.iso;
      }

      // Velocidad de obturación (si está disponible)
      if (
        'shutterSpeed' in capabilities &&
        this.professionalConfig.shutterSpeed
      ) {
        constraints.shutterSpeed = this.professionalConfig.shutterSpeed;
      }

      // Brillo
      if ('brightness' in capabilities && this.professionalConfig.brightness) {
        constraints.brightness = this.professionalConfig.brightness;
      }

      // Contraste
      if ('contrast' in capabilities && this.professionalConfig.contrast) {
        constraints.contrast = this.professionalConfig.contrast;
      }

      // Saturación
      if ('saturation' in capabilities && this.professionalConfig.saturation) {
        constraints.saturation = this.professionalConfig.saturation;
      }

      // Aplicar configuraciones
      if (Object.keys(constraints).length > 0) {
        await track.applyConstraints(constraints);
        console.log('✅ Configuraciones profesionales aplicadas');
      } else {
        console.log(
          '⚠️ Configuraciones avanzadas no soportadas por este dispositivo'
        );
      }
    } catch (error) {
      console.warn('⚠️ Error aplicando configuraciones avanzadas:', error);
    }
  }

  /**
   * Obtener resolución real de la cámara
   */
  private getActualResolution(): string {
    if (!this.stream) return 'Unknown';

    const track = this.stream.getVideoTracks()[0];
    const settings = track.getSettings();
    return `${settings.width}x${settings.height}`;
  }

  /**
   * Iniciar captura automática cada 0.5 segundos
   */
  startCapture(
    videoElement: HTMLVideoElement,
    onThumbnailReady: (thumbnail: Blob) => void,
    onHDReady: (hdImage: Blob) => void
  ): void {
    if (this.captureInterval) {
      this.stopCapture();
    }

    this.isCapturing.next(true);
    this.startTime = Date.now();
    this.stats.totalFramesCaptured = 0;
    this.statsSubject.next({ ...this.stats });

    console.log('⚡ Iniciando captura automática a 2 FPS...');

    this.captureInterval = setInterval(async () => {
      try {
        await this.captureFrame(videoElement, onThumbnailReady, onHDReady);
        this.updateStats();
      } catch (error) {
        console.error('❌ Error en captura automática:', error);
      }
    }, this.CAPTURE_INTERVAL);
  }

  /**
   * Capturar frame actual de la cámara - OPTIMIZADO con ImageProcessor
   */
  private async captureFrame(
    videoElement: HTMLVideoElement,
    onThumbnailReady: (thumbnail: Blob) => void,
    onHDReady: (hdImage: Blob) => void
  ): Promise<void> {
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
      return;
    }

    try {
      // Usar ImageProcessor para thumbnail optimizado (300x300 con Pica.js)
      const thumbnailBlob = await this.imageProcessor.processImageTo300x300(
        videoElement
      );

      // Canvas para imagen HD (original) - mantener como estaba
      const hdCanvas = document.createElement('canvas');
      const hdCtx = hdCanvas.getContext('2d')!;
      hdCanvas.width = videoElement.videoWidth;
      hdCanvas.height = videoElement.videoHeight;
      hdCtx.drawImage(videoElement, 0, 0);

      const hdBlob = await new Promise<Blob>((resolve) => {
        hdCanvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.99);
      });

      // Ejecutar callbacks
      onThumbnailReady(thumbnailBlob);
      onHDReady(hdBlob);

      // Obtener estadísticas del procesamiento
      const processingStats = this.imageProcessor.getLastProcessingStats();
      if (processingStats) {
        console.log(
          `📊 Procesamiento: ${processingStats.processingTime}ms | Pica.js: ${processingStats.originalSize.megapixels}MP → 300x300`
        );
      }

      this.stats.totalFramesCaptured++;
      this.stats.lastCaptureTime = Date.now();
      this.stats.thumbnailsSent++;
    } catch (error) {
      console.error('❌ Error en captura optimizada:', error);
      // Fallback al método anterior si ImageProcessor falla
      await this.captureFrameFallback(
        videoElement,
        onThumbnailReady,
        onHDReady
      );
    }
  }

  /**
   * Método fallback con redimensionado manual
   */
  private async captureFrameFallback(
    videoElement: HTMLVideoElement,
    onThumbnailReady: (thumbnail: Blob) => void,
    onHDReady: (hdImage: Blob) => void
  ): Promise<void> {
    console.log('⚠️ Usando fallback: redimensionado manual');

    // Canvas para imagen HD (original)
    const hdCanvas = document.createElement('canvas');
    const hdCtx = hdCanvas.getContext('2d')!;
    hdCanvas.width = videoElement.videoWidth;
    hdCanvas.height = videoElement.videoHeight;
    hdCtx.drawImage(videoElement, 0, 0);

    // Canvas para thumbnail 300x300 (método manual)
    const thumbnailCanvas = document.createElement('canvas');
    const thumbnailCtx = thumbnailCanvas.getContext('2d')!;
    thumbnailCanvas.width = 300;
    thumbnailCanvas.height = 300;

    // Redimensionar manteniendo aspect ratio
    const scale = Math.min(
      300 / videoElement.videoWidth,
      300 / videoElement.videoHeight
    );
    const scaledWidth = videoElement.videoWidth * scale;
    const scaledHeight = videoElement.videoHeight * scale;
    const offsetX = (300 - scaledWidth) / 2;
    const offsetY = (300 - scaledHeight) / 2;

    thumbnailCtx.drawImage(
      videoElement,
      offsetX,
      offsetY,
      scaledWidth,
      scaledHeight
    );

    // Convertir a Blob
    const thumbnailPromise = new Promise<Blob>((resolve) => {
      thumbnailCanvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85);
    });

    const hdPromise = new Promise<Blob>((resolve) => {
      hdCanvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.95);
    });

    const [thumbnailBlob, hdBlob] = await Promise.all([
      thumbnailPromise,
      hdPromise,
    ]);

    // Ejecutar callbacks
    onThumbnailReady(thumbnailBlob);
    onHDReady(hdBlob);

    this.stats.totalFramesCaptured++;
    this.stats.lastCaptureTime = Date.now();
    this.stats.thumbnailsSent++;
  }

  /**
   * Detener captura automática
   */
  stopCapture(): void {
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this.isCapturing.next(false);
    console.log('⏹️ Captura automática detenida');
  }

  /**
   * Guardar imagen HD en el dispositivo
   */
  async saveHDImage(blob: Blob, filename?: string): Promise<void> {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `placa_hd_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.stats.hdImagesSaved++;
      this.stats.totalImages++;
      this.statsSubject.next({ ...this.stats });
      console.log(`💾 Imagen HD guardada: ${a.download}`);
    } catch (error) {
      console.error('❌ Error guardando imagen HD:', error);
    }
  }

  /**
   * Guardar imagen procesada WebP (300x300) automáticamente
   */
  async saveProcessedImage(blob: Blob): Promise<void> {
    try {
      // Detectar formato basado en el tipo MIME del blob
      const format = blob.type.includes('webp') ? 'webp' : 
                    blob.type.includes('jpeg') ? 'jpg' : 'png';
      
      const timestamp = Date.now();
      const filename = `placa_300x300_${timestamp}.${format}`;
      
      // Crear enlace de descarga
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      
      // Agregar al DOM temporalmente para activar la descarga
      document.body.appendChild(a);
      a.click();
      
      // Limpiar recursos
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Actualizar estadísticas
      this.stats.totalImages++;
      this.statsSubject.next({ ...this.stats });
      
      console.log(`💾 Imagen WebP guardada automáticamente: ${filename} (${(blob.size / 1024).toFixed(2)}KB)`);
      
    } catch (error) {
      console.error('❌ Error guardando imagen procesada:', error);
    }
  }

  /**
   * Actualizar estadísticas
   */
  private updateStats(): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.stats.averageFPS = this.stats.totalFramesCaptured / elapsed;

    // Emitir cambios al observable
    this.statsSubject.next({ ...this.stats });
  }

  /**
   * Obtener estadísticas de captura
   */
  getStats(): CameraStats {
    return { ...this.stats };
  }

  /**
   * Observable del estado de captura
   */
  get isCapturing$(): Observable<boolean> {
    return this.isCapturing.asObservable();
  }

  /**
   * Observable de las estadísticas de cámara
   */
  get stats$(): Observable<CameraStats> {
    return this.statsSubject.asObservable();
  }

  /**
   * Detener cámara y liberar recursos
   */
  stopCamera(): void {
    this.stopCapture();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    console.log('📷 Cámara detenida y recursos liberados');
  }

  /**
   * Obtener configuración actual
   */
  getConfig(): CameraConfig {
    return { ...this.professionalConfig };
  }

  /**
   * Actualizar configuración
   */
  updateConfig(newConfig: Partial<CameraConfig>): void {
    this.professionalConfig = { ...this.professionalConfig, ...newConfig };
    console.log('⚙️ Configuración actualizada:', newConfig);
  }

  /**
   * Incrementar contador de placas detectadas
   */
  incrementPlateDetection(): void {
    this.stats.detectedPlates++;
    this.statsSubject.next({ ...this.stats });
  }
}
