<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAppStore } from '../stores/useAppStore';

const props = defineProps({
    isOpen: Boolean
});

const emit = defineEmits(['close']);
const router = useRouter();
const route = useRoute();
const store = useAppStore();

const userProfileName = computed(() => store.currentUser?.Nama || 'Admin Utama');
const userProfileRole = computed(() => store.currentUser?.Role || 'Admin');
const userProfileAvatar = computed(() => userProfileName.value.charAt(0).toUpperCase());

const menuGroups = computed(() => {
    const isStaff = String(userProfileRole.value).toUpperCase() === 'STAFF';
    
    if (isStaff) {
        return [
            {
                title: 'MAIN MENU',
                items: [
                    { name: 'Kasir / Staff POS', icon: 'ph-desktop', path: '/admin/staff' }
                ]
            }
        ];
    }
    
    return [
        {
            title: 'MAIN MENU',
            items: [
                { name: 'Dashboard', icon: 'ph-squares-four', path: '/admin' },
                { name: 'Data Transaksi', icon: 'ph-list-dashes', path: '/admin/produksi' },
                { name: 'Kasir / Staff POS', icon: 'ph-desktop', path: '/admin/staff' }
            ]
        },
        {
            title: 'MASTER DATA',
            items: [
                { name: 'Data Pelanggan', icon: 'ph-users', path: '/admin/pelanggan' },
                { name: 'Waktu', icon: 'ph-clock', path: '/admin/layanan-waktu' },
                { name: 'Kiloan', icon: 'ph-scales', path: '/admin/layanan-kiloan' },
                { name: 'Satuan', icon: 'ph-t-shirt', path: '/admin/layanan-satuan' },
                { name: 'Master Pewangi', icon: 'ph-drop', path: '/admin/layanan-pewangi' },
                { name: 'Paket Member', icon: 'ph-star', path: '/admin/layanan-member' }
            ]
        },
        {
            title: 'SYSTEM',
            items: [
                { name: 'Kelola User', icon: 'ph-user-gear', path: '/admin/users' },
                { name: 'Pengaturan', icon: 'ph-gear', path: '/admin/pengaturan' }
            ]
        }
    ];
});

const logout = () => {
    localStorage.removeItem('zettbotUserAuth');
    store.currentUser = null;
    router.push('/');
};

// Handle active state matching (especially for /admin which could falsely match /admin/*)
const isActivePath = (path) => {
    if (path === '/admin') {
        return route.path === '/admin' || route.path === '/admin/';
    }
    return route.path.startsWith(path);
};
</script>

<template>
    <!-- BACKDROP -->
    <div v-if="isOpen" @click="emit('close')" class="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[50] transition-opacity duration-300 md:hidden"></div>
    
    <aside :class="['bg-white w-[260px] h-full shadow-[4px_0_24px_rgba(0,0,0,0.08)] flex flex-col transition-transform duration-300 ease-in-out transform absolute md:relative z-[60] shrink-0', isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0']">
        <div class="h-20 py-3 flex items-center justify-center px-4 border-b border-slate-100 shrink-0 gap-3 w-full">
            <button @click="emit('close')" class="md:hidden absolute left-4 w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors active:scale-95 shrink-0">
                <i class="ph-bold ph-list text-xl"></i>
            </button>
            <div class="flex items-center justify-center overflow-hidden min-w-0 px-1">
                <div class="font-black tracking-tight text-center leading-tight uppercase flex flex-col items-center">
                    <span class="text-teal-500 text-xl md:text-2xl">WAROENK</span>
                    <span class="text-slate-800 text-lg md:text-xl -mt-1">LAUNDRY</span>
                </div>
            </div>
        </div>
        
        <div class="flex-1 overflow-y-auto py-6 px-4 space-y-6">
            <div v-for="group in menuGroups" :key="group.title">
                <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 px-2">{{ group.title }}</h3>
                <div class="space-y-1">
                    <router-link v-for="item in group.items" :key="item.name" :to="item.path" custom v-slot="{ navigate }">
                        <div @click="navigate(); emit('close')" :class="['flex items-center px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-300 group font-bold', isActivePath(item.path) ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30' : 'text-slate-600 hover:bg-teal-500 hover:text-white hover:shadow-lg hover:shadow-teal-500/30']">
                            <i :class="['ph-bold text-xl mr-3', item.icon, isActivePath(item.path) ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors']"></i>
                            <span class="text-[13px] tracking-wide">{{ item.name }}</span>
                        </div>
                    </router-link>
                </div>
            </div>
        </div>
        
        <div class="p-4 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <div class="flex items-center px-3 py-2 rounded-2xl bg-white shadow-sm border border-slate-100">
                <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white font-black mr-3 uppercase">{{ userProfileAvatar }}</div>
                <div class="flex-1 overflow-hidden">
                    <p class="text-sm font-bold text-slate-800 capitalize truncate">{{ userProfileName }}</p>
                    <p class="text-[10px] font-black text-slate-500 tracking-wider">ROLE: {{ userProfileRole.toUpperCase() }}</p>
                </div>
                <button @click="logout" title="Logout" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors">
                    <i class="ph-bold ph-sign-out text-lg"></i>
                </button>
            </div>
        </div>
    </aside>
</template>
