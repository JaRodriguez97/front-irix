import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ImageAnalysisService } from '../../services/image-analysis.service';
import { SocketService } from '../../services/socket.service';
import { CameraService } from '../../services/camera.service';
import { BrowserCapabilitiesService } from '../../services/browser-capabilities.service';
import { Observable } from 'rxjs';
import { PlateDetectionResult } from '../../interfaces/plate-detection.interface';

@Component({
  selector: 'app-live-detection',
  templateUrl: './live-detection.component.html',
  styleUrls: ['./live-detection.component.css']
})
export class LiveDetectionComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('videoElement', { static: false }) videoElement?: ElementRef<HTMLVideoElement>;
  
  isAnalyzing$: Observable<boolean>;
  stats$: Observable<any>;
  isConnected$: Observable<boolean>;
  lastResult: PlateDetectionResult | null = null;
  isCameraActive = false;

  constructor(
    private imageAnalysisService: ImageAnalysisService,
    private socketService: SocketService,
    private cameraService: CameraService,
    private browserCapabilitiesService: BrowserCapabilitiesService
  ) {
    this.isAnalyzing$ = this.imageAnalysisService.isAnalyzing$;
    this.stats$ = this.imageAnalysisService.analysisStats$;
    this.isConnected$ = this.imageAnalysisService.isConnected$;
  }

  ngOnInit(): void {
    console.log('🚀 Iniciando componente de detección en vivo');
    
    // NO iniciar análisis automáticamente - esperar a que el usuario haga clic
    // this.startAnalysis(); // REMOVIDO
    
    // Escuchar resultados de análisis
    this.socketService.handleAnalysisResult().subscribe(result => {
      if (result) {
        console.log('📊 Resultado recibido:', result);
        this.lastResult = result;
      }
    });
  }

  ngAfterViewInit(): void {
    // Inicializar la cámara para mostrar el preview, pero sin análisis
    this.initializeCamera();
  }

  ngOnDestroy(): void {
    console.log('⏹️ Deteniendo componente de detección en vivo');
    this.stopCamera();
    this.imageAnalysisService.destroy();
  }

  async initializeCamera(): Promise<void> {
    try {
      console.log('📷 Inicializando preview de cámara...');
      
      const videoElement = await this.cameraService.initializeCamera();
      
      // Reemplazar el elemento video del template con el elemento configurado
      if (this.videoElement && videoElement) {
        const container = this.videoElement.nativeElement.parentNode;
        if (container) {
          container.replaceChild(videoElement, this.videoElement.nativeElement);
          this.isCameraActive = true;
          console.log('✅ Cámara inicializada correctamente');
        }
      }
    } catch (error) {
      console.error('❌ Error inicializando cámara:', error);
    }
  }

  stopCamera(): void {
    this.cameraService.stopCamera();
    this.isCameraActive = false;
  }

  async startAnalysis(): Promise<void> {
    try {
      await this.imageAnalysisService.startRealTimeAnalysis();
      console.log('✅ Análisis iniciado correctamente');
    } catch (error) {
      console.error('❌ Error iniciando análisis:', error);
    }
  }

  stopAnalysis(): void {
    this.imageAnalysisService.stopRealTimeAnalysis();
    console.log('⏹️ Análisis detenido');
  }

  getConnectionStatus(): string {
    // Este método se puede usar en el template
    return 'Conectando...';
  }

  getAnalysisRate(): string {
    // Calcular FPS basado en estadísticas
    return '0 FPS';
  }

  showCapabilitiesModal(): void {
    this.browserCapabilitiesService.showCapabilitiesModal();
  }
}
