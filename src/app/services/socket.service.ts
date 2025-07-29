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

    // FORZAR WebP - Ya no depende de detección automática
    const forcedFormat = 'image/webp';
    
    console.log('🚀 CONVERSIÓN WebP FORZADA:', {
      formatoOriginal: imageBlob.type,
      formatoForzado: forcedFormat,
      tamañoOriginal: imageBlob.size,
      socketConnected: this.socket.connected
    });

    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        const imageData = new Uint8Array(reader.result as ArrayBuffer);
        
        console.log('🎨 Imagen WebP lista para envío:', {
          arrayLength: imageData.length,
          formatoFinal: forcedFormat,
          tamañoFinalKB: `${(imageData.length / 1024).toFixed(2)}KB`
        });
        
        // Payload optimizado con WebP forzado
        const payload = {
          clientId: this.clientId,
          data: imageData,
          format: forcedFormat, // SIEMPRE WebP
          size: imageData.length,
          optimization: {
            originalFormat: imageBlob.type,
            targetFormat: forcedFormat,
            forced: true // Indicar que es conversión forzada
          }
        };
        
        console.log(`📤 Enviando imagen WebP: ${payload.size} bytes`);
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
