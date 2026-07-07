<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import Sidebar from '../components/Sidebar.vue';
import Header from '../components/Header.vue';

const isSidebarOpen = ref(false);
const route = useRoute();

const masterConfig = {
    'pelanggan': 'Data Pelanggan',
    'layanan-waktu': 'Layanan Waktu',
    'layanan-kiloan': 'Layanan Kiloan',
    'layanan-satuan': 'Layanan Satuan',
    'layanan-pewangi': 'Master Pewangi',
    'layanan-member': 'Paket Member',
    'users': 'Kelola User',
    'pengaturan': 'Pengaturan Sistem'
};

const pageTitle = computed(() => {
    if (route.path === '/admin/produksi') return 'Data Transaksi';
    if (route.path === '/admin/pengaturan' || route.name === 'admin-pengaturan') return 'Pengaturan Sistem';
    if (route.params.sheet && masterConfig[route.params.sheet]) {
        return masterConfig[route.params.sheet];
    }
    return 'Dashboard';
});
</script>

<template>
    <div class="flex h-screen w-full">
        <Sidebar :isOpen="isSidebarOpen" @close="isSidebarOpen = false" />
        
        <div id="main-content" class="flex-1 flex flex-col min-w-0 bg-slate-50/50 relative overflow-hidden h-full">
            <Header v-if="route.path !== '/admin/staff'" :title="pageTitle" @toggle-sidebar="isSidebarOpen = !isSidebarOpen" class="shrink-0" />
            <div class="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                <router-view v-slot="{ Component }">
                    <component :is="Component" />
                </router-view>
            </div>
        </div>
    </div>
</template>
