import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Servicios
import { CameraService } from './services/camera.service';
import { StorageService } from './services/storage.service';
import { SocketService } from './services/socket.service';
import { ImageAnalysisService } from './services/image-analysis.service';

// Componentes especializados aplicando principios SOLID (SRP)
import { CameraControlComponent } from './components/camera-control/camera-control.component';
import { AnalysisControlComponent } from './components/analysis-control/analysis-control.component';
import { StatsDashboardComponent } from './components/stats-dashboard/stats-dashboard.component';
import { LiveDetectionComponent } from './components/live-detection/live-detection.component';

@NgModule({
  declarations: [
    AppComponent,
    // Componentes con responsabilidades específicas
    CameraControlComponent,
    AnalysisControlComponent,
    StatsDashboardComponent,
    LiveDetectionComponent
  ],
  imports: [
    BrowserModule.withServerTransition({ appId: 'serverApp' }),
    CommonModule,
    FormsModule,
    AppRoutingModule
  ],
  providers: [
    CameraService,
    StorageService,
    SocketService,
    ImageAnalysisService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
