import { Injectable } from '@angular/core';

export interface CameraCapabilities {
  deviceId: string;
  label: string;
  maxResolution: Resolution;
  supportedFrameRates: number[];
  supportsFocusMode: boolean;
  facingMode: 'user' | 'environment' | 'unknown';
}

export interface Resolution {
  width: number;
  height: number;
  megapixels: number;
}

@Injectable({
  providedIn: 'root'
})
export class CameraCapabilitiesService {
  private availableDevices: MediaDeviceInfo[] = [];
  private browserCapabilities: any = {};

  constructor() {
    this.initializeBrowserCapabilities();
  }

  /**
   * Detectar capacidades del navegador
   */
  async detectBrowserCapabilities(): Promise<CameraCapabilities[]> {
    console.log('🔍 Detectando capacidades de cámara...');

    try {
      // Obtener lista de dispositivos de cámara
      await this.enumerateDevices();
      
      const capabilities: CameraCapabilities[] = [];

      for (const device of this.availableDevices) {
        if (device.kind === 'videoinput') {
          const capability = await this.analyzeDeviceCapabilities(device);
          capabilities.push(capability);
        }
      }

      console.log(`✅ ${capabilities.length} cámaras detectadas:`, capabilities);
      return capabilities;

    } catch (error) {
      console.error('❌ Error detectando capacidades:', error);
      return [];
    }
  }

  /**
   * Obtener resoluciones soportadas para un dispositivo
   */
  async getSupportedResolutions(deviceId: string): Promise<Resolution[]> {
    const resolutions: Resolution[] = [
      { width: 3840, height: 2160, megapixels: 8.3 },   // 4K
      { width: 2560, height: 1440, megapixels: 3.7 },   // QHD
      { width: 1920, height: 1080, megapixels: 2.1 },   // Full HD
      { width: 1280, height: 720, megapixels: 0.9 },    // HD
      { width: 640, height: 480, megapixels: 0.3 }      // VGA
    ];

    const supportedResolutions: Resolution[] = [];

    for (const resolution of resolutions) {
      const isSupported = await this.testResolutionSupport(deviceId, resolution);
      if (isSupported) {
        supportedResolutions.push(resolution);
      }
    }

    return supportedResolutions;
  }

  /**
   * Testear soporte de frame rates
   */
  async testFrameRateSupport(deviceId: string, frameRates: number[]): Promise<number> {
    const testRates = frameRates.sort((a, b) => b - a); // Probar desde el más alto

    for (const rate of testRates) {
      const isSupported = await this.testFrameRate(deviceId, rate);
      if (isSupported) {
        console.log(`✅ Frame rate soportado: ${rate} FPS`);
        return rate;
      }
    }

    console.log('⚠️ Usando frame rate por defecto: 30 FPS');
    return 30; // Fallback
  }

  /**
   * Validar si focusMode es soportado
   */
  validateFocusMode(): boolean {
    return this.browserCapabilities.focusMode || false;
  }

  /**
   * Obtener la mejor cámara disponible (trasera preferida)
   */
  getBestCamera(capabilities: CameraCapabilities[]): CameraCapabilities | null {
    if (capabilities.length === 0) return null;

    // Priorizar cámara trasera con mayor resolución
    const rearCameras = capabilities.filter(cap => cap.facingMode === 'environment');
    if (rearCameras.length > 0) {
      return rearCameras.reduce((best, current) => 
        current.maxResolution.megapixels > best.maxResolution.megapixels ? current : best
      );
    }

    // Si no hay cámara trasera, usar la de mayor resolución disponible
    return capabilities.reduce((best, current) => 
      current.maxResolution.megapixels > best.maxResolution.megapixels ? current : best
    );
  }

  /**
   * Generar constraints optimizados para getUserMedia
   */
  generateOptimalConstraints(capability: CameraCapabilities): MediaStreamConstraints {
    const maxRes = capability.maxResolution;
    
    return {
      video: {
        deviceId: { exact: capability.deviceId },
        width: { min: 1280, ideal: maxRes.width, max: maxRes.width },
        height: { min: 720, ideal: maxRes.height, max: maxRes.height },
        frameRate: { ideal: 30, max: 60 },
        facingMode: capability.facingMode === 'environment' ? 'environment' : 'user',
        ...(this.validateFocusMode() && { focusMode: 'continuous' })
      }
    };
  }

  // --- MÉTODOS PRIVADOS ---

  private async initializeBrowserCapabilities(): Promise<void> {
    if (navigator.mediaDevices && navigator.mediaDevices.getSupportedConstraints) {
      this.browserCapabilities = navigator.mediaDevices.getSupportedConstraints();
      console.log('📋 Capacidades del navegador:', this.browserCapabilities);
    }
  }

  private async enumerateDevices(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      throw new Error('enumerateDevices no soportado');
    }

    this.availableDevices = await navigator.mediaDevices.enumerateDevices();
    console.log(`📱 ${this.availableDevices.length} dispositivos encontrados`);
  }

  private async analyzeDeviceCapabilities(device: MediaDeviceInfo): Promise<CameraCapabilities> {
    const resolutions = await this.getSupportedResolutions(device.deviceId);
    const maxResolution = resolutions.length > 0 ? resolutions[0] : { width: 640, height: 480, megapixels: 0.3 };
    
    // Testear frame rates comunes
    const supportedFrameRate = await this.testFrameRateSupport(device.deviceId, [60, 30, 24, 15]);

    return {
      deviceId: device.deviceId,
      label: device.label || 'Cámara desconocida',
      maxResolution,
      supportedFrameRates: [supportedFrameRate],
      supportsFocusMode: this.validateFocusMode(),
      facingMode: this.detectFacingMode(device.label)
    };
  }

  private async testResolutionSupport(deviceId: string, resolution: Resolution): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { exact: resolution.width },
          height: { exact: resolution.height }
        }
      });

      // Cerrar stream inmediatamente
      stream.getTracks().forEach(track => track.stop());
      return true;

    } catch (error) {
      return false;
    }
  }

  private async testFrameRate(deviceId: string, frameRate: number): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          frameRate: { exact: frameRate }
        }
      });

      stream.getTracks().forEach(track => track.stop());
      return true;

    } catch (error) {
      return false;
    }
  }

  private detectFacingMode(label: string): 'user' | 'environment' | 'unknown' {
    const lowerLabel = label.toLowerCase();
    
    if (lowerLabel.includes('back') || lowerLabel.includes('rear') || lowerLabel.includes('trasera')) {
      return 'environment';
    } else if (lowerLabel.includes('front') || lowerLabel.includes('user') || lowerLabel.includes('frontal')) {
      return 'user';
    }
    
    return 'unknown';
  }
}
