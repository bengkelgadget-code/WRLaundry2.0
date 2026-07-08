<script setup>
import { computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';

const store = useAppStore();

const dashboardStats = computed(() => {
    let masuk = 0, proses = 0, selesai = 0, pendapatan = 0;
    const produksi = store.appData.produksi || [];
    
    const todayObj = new Date();
    const d = String(todayObj.getDate()).padStart(2, '0');
    const m = String(todayObj.getMonth() + 1).padStart(2, '0');
    const y = todayObj.getFullYear();
    const today1 = `${d}/${m}/${y}`;
    const today2 = `${todayObj.getDate()}/${todayObj.getMonth() + 1}/${y}`;

    produksi.forEach(item => {
        if (!item) return;
        const status = item['Status'] || '';
        if (status === 'Proses') {
            masuk++;
            proses++;
        } else if (status === 'Selesai' || status === 'Diambil') {
            selesai++;
        }
        
        const waktuMasuk = String(item['Waktu Masuk'] || '');
        if (waktuMasuk.includes(today1) || waktuMasuk.includes(today2) || waktuMasuk.includes(new Date().toLocaleDateString('id-ID'))) {
             let total = parseRupiah(item['Total Harga']);
             pendapatan += total;
        }
    });

    return { masuk, proses, selesai, pendapatan };
});

const recentTransactions = computed(() => {
    return (store.appData.produksi || []).slice(0, 5);
});

const parseRupiah = (val) => {
    if (typeof val === 'number') return Math.round(val);
    if (!val) return 0;
    if (typeof val === 'string') {
        if (val.includes('.') && !val.includes('Rp') && val.split('.')[1].length !== 3) {
            return Math.round(parseFloat(val)) || 0;
        }
        return parseInt(val.replace(/[^0-9]/g, '')) || 0;
    }
    return Math.round(parseFloat(val)) || 0;
};

const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(parseRupiah(angka));
};

const getCustomerName = (tx) => {
    if (tx['Nama Pelanggan']) return tx['Nama Pelanggan'];
    if (tx['ID Pelanggan']) {
        const cust = store.appData.pelanggan?.find(p => p.ID === tx['ID Pelanggan']);
        if (cust) return cust['Nama Pelanggan'] || cust.nama;
    }
    return 'Tanpa Nama';
};
</script>

<template>
    <div class="fade-in p-4 sm:p-6 w-full h-full flex-1 flex flex-col overflow-y-auto min-h-0">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6 shrink-0">
            <div class="relative overflow-hidden rounded-3xl p-6 shadow-lg shadow-blue-500/20 bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center text-white group hover:-translate-y-1 transition-transform duration-300">
                <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20 blur-[2px] group-hover:scale-110 transition-transform duration-500"></div>
                <div class="absolute -bottom-6 -right-2 w-16 h-16 rounded-full bg-white/10 blur-[1px] group-hover:scale-125 transition-transform duration-500"></div>
                <div class="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl mr-5 shadow-inner border border-white/10"><i class="ph-fill ph-download-simple text-white"></i></div>
                <div class="relative z-10"><p class="text-[11px] font-extrabold text-blue-100 uppercase tracking-wider mb-1">Pesanan Masuk</p><h3 class="text-3xl font-black">{{ dashboardStats.masuk }}</h3></div>
            </div>
            <div class="relative overflow-hidden rounded-3xl p-6 shadow-lg shadow-orange-500/20 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center text-white group hover:-translate-y-1 transition-transform duration-300">
                <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20 blur-[2px] group-hover:scale-110 transition-transform duration-500"></div>
                <div class="absolute -bottom-6 -right-2 w-16 h-16 rounded-full bg-white/10 blur-[1px] group-hover:scale-125 transition-transform duration-500"></div>
                <div class="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl mr-5 shadow-inner border border-white/10"><i class="ph-fill ph-spinner-gap animate-spin-slow text-white"></i></div>
                <div class="relative z-10"><p class="text-[11px] font-extrabold text-orange-100 uppercase tracking-wider mb-1">Sedang Proses</p><h3 class="text-3xl font-black">{{ dashboardStats.proses }}</h3></div>
            </div>
            <div class="relative overflow-hidden rounded-3xl p-6 shadow-lg shadow-teal-500/20 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center text-white group hover:-translate-y-1 transition-transform duration-300">
                <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20 blur-[2px] group-hover:scale-110 transition-transform duration-500"></div>
                <div class="absolute -bottom-6 -right-2 w-16 h-16 rounded-full bg-white/10 blur-[1px] group-hover:scale-125 transition-transform duration-500"></div>
                <div class="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl mr-5 shadow-inner border border-white/10"><i class="ph-fill ph-check-circle text-white"></i></div>
                <div class="relative z-10"><p class="text-[11px] font-extrabold text-teal-100 uppercase tracking-wider mb-1">Selesai / Diambil</p><h3 class="text-3xl font-black">{{ dashboardStats.selesai }}</h3></div>
            </div>
            <div class="relative overflow-hidden rounded-3xl p-6 shadow-lg shadow-indigo-500/20 bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center text-white group hover:-translate-y-1 transition-transform duration-300">
                <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20 blur-[2px] group-hover:scale-110 transition-transform duration-500"></div>
                <div class="absolute -bottom-6 -right-2 w-16 h-16 rounded-full bg-white/10 blur-[1px] group-hover:scale-125 transition-transform duration-500"></div>
                <div class="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl mr-4 shadow-inner border border-white/10"><i class="ph-fill ph-wallet text-white"></i></div>
                <div class="relative z-10 overflow-hidden w-full"><p class="text-[11px] font-extrabold text-indigo-100 uppercase tracking-wider mb-1">Pendapatan Hari Ini</p><h3 class="text-2xl sm:text-3xl font-black truncate">{{ formatRupiah(dashboardStats.pendapatan) }}</h3></div>
            </div>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col flex-1 overflow-hidden min-h-[300px] shrink-0">
            <div class="p-4 border-b border-slate-100 flex justify-between items-center bg-white z-10 shrink-0"><h3 class="text-md font-bold text-slate-800">5 Transaksi Terakhir</h3></div>
            <div class="overflow-auto flex-1 relative bg-white min-h-0">
                <table class="table-modern min-w-max">
                    <thead><tr><th>ID</th><th>Pelanggan</th><th>Layanan & Harga</th><th class="text-right">Status</th></tr></thead>
                    <tbody>
                        <tr v-for="tx in recentTransactions" :key="tx.ID">
                            <td>{{ tx.ID }}</td>
                            <td>{{ getCustomerName(tx) }}</td>
                            <td>{{ tx['Layanan'] }} <br> <span class="text-xs text-slate-400">{{ formatRupiah(tx['Total Harga']) }}</span></td>
                            <td class="text-right">
                                <span :class="['px-2 py-1 rounded-full text-xs font-bold', tx.Status === 'Proses' ? 'bg-orange-100 text-orange-600' : tx.Status === 'Selesai' ? 'bg-teal-100 text-teal-600' : 'bg-slate-100 text-slate-600']">{{ tx.Status }}</span>
                            </td>
                        </tr>
                        <tr v-if="recentTransactions.length === 0">
                            <td colspan="4" class="text-center py-8 text-slate-400">Belum ada transaksi</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
