import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { ImageAnalysisService } from '../../services/image-analysis.service';

@Component({
  selector: 'app-camera-control',
  templateUrl: './camera-control.component.html',
  styleUrls: ['./camera-control.component.css']
})
export class CameraControlComponent implements OnInit, OnDestroy {
  isCameraActive: boolean = false;
  isConnectedToSocket: boolean = false;
  isAnalyzing: boolean = false;
  
  private subscriptions: Subscription[] = [];

  constructor(private imageAnalysisService: ImageAnalysisService) {}

  ngOnInit(): void {
    // Suscribirse al estado de conexión Socket.IO
    this.subscriptions.push(
      this.imageAnalysisService.isConnected$.subscribe(connected => {
        this.isConnectedToSocket = connected;
      })
    );

    // Suscribirse al estado de análisis
    this.subscriptions.push(
      this.imageAnalysisService.isAnalyzing$.subscribe(analyzing => {
        this.isAnalyzing = analyzing;
        this.isCameraActive = analyzing;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async onStartCamera(): Promise<void> {
    if (!this.isConnectedToSocket) {
      console.warn('🚫 Socket.IO no conectado');
      return;
    }

    if (this.isAnalyzing) {
      console.warn('⚠️ Análisis ya en progreso');
      return;
    }

    try {
      console.log('🚀 Iniciando análisis en tiempo real...');
      await this.imageAnalysisService.startRealTimeAnalysis();
    } catch (error) {
      console.error('❌ Error iniciando cámara:', error);
    }
  }

  onStopCamera(): void {
    if (!this.isAnalyzing) {
      console.warn('⚠️ No hay análisis activo');
      return;
    }

    console.log('⏹️ Deteniendo análisis...');
    this.imageAnalysisService.stopRealTimeAnalysis();
  }
}
