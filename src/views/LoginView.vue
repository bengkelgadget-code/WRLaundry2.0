<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/useAppStore';

const router = useRouter();
const store = useAppStore();

const username = ref('');
const password = ref('');

const handleLogin = () => {
    // In a real app we would check `store.appData.users`
    // but the original code has a hardcoded check or simple checks.
    // For now we simulate it.
    const users = store.appData.users || [];
    let found = users.find(u => u['Username'] === username.value && String(u['Password']) === String(password.value));
    
    // Also support default admin if DB is empty
    if (username.value === 'admin' && password.value === 'admin123') {
        found = { 'Username': 'admin', 'Role': 'Admin', 'Nama': 'Admin Utama' };
    }

    if (found) {
        localStorage.setItem('zettbotUserAuth', JSON.stringify(found));
        store.currentUser = found;
        
        if (String(found['Role']).toUpperCase() === 'STAFF') {
            router.push('/staff');
        } else {
            router.push('/admin');
        }
    } else {
        alert('Username atau password salah!');
    }
};
</script>

<template>
    <div class="fixed inset-0 bg-slate-100/80 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-6 transition-all duration-500">
        <div class="absolute inset-0 overflow-hidden pointer-events-none"><div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-200/40 rounded-full blur-[80px]"></div><div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-200/40 rounded-full blur-[80px]"></div></div>
        <div class="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-md overflow-hidden flex flex-col fade-in z-10 transition-all">
            <div class="p-10 pb-6 flex flex-col items-center relative">
                <div class="w-16 h-16 bg-slate-900 rounded-[1rem] flex items-center justify-center mb-6 shadow-lg shadow-slate-900/10 overflow-hidden">
                    <i class="ph-bold ph-washing-machine text-3xl text-white"></i>
                </div>
                <h2 class="text-2xl font-black text-slate-800 tracking-tight mb-1 text-center">Waroenk Laundry</h2>
                <p class="text-[0.6875rem] text-slate-400 font-bold tracking-widest uppercase">System Authorization</p>
            </div>
            <div class="p-10 pt-4 bg-white/50">
                <form @submit.prevent="handleLogin">
                    <div class="mb-5 group">
                        <label class="block text-[0.625rem] font-bold text-slate-400 mb-2 uppercase tracking-widest transition-colors group-focus-within:text-slate-700">Username</label>
                        <div class="relative flex items-center">
                            <i class="ph-bold ph-user absolute left-4 text-slate-400 text-lg transition-colors group-focus-within:text-slate-700"></i>
                            <input type="text" v-model="username" required class="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-50 outline-none transition-all font-semibold text-slate-700 text-sm" placeholder="Masukkan username">
                        </div>
                    </div>
                    <div class="mb-8 group">
                        <label class="block text-[0.625rem] font-bold text-slate-400 mb-2 uppercase tracking-widest transition-colors group-focus-within:text-slate-700">Password</label>
                        <div class="relative flex items-center">
                            <i class="ph-bold ph-lock-key absolute left-4 text-slate-400 text-lg transition-colors group-focus-within:text-slate-700"></i>
                            <input type="password" v-model="password" required class="w-full pl-12 pr-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-50 outline-none transition-all font-semibold text-slate-700 text-sm" placeholder="••••••••">
                        </div>
                    </div>
                    <button type="submit" class="w-full bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-bold tracking-wide py-4 px-4 rounded-xl shadow-lg shadow-teal-500/30 transition-all flex items-center justify-center text-[0.875rem] active:scale-[0.98]">
                        MASUK <i class="ph-bold ph-arrow-right ml-2 text-lg"></i>
                    </button>
                </form>
            </div>
        </div>
    </div>
</template>
