import { Component, Input } from '@angular/core';

export interface StatsData {
  totalFramesCaptured: number;
  detectedPlates: number;
  averageFPS: number;
  totalImages: number;
  successRate?: number;
  processingTime?: number;
}

@Component({
  selector: 'app-stats-dashboard',
  templateUrl: './stats-dashboard.component.html',
  styleUrls: ['./stats-dashboard.component.css']
})
export class StatsDashboardComponent {
  @Input() cameraStats: StatsData = {
    totalFramesCaptured: 0,
    detectedPlates: 0,
    averageFPS: 0,
    totalImages: 0
  };

  @Input() storageStats: any = {
    totalImages: 0
  };

  get formattedStats() {
    return {
      framesProcessed: this.formatNumber(this.cameraStats.totalFramesCaptured),
      platesFound: this.formatNumber(this.cameraStats.detectedPlates),
      averageFPS: this.formatDecimal(this.cameraStats.averageFPS),
      imagesStored: this.formatNumber(this.storageStats.totalImages || 0),
      successRate: this.calculateSuccessRate(),
      processingTime: this.formatProcessingTime()
    };
  }

  private formatNumber(num: number): string {
    return num?.toLocaleString() || '0';
  }

  private formatDecimal(num: number): string {
    return num?.toFixed(1) || '0.0';
  }

  private calculateSuccessRate(): string {
    if (this.cameraStats.totalFramesCaptured === 0) return '0.0';
    const rate = (this.cameraStats.detectedPlates / this.cameraStats.totalFramesCaptured) * 100;
    return rate.toFixed(1);
  }

  private formatProcessingTime(): string {
    return this.cameraStats.processingTime ? 
      `${this.cameraStats.processingTime}ms` : 
      'N/A';
  }

  getSuccessRateColor(): string {
    const rate = parseFloat(this.calculateSuccessRate());
    if (rate >= 80) return '#4CAF50';
    if (rate >= 50) return '#FF9800';
    return '#F44336';
  }

  getFPSStatus(): 'excellent' | 'good' | 'poor' {
    const fps = this.cameraStats.averageFPS;
    if (fps >= 1.8) return 'excellent';
    if (fps >= 1.5) return 'good';
    return 'poor';
  }
}
