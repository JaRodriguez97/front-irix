import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { saveAs } from 'file-saver';
import { StoredImage } from '../interfaces/plate-detection.interface';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private storedImagesSubject = new BehaviorSubject<StoredImage[]>([]);
  private readonly STORAGE_KEY = 'irix_stored_images';
  private readonly MAX_STORED_IMAGES = 100; // Máximo de imágenes en memoria

  public storedImages$ = this.storedImagesSubject.asObservable();
  private imageCache: Map<string, Blob> = new Map();
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (this.isBrowser) {
      this.loadStoredImages();
    }
  }

  /**
   * Guardar imagen HD automáticamente en el dispositivo
   */
  async saveHDImageToDevice(
    imageBlob: Blob,
    detectedPlates?: string[],
    vehicleColor?: string,
    vehicleDescription?: string
  ): Promise<string> {
    const timestamp = Date.now();
    const imageId = this.generateImageId();
    const filename = this.generateFilename(timestamp, detectedPlates);

    try {
      // Crear objeto de imagen almacenada
      const storedImage: StoredImage = {
        id: imageId,
        timestamp,
        filename,
        blob: imageBlob,
        detectedPlates,
        vehicleColor,
        vehicleDescription
      };

      // Almacenar en caché
      this.imageCache.set(imageId, imageBlob);

      // Agregar a la lista
      this.addStoredImage(storedImage);

      // Descargar automáticamente (solo en browser)
      if (this.isBrowser) {
        saveAs(imageBlob, filename);
      }

      console.log(`💾 Imagen HD guardada automáticamente: ${filename}`);
      return imageId;

    } catch (error) {
      console.error('❌ Error guardando imagen HD:', error);
      throw error;
    }
  }

  /**
   * Guardar imagen HD en memoria para revisión posterior
   */
  saveHDImageInMemory(
    imageBlob: Blob,
    detectedPlates?: string[],
    vehicleColor?: string,
    vehicleDescription?: string
  ): string {
    const timestamp = Date.now();
    const imageId = this.generateImageId();
    const filename = this.generateFilename(timestamp, detectedPlates);

    const storedImage: StoredImage = {
      id: imageId,
      timestamp,
      filename,
      blob: imageBlob,
      detectedPlates,
      vehicleColor,
      vehicleDescription
    };

    // Almacenar en caché y lista
    this.imageCache.set(imageId, imageBlob);
    this.addStoredImage(storedImage);

    console.log(`💿 Imagen HD almacenada en memoria: ${filename}`);
    return imageId;
  }

  /**
   * Descargar imagen específica por ID
   */
  async downloadImageById(imageId: string): Promise<void> {
    if (!this.isBrowser) {
      console.log('🚫 Descarga de archivos no disponible en entorno SSR');
      return;
    }

    const storedImages = this.storedImagesSubject.value;
    const image = storedImages.find(img => img.id === imageId);

    if (!image) {
      throw new Error(`Imagen con ID ${imageId} no encontrada`);
    }

    const blob = this.imageCache.get(imageId);
    if (!blob) {
      throw new Error(`Blob de imagen ${imageId} no encontrado en caché`);
    }

    saveAs(blob, image.filename);
    console.log(`⬇️ Descargando imagen: ${image.filename}`);
  }

  /**
   * Descargar todas las imágenes con placas detectadas
   */
  async downloadAllPlateImages(): Promise<void> {
    if (!this.isBrowser) {
      console.log('🚫 Descarga de archivos no disponible en entorno SSR');
      return;
    }

    const storedImages = this.storedImagesSubject.value;
    const plateImages = storedImages.filter(img => img.detectedPlates && img.detectedPlates.length > 0);

    if (plateImages.length === 0) {
      console.log('📁 No hay imágenes con placas detectadas para descargar');
      return;
    }

    for (const image of plateImages) {
      const blob = this.imageCache.get(image.id);
      if (blob) {
        saveAs(blob, image.filename);
        // Pequeño delay entre descargas
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`📦 Descargando ${plateImages.length} imágenes con placas detectadas`);
  }

  /**
   * Obtener estadísticas de almacenamiento
   */
  getStorageStats(): {
    totalImages: number;
    imagesWithPlates: number;
    totalSizeEstimate: string;
    oldestImage?: Date;
    newestImage?: Date;
  } {
    const storedImages = this.storedImagesSubject.value;
    const imagesWithPlates = storedImages.filter(img => img.detectedPlates && img.detectedPlates.length > 0);
    
    // Estimar tamaño total (promedio 2MB por imagen HD)
    const avgImageSize = 2 * 1024 * 1024; // 2MB
    const totalSizeBytes = storedImages.length * avgImageSize;
    const totalSizeEstimate = this.formatFileSize(totalSizeBytes);

    const timestamps = storedImages.map(img => img.timestamp);
    const oldestImage = timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined;
    const newestImage = timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined;

    return {
      totalImages: storedImages.length,
      imagesWithPlates: imagesWithPlates.length,
      totalSizeEstimate,
      oldestImage,
      newestImage
    };
  }

  /**
   * Limpiar imágenes antiguas para liberar memoria
   */
  clearOldImages(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - maxAge; // 24 horas por defecto
    const storedImages = this.storedImagesSubject.value;
    
    const recentImages = storedImages.filter(img => img.timestamp > cutoffTime);
    const removedCount = storedImages.length - recentImages.length;

    // Limpiar caché de imágenes removidas
    storedImages.forEach(img => {
      if (img.timestamp <= cutoffTime) {
        this.imageCache.delete(img.id);
      }
    });

    this.storedImagesSubject.next(recentImages);
    this.saveStoredImages();

    if (removedCount > 0) {
      console.log(`🧹 Limpiadas ${removedCount} imágenes antiguas`);
    }
  }

  /**
   * Limpiar todas las imágenes almacenadas
   */
  clearAllImages(): void {
    this.storedImagesSubject.next([]);
    this.imageCache.clear();
    this.saveStoredImages();
    console.log('🗑️ Todas las imágenes almacenadas han sido eliminadas');
  }

  /**
   * Agregar imagen a la lista almacenada
   */
  private addStoredImage(storedImage: StoredImage): void {
    const currentImages = this.storedImagesSubject.value;
    const updatedImages = [storedImage, ...currentImages];

    // Mantener solo las últimas MAX_STORED_IMAGES
    if (updatedImages.length > this.MAX_STORED_IMAGES) {
      const removedImages = updatedImages.slice(this.MAX_STORED_IMAGES);
      removedImages.forEach(img => this.imageCache.delete(img.id));
      updatedImages.splice(this.MAX_STORED_IMAGES);
    }

    this.storedImagesSubject.next(updatedImages);
    this.saveStoredImages();
  }

  /**
   * Generar ID único para imagen
   */
  private generateImageId(): string {
    return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generar nombre de archivo optimizado para placas vehiculares
   */
  private generateFilename(timestamp: number, detectedPlates?: string[]): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const time = date.toTimeString().slice(0, 8).replace(/:/g, '-');
    
    const dateStr = `${year}${month}${day}_${time}`;
    
    if (detectedPlates && detectedPlates.length > 0) {
      // Limpiar placas para nombre de archivo seguro
      const plateStr = detectedPlates
        .join('_')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .slice(0, 20); // Limitar longitud
      
      return `IRIX_PLACA_${plateStr}_${dateStr}.jpg`;
    }
    
    return `IRIX_VEHÍCULO_${dateStr}.jpg`;
  }

  /**
   * Obtener ruta de almacenamiento sugerida (para uso futuro con File System Access API)
   */
  getSuggestedStoragePath(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    
    // Ruta sugerida para organización automática
    return `/IRIX_PLACAS/${year}/${month}/`;
  }

  /**
   * Formatear tamaño de archivo
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cargar imágenes almacenadas desde localStorage
   */
  private loadStoredImages(): void {
    if (!this.isBrowser) {
      console.log('🚫 localStorage no disponible en entorno SSR');
      return;
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const images: Omit<StoredImage, 'blob'>[] = JSON.parse(stored);
        // Solo cargar metadatos, no los blobs (por rendimiento)
        console.log(`📂 Cargados metadatos de ${images.length} imágenes almacenadas`);
      }
    } catch (error) {
      console.error('❌ Error cargando imágenes almacenadas:', error);
    }
  }

  /**
   * Guardar metadatos de imágenes en localStorage
   */
  private saveStoredImages(): void {
    if (!this.isBrowser) {
      return;
    }
    
    try {
      const images = this.storedImagesSubject.value;
      // Solo guardar metadatos, no los blobs
      const metadata = images.map(({ blob, ...meta }) => meta);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.error('❌ Error guardando metadatos de imágenes:', error);
    }
  }
}
