<script setup>
import { ref, watch } from 'vue';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { useAppStore } from '../stores/useAppStore';

const props = defineProps({
  isOpen: Boolean,
});

const emit = defineEmits(['close']);

const store = useAppStore();
const devices = ref([]);
const isScanning = ref(false);
const isConnecting = ref(false);
const connectionError = ref('');

const close = () => {
  emit('close');
};

const loadPairedDevices = async () => {
  isScanning.value = true;
  connectionError.value = '';
  try {
    const isEnabled = await BluetoothSerial.isEnabled();
    if (!isEnabled) {
      connectionError.value = 'Bluetooth belum dinyalakan di HP Anda.';
      isScanning.value = false;
      return;
    }
    const result = await BluetoothSerial.list();
    devices.value = result.devices || [];
  } catch (err) {
    console.error(err);
    connectionError.value = 'Gagal memuat daftar perangkat bluetooth.';
  } finally {
    isScanning.value = false;
  }
};

const connectDevice = async (device) => {
  isConnecting.value = true;
  connectionError.value = '';
  try {
    // Attempt to disconnect first just in case
    try { await BluetoothSerial.disconnect(); } catch(e){}
    
    await BluetoothSerial.connect({ address: device.address });
    store.setPrinter(device);
    close();
  } catch (err) {
    console.error(err);
    connectionError.value = 'Gagal koneksi ke ' + device.name + '. Pastikan printer menyala.';
  } finally {
    isConnecting.value = false;
  }
};

const disconnectDevice = async () => {
  try {
    await BluetoothSerial.disconnect();
  } catch (e) {}
  store.setPrinter(null);
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadPairedDevices();
  }
});
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col relative modal-enter overflow-hidden">
      <!-- Header -->
      <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-20">
        <div class="flex items-center gap-2">
            <i class="ph-bold ph-printer text-teal-500 text-xl"></i>
            <h3 class="text-lg font-black text-slate-800 tracking-tight">Printer Bluetooth</h3>
        </div>
        <button type="button" @click="close" class="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors">
            <i class="ph-bold ph-x"></i>
        </button>
      </div>

      <!-- Body -->
      <div class="p-5 overflow-y-auto max-h-[60vh] bg-slate-50">
        <!-- Current connected -->
        <div v-if="store.connectedPrinter" class="mb-6 bg-teal-50 border border-teal-100 rounded-2xl p-4 flex items-center justify-between">
            <div>
                <p class="text-[10px] font-bold text-teal-600 uppercase tracking-wider mb-1">Terkoneksi Saat Ini</p>
                <p class="font-bold text-slate-800">{{ store.connectedPrinter.name }}</p>
                <p class="text-xs text-slate-500">{{ store.connectedPrinter.address }}</p>
            </div>
            <button @click="disconnectDevice" class="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center hover:bg-red-200">
                <i class="ph-bold ph-power"></i>
            </button>
        </div>

        <div class="flex justify-between items-center mb-3">
            <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">Perangkat Tersimpan (Paired)</p>
            <button @click="loadPairedDevices" class="text-teal-600 text-sm font-semibold flex items-center gap-1 hover:text-teal-700">
                <i class="ph-bold ph-arrows-clockwise" :class="{'animate-spin': isScanning}"></i> Refresh
            </button>
        </div>
        
        <div v-if="connectionError" class="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-start gap-2">
            <i class="ph-fill ph-warning-circle text-lg mt-0.5"></i>
            <p>{{ connectionError }}</p>
        </div>

        <div v-if="devices.length === 0 && !isScanning" class="text-center py-8">
            <div class="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                <i class="ph-bold ph-bluetooth text-2xl"></i>
            </div>
            <p class="text-slate-500 text-sm">Tidak ada perangkat tersimpan.</p>
            <p class="text-xs text-slate-400 mt-1">Lakukan pairing/sandingkan printer melalui Pengaturan Bluetooth HP Anda terlebih dahulu.</p>
        </div>

        <div v-else class="space-y-2">
            <div v-for="device in devices" :key="device.address" 
                 @click="connectDevice(device)"
                 class="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-teal-300 hover:shadow-md transition-all active:scale-[0.98]"
                 :class="{'opacity-50 pointer-events-none': isConnecting}">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <i class="ph-bold ph-printer"></i>
                    </div>
                    <div>
                        <p class="font-bold text-slate-800 text-sm">{{ device.name || 'Unknown Device' }}</p>
                        <p class="text-xs text-slate-500">{{ device.address }}</p>
                    </div>
                </div>
                <div v-if="isConnecting && store.connectedPrinter?.address !== device.address" class="text-teal-500">
                    <i class="ph-bold ph-spinner animate-spin text-xl"></i>
                </div>
                <div v-else class="w-6 h-6 rounded-full border-2 border-slate-200 flex items-center justify-center">
                    <i class="ph-bold ph-caret-right text-slate-300 text-xs"></i>
                </div>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-enter {
  animation: modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes modalSlideUp {
  0% { opacity: 0; transform: translateY(20px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
