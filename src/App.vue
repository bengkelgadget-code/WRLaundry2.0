<script setup>
import { onMounted } from 'vue';
import { useAppStore } from './stores/useAppStore';

const store = useAppStore();

onMounted(() => {
  store.fetchInitialData();
});
</script>

<template>
  <div id="app-root" class="w-full flex overflow-hidden text-slate-800 font-sans antialiased bg-slate-50" style="position: absolute; top: 0; bottom: 0; left: 0; right: 0;">
    <!-- GLOBAL LOADING -->
    <div v-if="store.isLoading" id="loading" class="fixed inset-0 bg-white/95 backdrop-blur-sm z-[110] flex flex-col items-center justify-center transition-opacity duration-300">
      <div id="loading-icon-box" class="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-slate-900/20 animate-bounce overflow-hidden">
        <i class="ph-bold ph-washing-machine text-3xl text-white"></i>
      </div>
      <p class="text-slate-500 font-bold tracking-widest uppercase text-[10px] text-center px-6">Menyiapkan Workspace...</p>
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
