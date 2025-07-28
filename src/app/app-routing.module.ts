import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LiveDetectionComponent } from './components/live-detection/live-detection.component';

const routes: Routes = [
  { path: '', redirectTo: '/live-detection', pathMatch: 'full' },
  { path: 'live-detection', component: LiveDetectionComponent },
  { path: '**', redirectTo: '/live-detection' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, {
    initialNavigation: 'enabledBlocking'
})],
  exports: [RouterModule]
})
export class AppRoutingModule { }
