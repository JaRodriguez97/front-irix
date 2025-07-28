import { Observable } from 'rxjs';

export interface CameraConfiguration {
  width: number;
  height: number;
  frameRate: number;
  facingMode: string;
  iso?: number;
  shutterSpeed?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
}

export interface CameraStatistics {
  totalFramesCaptured: number;
  averageFPS: number;
  lastCaptureTime: number;
  hdImagesSaved: number;
  thumbnailsSent: number;
  detectedPlates: number;
}

export abstract class CameraService {
  abstract initializeCamera(): Promise<HTMLVideoElement>;
  abstract startCapture(
    videoElement: HTMLVideoElement,
    onThumbnailReady: (thumbnail: Blob) => void,
    onHDReady: (hdImage: Blob) => void
  ): void;
  abstract stopCapture(): void;
  abstract stopCamera(): void;
  abstract saveHDImage(blob: Blob, filename?: string): Promise<void>;
  abstract getStats(): CameraStatistics;
  abstract incrementPlateDetection(): void;
  abstract updateConfig(config: Partial<CameraConfiguration>): void;
  abstract getConfig(): CameraConfiguration;
  
  // Observables
  abstract isCapturing$: Observable<boolean>;
  abstract stats$: Observable<CameraStatistics>;
}
