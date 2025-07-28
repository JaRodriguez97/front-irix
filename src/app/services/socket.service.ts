import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { io, Socket } from 'socket.io-client';
import { PlateDetectionResult } from '../interfaces/plate-detection.interface';
import { environment } from '../../environments/environment';
import { WebPDetectionService } from './webp-detection.service';

@Injectable({
  providedIn: 'root'
})
export class SocketService {
  private socket!: Socket;
  private connected = new BehaviorSubject<boolean>(false);
  private messages = new BehaviorSubject<PlateDetectionResult | null>(null);

  private readonly SOCKET_URL = environment.apiUrl;
  private clientId: string = '';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private webPDetectionService: WebPDetectionService
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.connectToSocket();
    }
  }

  connectToSocket(): void {
    if (!this.isBrowser) {
      console.log('🚫 Socket.IO no disponible en entorno SSR');
      return;
    }
    
    try {
      this.socket = io(this.SOCKET_URL, {
        reconnectionAttempts: this.maxReconnectAttempts
      });

      this.socket.on('connect', () => {
        console.log('🔗 Conectado al servidor Socket.IO');
        this.connected.next(true);
        this.reconnectAttempts = 0;
      });

      this.socket.on('disconnect', () => {
        console.log('📵 Desconectado del servidor Socket.IO');
        this.connected.next(false);
        this.attemptReconnect();
      });

      this.socket.on('analysis-result', (data: PlateDetectionResult) => {
        this.messages.next(data);
      });

      this.socket.on('error', (error: any) => {
        console.error('❌ Error en Socket.IO:', error);
      });
    } catch (error) {
      console.error('❌ Error conectando Socket.IO:', error);
      this.attemptReconnect();
    }
  }

  attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Intentando reconectar... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connectToSocket();
      }, 2000 * this.reconnectAttempts); // Backoff exponencial
    } else {
      console.error('❌ Máximo de intentos de reconexión alcanzado');
    }
  }

  async sendImageForAnalysis(imageBlob: Blob): Promise<void> {
    if (!this.socket || !this.socket.connected) {
      console.error('❌ Socket.IO no conectado');
      return;
    }

    // Obtener capacidades WebP para optimizar formato
    const preferredFormat = await this.webPDetectionService.getPreferredFormat();
    const optimizationStats = this.webPDetectionService.getOptimizationStats();
    
    console.log('🚀 OPTIMIZACIÓN WebP:', {
      formatoOriginal: imageBlob.type,
      formatoPreferido: preferredFormat,
      tamaño: imageBlob.size,
      ahorroEsperado: optimizationStats.expectedSaving,
      socketConnected: this.socket.connected
    });

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        const imageData = new Uint8Array(reader.result as ArrayBuffer);
        
        console.log('🎨 Imagen procesada con optimización:', {
          arrayLength: imageData.length,
          formatoFinal: preferredFormat,
          reducciónTamaño: `${((1 - imageData.length / 36000) * 100).toFixed(1)}%`
        });
        
        // Formatear datos optimizados según capacidades del navegador
        const payload = {
          clientId: this.clientId,
          data: imageData,
          format: preferredFormat, // Usar formato optimizado (WebP si está disponible)
          size: imageData.length,
          optimization: {
            originalFormat: imageBlob.type,
            targetFormat: preferredFormat,
            expectedSaving: optimizationStats.expectedSaving
          }
        };
        
        console.log(`📤 Enviando imagen optimizada: ${payload.size} bytes (${preferredFormat})`);
        this.socket.emit('analyze-image', payload);
      } else {
        console.error('❌ FileReader result is null');
      }
    };
    
    reader.onerror = (error) => {
      console.error('❌ Error leyendo archivo:', error);
    };
    
    reader.readAsArrayBuffer(imageBlob);
  }

  handleAnalysisResult(): Observable<PlateDetectionResult | null> {
    return this.messages.asObservable();
  }

  isConnected$(): Observable<boolean> {
    return this.connected.asObservable();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
