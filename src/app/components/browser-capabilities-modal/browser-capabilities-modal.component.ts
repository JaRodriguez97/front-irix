import { Component, OnInit } from '@angular/core';
import { BrowserCapabilitiesService, BrowserCapabilities } from '../../services/browser-capabilities.service';

@Component({
  selector: 'app-browser-capabilities-modal',
  templateUrl: './browser-capabilities-modal.component.html',
  styleUrls: ['./browser-capabilities-modal.component.scss']
})
export class BrowserCapabilitiesModalComponent implements OnInit {
  capabilities: BrowserCapabilities | null = null;
  showModal: boolean = false;

  constructor(private browserCapabilitiesService: BrowserCapabilitiesService) {}

  ngOnInit(): void {
    this.browserCapabilitiesService.getCapabilities().subscribe(capabilities => {
      this.capabilities = capabilities;
    });
    this.browserCapabilitiesService.getModalState().subscribe(show => {
      this.showModal = show;
    });
  }

  closeModal(): void {
    this.browserCapabilitiesService.hideCapabilitiesModal();
  }
}
