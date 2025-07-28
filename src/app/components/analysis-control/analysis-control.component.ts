import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-analysis-control',
  templateUrl: './analysis-control.component.html',
  styleUrls: ['./analysis-control.component.css']
})
export class AnalysisControlComponent {
  @Input() isCameraActive: boolean = false;
  @Input() isAnalyzing: boolean = false;
  @Input() isConnectedToWebSocket: boolean = false;
  
  @Output() startAnalysis = new EventEmitter<void>();
  @Output() stopAnalysis = new EventEmitter<void>();

  get canStartAnalysis(): boolean {
    return this.isCameraActive && this.isConnectedToWebSocket && !this.isAnalyzing;
  }

  get canStopAnalysis(): boolean {
    return this.isAnalyzing;
  }

  onStartAnalysis(): void {
    if (!this.canStartAnalysis) {
      console.warn('No se pueden iniciar análisis: requisitos no cumplidos');
      return;
    }
    this.startAnalysis.emit();
  }

  onStopAnalysis(): void {
    this.stopAnalysis.emit();
  }

  getStartButtonTooltip(): string {
    if (!this.isCameraActive) return 'Debe activar la cámara primero';
    if (!this.isConnectedToWebSocket) return 'Debe conectar WebSocket primero';
    if (this.isAnalyzing) return 'El análisis ya está en curso';
    return 'Iniciar análisis en tiempo real';
  }
}
