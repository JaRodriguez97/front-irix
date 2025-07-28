import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject } from 'rxjs';
import { CameraService } from './camera.service';
import { SocketService } from './socket.service';
import { PlateDetectionResult } from '../interfaces/plate-detection.interface';

interface AnalysisStats {
  imagesAnalyzed: number;
  platesDetected: number;
  averageProcessingTime: number;
  lastAnalysisTime: number;
  isAnalyzing: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ImageAnalysisService {
  private analysisActive = new BehaviorSubject<boolean>(false);
  private analysisStats = new BehaviorSubject<AnalysisStats>({
    imagesAnalyzed: 0,
    platesDetected: 0,
    averageProcessingTime: 0,
    lastAnalysisTime: 0,
    isAnalyzing: false
  });

  private stats: AnalysisStats = {
    imagesAnalyzed: 0,
    platesDetected: 0,
    averageProcessingTime: 0,
    lastAnalysisTime: 0,
    isAnalyzing: false
  };

  private videoElement: HTMLVideoElement | null = null;
  private processingTimes: number[] = [];

  constructor(
    private cameraService: CameraService,
    private socketService: SocketService
  ) {
    // Escuchar resultados de análisis
    this.socketService.handleAnalysisResult().subscribe(result => {
      if (result) {
        this.handleAnalysisResult(result);
      }
    });
  }

  /**
   * Inicializar análisis en tiempo real
   */
  async startRealTimeAnalysis(): Promise<void> {
    try {
      console.log('🚀 Iniciando análisis en tiempo real...');
      
      // Inicializar cámara
      this.videoElement = await this.cameraService.initializeCamera();
      
      // Configurar captura con análisis vía Socket.IO
      this.cameraService.startCapture(
        this.videoElement,
        (thumbnail: Blob) => this.analyzeThumbnail(thumbnail),
        (hdImage: Blob) => this.handleHDImage(hdImage)
      );

      this.analysisActive.next(true);
      this.stats.isAnalyzing = true;
      this.updateStats();
      
      console.log('✅ Análisis en tiempo real iniciado');
    } catch (error) {
      console.error('❌ Error iniciando análisis:', error);
      throw error;
    }
  }

  /**
   * Detener análisis en tiempo real
   */
  stopRealTimeAnalysis(): void {
    console.log('⏹️ Deteniendo análisis en tiempo real...');
    
    this.cameraService.stopCapture();
    this.analysisActive.next(false);
    this.stats.isAnalyzing = false;
    this.updateStats();
    
    console.log('✅ Análisis detenido');
  }

  /**
   * Analizar thumbnail vía Socket.IO
   */
  private analyzeThumbnail(thumbnail: Blob): void {
    const startTime = Date.now();
    
    this.socketService.sendImageForAnalysis(thumbnail);
    
    this.stats.imagesAnalyzed++;
    this.stats.lastAnalysisTime = startTime;
    this.updateStats();
  }

  /**
   * Manejar imagen HD (guardar si se detecta placa)
   */
  private handleHDImage(hdImage: Blob): void {
    // Por ahora solo la almacenamos, se guardará si se detecta placa
    // En el futuro se podría implementar guardado automático
    console.log('📸 Imagen HD capturada (disponible para guardar)');
  }

  /**
   * Manejar resultado del análisis
   */
  private handleAnalysisResult(result: PlateDetectionResult): void {
    const processingTime = Date.now() - this.stats.lastAnalysisTime;
    
    // Actualizar estadísticas de tiempo de procesamiento
    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift(); // Mantener solo los últimos 100
    }
    
    this.stats.averageProcessingTime = 
      this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;

    // Si se detectó una placa
    if (result.hasPlate) {
      this.stats.platesDetected++;
      this.cameraService.incrementPlateDetection();
      
      console.log(`🎯 Placa detectada! Confianza: ${result.confidence}`);
      console.log(`📊 Total placas detectadas: ${this.stats.platesDetected}`);
    }

    this.updateStats();
  }

  /**
   * Actualizar estadísticas
   */
  private updateStats(): void {
    this.analysisStats.next({ ...this.stats });
  }

  /**
   * Observable del estado de análisis
   */
  get isAnalyzing$(): Observable<boolean> {
    return this.analysisActive.asObservable();
  }

  /**
   * Observable de estadísticas de análisis
   */
  get analysisStats$(): Observable<AnalysisStats> {
    return this.analysisStats.asObservable();
  }

  /**
   * Observable del estado de conexión Socket.IO
   */
  get isConnected$(): Observable<boolean> {
    return this.socketService.isConnected$();
  }

  /**
   * Observable de estadísticas de cámara
   */
  get cameraStats$(): Observable<any> {
    return this.cameraService.stats$;
  }

  /**
   * Obtener estadísticas actuales
   */
  getCurrentStats(): AnalysisStats {
    return { ...this.stats };
  }

  /**
   * Guardar imagen HD manualmente
   */
  async saveCurrentHDImage(): Promise<void> {
    // Esta funcionalidad se puede implementar más adelante
    // cuando se necesite guardar la imagen HD actual
    console.log('💾 Funcionalidad de guardado manual pendiente de implementar');
  }

  /**
   * Limpiar recursos
   */
  destroy(): void {
    this.stopRealTimeAnalysis();
    this.cameraService.stopCamera();
    this.socketService.disconnect();
  }
}
