<script setup>
import { ref } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import BluetoothManagerModal from './BluetoothManagerModal.vue';

const props = defineProps({
    title: {
        type: String,
        default: 'Dashboard'
    }
});
const emit = defineEmits(['toggleSidebar']);
const store = useAppStore();

const refreshData = () => {
    store.fetchInitialData();
};
</script>

<template>
    <header class="h-16 glass flex items-center justify-between px-4 sm:px-6 z-10 border-b border-slate-200/50 shrink-0">
        <div class="flex items-center">
            <button @click="emit('toggleSidebar')" class="md:hidden text-slate-600 hover:text-teal-600 mr-3 p-2 bg-slate-100 rounded-xl transition-colors active:scale-95">
                <i class="ph-bold ph-list text-xl"></i>
            </button>
            <h1 class="text-xl font-black text-slate-800 tracking-tight">{{ title }}</h1>
        </div>
        <div class="flex items-center space-x-2">
            <button @click="store.isBluetoothModalOpen = true" class="relative text-slate-500 hover:text-teal-600 transition-colors p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 shadow-sm active:scale-95" title="Bluetooth Printer">
                <i class="ph-bold ph-printer text-xl"></i>
                <div v-if="store.connectedPrinter" class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-slate-100 rounded-full"></div>
            </button>
            <button @click="refreshData" class="text-slate-500 hover:text-slate-800 transition-colors p-2.5 bg-slate-100 rounded-xl hover:bg-slate-200 shadow-sm active:scale-95" title="Refresh Data">
                <i :class="['ph-bold ph-arrows-clockwise text-xl', store.isLoading ? 'animate-spin' : '']"></i>
            </button>
        </div>
        
        <BluetoothManagerModal :is-open="store.isBluetoothModalOpen" @close="store.isBluetoothModalOpen = false" />
    </header>
</template>
