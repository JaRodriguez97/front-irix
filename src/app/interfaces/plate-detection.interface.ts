// Interfaces para el sistema de detección de placas vehiculares

export interface PlateDetectionResult {
  type: 'connection_established' | 'thumbnail_result' | 'hd_result' | 'thumbnail_error' | 'hd_error' | 'analysis_result' | 'analysis_error' | 'socket_connected';
  hasPlate?: boolean;
  requestHD?: boolean;
  plates?: string[];
  vehicleColor?: string;
  vehicleDescription?: string;
  confidence?: number;
  processingTime?: number;
  timestamp?: number;
  error?: string;
  clientId?: string; // Para Socket.IO
}

export interface CameraConstraints {
  video: {
    facingMode: string;
    width: { ideal: number; max?: number };
    height: { ideal: number; max?: number };
    frameRate: { ideal?: number; exact?: number; max?: number };
    exposureMode?: string;
    whiteBalanceMode?: string;
    focusMode?: string;
    iso?: { ideal: number };
    shutterSpeed?: { ideal: number };
  };
  audio: boolean;
}

export interface CameraStats {
  totalAnalyzed: number;
  totalPlatesFound: number;
  startTime: number | null;
  fps: number;
  successRate: number;
  lastProcessingTime: number;
}

export interface DetectionSettings {
  analysisInterval: number; // ms between captures
  thumbnailSize: number; // 300x300
  hdMaxWidth: number; // Max HD width
  hdMaxHeight: number; // Max HD height
  jpegQuality: number; // 0.8 for thumbnails, 0.95 for HD
  chunkSize: number; // 64KB for HD image chunks
}

export interface HDImageChunk {
  type: 'hd_chunk';
  chunkIndex: number;
  totalChunks: number;
  imageId: string;
  data: ArrayBuffer;
}

export interface StoredImage {
  id: string;
  timestamp: number;
  filename: string;
  blob: Blob;
  detectedPlates?: string[];
  vehicleColor?: string;
  vehicleDescription?: string;
}
