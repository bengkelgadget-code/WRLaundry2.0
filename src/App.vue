<script setup>
import { onMounted } from 'vue';
import { useAppStore } from './stores/useAppStore';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App as CapacitorApp } from '@capacitor/app';
import { useRouter } from 'vue-router';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';

const store = useAppStore();
const router = useRouter();

onMounted(async () => {
  store.fetchInitialData();
  store.initBluetooth();
  
  // Set initial zoom
  document.documentElement.style.fontSize = store.appZoom + 'px';
  
  // Request All Permissions at Startup (as requested by user)
  const requestPermissions = async () => {
    const hasRequested = localStorage.getItem('permissions_requested');
    if (!hasRequested) {
      try {
        // Request Camera Permission for Barcode Scanner
        await BarcodeScanner.requestPermissions();
        // Request Bluetooth & Location Permissions
        await BluetoothSerial.enable();
        
        localStorage.setItem('permissions_requested', 'true');
      } catch (e) {
        console.error("Failed to request permissions on startup", e);
      }
    }
  };
  requestPermissions();
  
  try {
    await CapacitorUpdater.notifyAppReady();
    
    // Check for self-hosted updates from Vercel
    const checkForUpdates = async () => {
      try {
        // Cache buster is important so it doesn't get a stale version.json
        const response = await fetch('https://wr-laundry.vercel.app/version.json', { cache: 'no-store' });
        const data = await response.json();
        
        const currentVersion = localStorage.getItem('app_version');
        if (data.version && data.version !== currentVersion) {
          console.log('New update found:', data.version);
          
          // Optionally notify user here (using custom toast/alert)
          // For now, it will silently download and apply
          const version = await CapacitorUpdater.download({
            url: `https://wr-laundry.vercel.app${data.url}`,
            version: data.version
          });
          
          localStorage.setItem('app_version', data.version);
          await CapacitorUpdater.set(version);
        }
      } catch (err) {
        console.error('Failed to check for updates', err);
      }
    };
    
    checkForUpdates();

  } catch (e) {
    console.log("CapacitorUpdater not available in web", e);
  }

  // Hardware Back Button Handler
  CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    // Check if any modal close button exists (like the X button in Bluetooth modal)
    // We look for button elements that contain a close icon (ph-x) within modal containers
    const closeBtn = document.querySelector('.modal-enter button i.ph-x');
    if (closeBtn && closeBtn.closest('button')) {
      closeBtn.closest('button').click();
      return;
    }

    // Otherwise standard back navigation based on Vue Router
    const currentPath = router.currentRoute.value.path;
    // Exit app if on root (login) or main dashboard views
    if (currentPath === '/' || currentPath === '/admin' || currentPath === '/admin/staff') {
      CapacitorApp.exitApp();
    } else {
      router.back();
    }
  });
});
</script>

<template>
  <div id="app-root" class="w-full flex overflow-hidden text-slate-800 font-sans antialiased bg-slate-50">
    <!-- GLOBAL LOADING -->
    <div v-if="store.isLoading" id="loading" class="fixed inset-0 bg-white/95 backdrop-blur-sm z-[110] flex flex-col items-center justify-center transition-opacity duration-300">
      <div id="loading-icon-box" class="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-slate-900/20 animate-bounce overflow-hidden">
        <i class="ph-bold ph-washing-machine text-3xl text-white"></i>
      </div>
      <p class="text-slate-500 font-bold tracking-widest uppercase text-[0.625rem] text-center px-6">Menyiapkan Workspace...</p>
    </div>

    <!-- GLOBAL TOAST (placeholder, you can implement a useToast store later) -->
    <div id="toast" style="z-index: 99999;" class="fixed top-5 right-5 transform translate-x-[150%] transition-transform duration-300 flex items-center bg-slate-900 shadow-2xl rounded-2xl p-4 max-w-sm">
      <i class="ph-fill ph-check-circle text-emerald-400 text-2xl mr-3"></i>
      <span class="font-semibold text-white text-sm">Berhasil!</span>
    </div>

    <!-- ROUTER VIEW -->
    <router-view />
  </div>
</template>

<style>
/* We'll handle phosphor icons loading via a CDN or npm package properly */
</style>
