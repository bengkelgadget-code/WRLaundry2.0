<script setup>
import { ref, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';

const store = useAppStore();
const selectedMonth = ref('');

// Initialize month filter to current month (YYYY-MM)
const initDate = new Date();
const initMonthStr = String(initDate.getMonth() + 1).padStart(2, '0');
selectedMonth.value = `${initDate.getFullYear()}-${initMonthStr}`;

const parseTxDate = (dateStr) => {
    if (!dateStr) return null;
    const str = String(dateStr).trim().split(' ')[0];
    if (str.includes('-') && str.split('-')[0].length === 4) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) return d;
    }
    const parts = str.split(/[/-]/);
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            return new Date(year, month, day);
        }
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
};

const getTransactionKg = (tx) => {
    if (!tx) return 0;
    let totalKg = 0;

    // 1. Try parsing from Detail Layanan JSON
    if (tx['Detail Layanan JSON']) {
        try {
            const parsed = JSON.parse(tx['Detail Layanan JSON']);
            const items = parsed.items || (Array.isArray(parsed) ? parsed : []);
            let foundInJson = false;
            items.forEach(item => {
                const satuan = String(item.satuan || '').toLowerCase();
                if (satuan === 'kg') {
                    totalKg += parseFloat(item.qty) || 0;
                    foundInJson = true;
                }
            });
            if (foundInJson && totalKg > 0) return Math.round(totalKg * 10) / 10;
        } catch (e) {
            // ignore JSON errors
        }
    }

    // 2. Try regex matching on "Layanan" text field (e.g., "Cuci Kering x 5Kg")
    if (tx['Layanan']) {
        const regex = /x?\s*([\d.]+)\s*kg/gi;
        let match;
        let foundInText = false;
        while ((match = regex.exec(tx['Layanan'])) !== null) {
            totalKg += parseFloat(match[1]) || 0;
            foundInText = true;
        }
        if (foundInText && totalKg > 0) return Math.round(totalKg * 10) / 10;
    }

    // 3. Fallback to Kg Terpakai if present
    if (tx['Kg Terpakai'] && parseFloat(tx['Kg Terpakai']) > 0) {
        return Math.round(parseFloat(tx['Kg Terpakai']) * 10) / 10;
    }

    return Math.round(totalKg * 10) / 10;
};

const dashboardStats = computed(() => {
    let masuk = 0, proses = 0, selesai = 0, pendapatan = 0;
    const produksi = store.appData.produksi || [];
    
    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    produksi.forEach(item => {
        if (!item) return;
        const status = item['Status'] || '';
        if (status === 'Proses') {
            proses++;
        } else if (status === 'Selesai' || status === 'Diambil') {
            selesai++;
        }
        
        const txDate = parseTxDate(item['Waktu Masuk']);
        if (txDate && txDate.getFullYear() === todayY && txDate.getMonth() === todayM && txDate.getDate() === todayD) {
            masuk++;
            pendapatan += parseRupiah(item['Total Harga']);
        }
    });

    return { masuk, proses, selesai, pendapatan };
});

const laporanKg = computed(() => {
    const produksi = store.appData.produksi || [];
    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();
    const todayD = today.getDate();

    // 7 days rolling period (6 days ago + today)
    const weekStart = new Date(todayY, todayM, todayD - 6, 0, 0, 0);
    const weekEnd = new Date(todayY, todayM, todayD, 23, 59, 59);

    // Selected month parsing
    let selY = todayY;
    let selM = todayM + 1;
    if (selectedMonth.value && selectedMonth.value.includes('-')) {
        const parts = selectedMonth.value.split('-');
        selY = parseInt(parts[0], 10);
        selM = parseInt(parts[1], 10);
    }

    let harian = { kg: 0, trx: 0, pendapatan: 0 };
    let mingguan = { kg: 0, trx: 0, pendapatan: 0 };
    let bulanan = { kg: 0, trx: 0, pendapatan: 0 };

    produksi.forEach(item => {
        if (!item) return;
        const txDate = parseTxDate(item['Waktu Masuk']);
        if (!txDate) return;

        const kg = getTransactionKg(item);
        const rp = parseRupiah(item['Total Harga']);

        // Harian
        if (txDate.getFullYear() === todayY && txDate.getMonth() === todayM && txDate.getDate() === todayD) {
            harian.kg += kg;
            harian.trx += 1;
            harian.pendapatan += rp;
        }

        // Mingguan (7 Hari Terakhir)
        if (txDate >= weekStart && txDate <= weekEnd) {
            mingguan.kg += kg;
            mingguan.trx += 1;
            mingguan.pendapatan += rp;
        }

        // Bulanan (Filter)
        if (txDate.getFullYear() === selY && (txDate.getMonth() + 1) === selM) {
            bulanan.kg += kg;
            bulanan.trx += 1;
            bulanan.pendapatan += rp;
        }
    });

    const formatShortDate = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

    return {
        harian: {
            kg: Math.round(harian.kg * 10) / 10,
            trx: harian.trx,
            pendapatan: harian.pendapatan
        },
        mingguan: {
            kg: Math.round(mingguan.kg * 10) / 10,
            trx: mingguan.trx,
            pendapatan: mingguan.pendapatan,
            startDateStr: formatShortDate(weekStart),
            endDateStr: formatShortDate(today)
        },
        bulanan: {
            kg: Math.round(bulanan.kg * 10) / 10,
            trx: bulanan.trx,
            pendapatan: bulanan.pendapatan
        }
    };
});

const recentTransactions = computed(() => {
    return (store.appData.produksi || []).slice(0, 10);
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

const formatWaktu = (val) => {
    if (!val) return '-';
    return String(val);
};
</script>

<template>
    <div class="fade-in p-4 sm:p-6 w-full h-full flex-1 flex flex-col overflow-y-auto min-h-0">
        <!-- TOP KPI OVERVIEW CARDS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 shrink-0">
            <div class="relative overflow-hidden rounded-3xl p-6 shadow-lg shadow-blue-500/20 bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center text-white group hover:-translate-y-1 transition-transform duration-300">
                <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20 blur-[2px] group-hover:scale-110 transition-transform duration-500"></div>
                <div class="absolute -bottom-6 -right-2 w-16 h-16 rounded-full bg-white/10 blur-[1px] group-hover:scale-125 transition-transform duration-500"></div>
                <div class="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl mr-5 shadow-inner border border-white/10"><i class="ph-fill ph-download-simple text-white"></i></div>
                <div class="relative z-10"><p class="text-[0.6875rem] font-extrabold text-blue-100 uppercase tracking-wider mb-1">Pesanan Hari Ini</p><h3 class="text-3xl font-black">{{ dashboardStats.masuk }}</h3></div>
            </div>
            <div class="relative overflow-hidden rounded-3xl p-6 shadow-lg shadow-orange-500/20 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center text-white group hover:-translate-y-1 transition-transform duration-300">
                <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20 blur-[2px] group-hover:scale-110 transition-transform duration-500"></div>
                <div class="absolute -bottom-6 -right-2 w-16 h-16 rounded-full bg-white/10 blur-[1px] group-hover:scale-125 transition-transform duration-500"></div>
                <div class="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl mr-5 shadow-inner border border-white/10"><i class="ph-fill ph-spinner-gap animate-spin-slow text-white"></i></div>
                <div class="relative z-10"><p class="text-[0.6875rem] font-extrabold text-orange-100 uppercase tracking-wider mb-1">Sedang Proses</p><h3 class="text-3xl font-black">{{ dashboardStats.proses }}</h3></div>
            </div>
            <div class="relative overflow-hidden rounded-3xl p-6 shadow-lg shadow-teal-500/20 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center text-white group hover:-translate-y-1 transition-transform duration-300">
                <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20 blur-[2px] group-hover:scale-110 transition-transform duration-500"></div>
                <div class="absolute -bottom-6 -right-2 w-16 h-16 rounded-full bg-white/10 blur-[1px] group-hover:scale-125 transition-transform duration-500"></div>
                <div class="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl mr-5 shadow-inner border border-white/10"><i class="ph-fill ph-check-circle text-white"></i></div>
                <div class="relative z-10"><p class="text-[0.6875rem] font-extrabold text-teal-100 uppercase tracking-wider mb-1">Selesai / Diambil</p><h3 class="text-3xl font-black">{{ dashboardStats.selesai }}</h3></div>
            </div>
            <div class="relative overflow-hidden rounded-3xl p-6 shadow-lg shadow-indigo-500/20 bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center text-white group hover:-translate-y-1 transition-transform duration-300">
                <div class="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/20 blur-[2px] group-hover:scale-110 transition-transform duration-500"></div>
                <div class="absolute -bottom-6 -right-2 w-16 h-16 rounded-full bg-white/10 blur-[1px] group-hover:scale-125 transition-transform duration-500"></div>
                <div class="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl mr-4 shadow-inner border border-white/10"><i class="ph-fill ph-wallet text-white"></i></div>
                <div class="relative z-10 overflow-hidden w-full"><p class="text-[0.6875rem] font-extrabold text-indigo-100 uppercase tracking-wider mb-1">Pendapatan Hari Ini</p><h3 class="text-2xl sm:text-3xl font-black truncate">{{ formatRupiah(dashboardStats.pendapatan) }}</h3></div>
            </div>
        </div>

        <!-- NEW SECTION: LAPORAN LAUNDRY MASUK (KG) & PENDAPATAN -->
        <div class="mb-8 shrink-0">
            <div class="flex flex-col sm:flex-row justify-between sm:items-end gap-2 mb-4">
                <div>
                    <h2 class="text-xl font-black text-slate-800 flex items-center gap-2.5">
                        <span class="w-2.5 h-7 bg-gradient-to-b from-emerald-500 via-teal-500 to-blue-600 rounded-full inline-block shadow-sm"></span>
                        Laporan Beban Masuk (KG) & Omzet Pendapatan
                    </h2>
                    <p class="text-xs font-semibold text-slate-500 mt-1 ml-5">Pantau performa beban cucian dan total pendapatan secara real-time untuk Harian, Mingguan, dan Bulanan</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- CARD 1: HARIAN -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:shadow-lg hover:border-emerald-400 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
                    <div class="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-500/15 via-teal-500/5 to-transparent rounded-bl-[120px] pointer-events-none group-hover:scale-110 transition-transform duration-500"></div>
                    <div>
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-5">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-600 flex items-center justify-center text-2xl shadow-inner border border-emerald-200/60">
                                    <i class="ph-bold ph-sun"></i>
                                </div>
                                <div>
                                    <span class="inline-block px-2.5 py-0.5 rounded-full text-[0.65rem] font-black tracking-wider uppercase bg-emerald-100 text-emerald-700 mb-0.5">Harian</span>
                                    <h4 class="text-sm font-extrabold text-slate-700">Hari Ini</h4>
                                </div>
                            </div>
                            <span class="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/60 shadow-2xs">{{ new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) }}</span>
                        </div>

                        <!-- Dual Hero Metrics -->
                        <div class="space-y-3 my-3">
                            <!-- Metric 1: Beban Laundry -->
                            <div class="bg-gradient-to-r from-emerald-50/80 to-teal-50/40 p-4 rounded-2xl border border-emerald-200/60 flex items-center justify-between shadow-2xs">
                                <div>
                                    <p class="text-[0.6875rem] font-black uppercase tracking-wider text-emerald-700 mb-1 flex items-center gap-1.5">
                                        <i class="ph-bold ph-scales text-sm text-emerald-600"></i> Beban Laundry Masuk
                                    </p>
                                    <div class="flex items-baseline gap-2">
                                        <span class="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">{{ laporanKg.harian.kg }}</span>
                                        <span class="text-sm font-black text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300/50">KG</span>
                                    </div>
                                </div>
                                <div class="w-11 h-11 rounded-xl bg-white text-emerald-600 shadow-sm flex items-center justify-center text-2xl border border-emerald-100 shrink-0">
                                    <i class="ph-fill ph-barbell"></i>
                                </div>
                            </div>

                            <!-- Metric 2: Total Pendapatan -->
                            <div class="bg-gradient-to-br from-emerald-500 to-teal-600 p-4 px-5 rounded-2xl shadow-md shadow-emerald-500/20 text-white flex items-center justify-between group-hover:shadow-lg transition-shadow">
                                <div class="overflow-hidden w-full mr-3">
                                    <p class="text-[0.6875rem] font-black uppercase tracking-wider text-emerald-100 mb-1 flex items-center gap-1.5">
                                        <i class="ph-bold ph-wallet text-sm text-white"></i> Total Omzet / Pendapatan
                                    </p>
                                    <div class="text-2xl sm:text-3xl font-black truncate text-white tracking-tight">
                                        {{ formatRupiah(laporanKg.harian.pendapatan) }}
                                    </div>
                                </div>
                                <div class="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md text-white shrink-0 flex items-center justify-center text-2xl border border-white/30 shadow-inner">
                                    <i class="ph-fill ph-coins"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Details -->
                    <div class="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 text-slate-700">
                            <i class="ph-fill ph-receipt text-emerald-500 text-sm"></i>
                            Volume: <strong class="text-slate-900 font-black">{{ laporanKg.harian.trx }} Pesanan</strong>
                        </span>
                        <span v-if="laporanKg.harian.trx > 0" class="text-[0.7rem] bg-emerald-50 text-emerald-700 font-black px-2.5 py-1 rounded-xl border border-emerald-100">
                            ~{{ formatRupiah(laporanKg.harian.pendapatan / laporanKg.harian.trx) }}/trx
                        </span>
                    </div>
                </div>

                <!-- CARD 2: MINGGUAN -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:shadow-lg hover:border-blue-400 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
                    <div class="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-blue-500/15 via-cyan-500/5 to-transparent rounded-bl-[120px] pointer-events-none group-hover:scale-110 transition-transform duration-500"></div>
                    <div>
                        <!-- Header -->
                        <div class="flex items-center justify-between mb-5">
                            <div class="flex items-center gap-3">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 text-blue-600 flex items-center justify-center text-2xl shadow-inner border border-blue-200/60">
                                    <i class="ph-bold ph-calendar-check"></i>
                                </div>
                                <div>
                                    <span class="inline-block px-2.5 py-0.5 rounded-full text-[0.65rem] font-black tracking-wider uppercase bg-blue-100 text-blue-700 mb-0.5">Mingguan</span>
                                    <h4 class="text-sm font-extrabold text-slate-700">7 Hari Terakhir</h4>
                                </div>
                            </div>
                            <span class="text-xs font-bold text-blue-700 bg-blue-50/90 px-3 py-1.5 rounded-xl border border-blue-200/60 shadow-2xs">{{ laporanKg.mingguan.startDateStr }} - {{ laporanKg.mingguan.endDateStr }}</span>
                        </div>

                        <!-- Dual Hero Metrics -->
                        <div class="space-y-3 my-3">
                            <!-- Metric 1: Beban Laundry -->
                            <div class="bg-gradient-to-r from-blue-50/80 to-cyan-50/40 p-4 rounded-2xl border border-blue-200/60 flex items-center justify-between shadow-2xs">
                                <div>
                                    <p class="text-[0.6875rem] font-black uppercase tracking-wider text-blue-700 mb-1 flex items-center gap-1.5">
                                        <i class="ph-bold ph-scales text-sm text-blue-600"></i> Beban Laundry Masuk
                                    </p>
                                    <div class="flex items-baseline gap-2">
                                        <span class="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">{{ laporanKg.mingguan.kg }}</span>
                                        <span class="text-sm font-black text-blue-700 uppercase bg-blue-100 px-2 py-0.5 rounded-md border border-blue-300/50">KG</span>
                                    </div>
                                </div>
                                <div class="w-11 h-11 rounded-xl bg-white text-blue-600 shadow-sm flex items-center justify-center text-2xl border border-blue-100 shrink-0">
                                    <i class="ph-fill ph-barbell"></i>
                                </div>
                            </div>

                            <!-- Metric 2: Total Pendapatan -->
                            <div class="bg-gradient-to-br from-blue-500 to-cyan-600 p-4 px-5 rounded-2xl shadow-md shadow-blue-500/20 text-white flex items-center justify-between group-hover:shadow-lg transition-shadow">
                                <div class="overflow-hidden w-full mr-3">
                                    <p class="text-[0.6875rem] font-black uppercase tracking-wider text-blue-100 mb-1 flex items-center gap-1.5">
                                        <i class="ph-bold ph-wallet text-sm text-white"></i> Total Omzet / Pendapatan
                                    </p>
                                    <div class="text-2xl sm:text-3xl font-black truncate text-white tracking-tight">
                                        {{ formatRupiah(laporanKg.mingguan.pendapatan) }}
                                    </div>
                                </div>
                                <div class="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md text-white shrink-0 flex items-center justify-center text-2xl border border-white/30 shadow-inner">
                                    <i class="ph-fill ph-coins"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Details -->
                    <div class="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 text-slate-700">
                            <i class="ph-fill ph-receipt text-blue-500 text-sm"></i>
                            Volume: <strong class="text-slate-900 font-black">{{ laporanKg.mingguan.trx }} Pesanan</strong>
                        </span>
                        <span v-if="laporanKg.mingguan.trx > 0" class="text-[0.7rem] bg-blue-50 text-blue-700 font-black px-2.5 py-1 rounded-xl border border-blue-100">
                            ~{{ formatRupiah(laporanKg.mingguan.pendapatan / laporanKg.mingguan.trx) }}/trx
                        </span>
                    </div>
                </div>

                <!-- CARD 3: BULANAN DENGAN FILTER -->
                <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 hover:shadow-lg hover:border-purple-400 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
                    <div class="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-purple-500/15 via-fuchsia-500/5 to-transparent rounded-bl-[120px] pointer-events-none group-hover:scale-110 transition-transform duration-500"></div>
                    <div>
                        <!-- Header & Month Filter -->
                        <div class="flex items-center justify-between gap-2 mb-5">
                            <div class="flex items-center gap-3 shrink-0">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-100 to-fuchsia-100 text-purple-600 flex items-center justify-center text-2xl shadow-inner border border-purple-200/60">
                                    <i class="ph-bold ph-chart-bar"></i>
                                </div>
                                <div>
                                    <span class="inline-block px-2.5 py-0.5 rounded-full text-[0.65rem] font-black tracking-wider uppercase bg-purple-100 text-purple-700 mb-0.5">Bulanan</span>
                                    <h4 class="text-sm font-extrabold text-slate-700">Filter Bulan</h4>
                                </div>
                            </div>
                            <div class="relative flex items-center z-10">
                                <input 
                                    type="month" 
                                    v-model="selectedMonth" 
                                    class="bg-purple-50 hover:bg-purple-100/80 focus:bg-white text-purple-700 text-xs font-black px-3 py-1.5 rounded-xl border border-purple-200 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 transition-all outline-none shadow-2xs cursor-pointer"
                                    title="Pilih Bulan untuk Analisa"
                                />
                            </div>
                        </div>

                        <!-- Dual Hero Metrics -->
                        <div class="space-y-3 my-3">
                            <!-- Metric 1: Beban Laundry -->
                            <div class="bg-gradient-to-r from-purple-50/80 to-fuchsia-50/40 p-4 rounded-2xl border border-purple-200/60 flex items-center justify-between shadow-2xs">
                                <div>
                                    <p class="text-[0.6875rem] font-black uppercase tracking-wider text-purple-700 mb-1 flex items-center gap-1.5">
                                        <i class="ph-bold ph-scales text-sm text-purple-600"></i> Beban Laundry Masuk
                                    </p>
                                    <div class="flex items-baseline gap-2">
                                        <span class="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">{{ laporanKg.bulanan.kg }}</span>
                                        <span class="text-sm font-black text-purple-700 uppercase bg-purple-100 px-2 py-0.5 rounded-md border border-purple-300/50">KG</span>
                                    </div>
                                </div>
                                <div class="w-11 h-11 rounded-xl bg-white text-purple-600 shadow-sm flex items-center justify-center text-2xl border border-purple-100 shrink-0">
                                    <i class="ph-fill ph-barbell"></i>
                                </div>
                            </div>

                            <!-- Metric 2: Total Pendapatan -->
                            <div class="bg-gradient-to-br from-purple-600 to-indigo-600 p-4 px-5 rounded-2xl shadow-md shadow-purple-500/20 text-white flex items-center justify-between group-hover:shadow-lg transition-shadow">
                                <div class="overflow-hidden w-full mr-3">
                                    <p class="text-[0.6875rem] font-black uppercase tracking-wider text-purple-100 mb-1 flex items-center gap-1.5">
                                        <i class="ph-bold ph-wallet text-sm text-white"></i> Total Omzet / Pendapatan
                                    </p>
                                    <div class="text-2xl sm:text-3xl font-black truncate text-white tracking-tight">
                                        {{ formatRupiah(laporanKg.bulanan.pendapatan) }}
                                    </div>
                                </div>
                                <div class="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-md text-white shrink-0 flex items-center justify-center text-2xl border border-white/30 shadow-inner">
                                    <i class="ph-fill ph-coins"></i>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Details -->
                    <div class="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span class="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 text-slate-700">
                            <i class="ph-fill ph-receipt text-purple-500 text-sm"></i>
                            Volume: <strong class="text-slate-900 font-black">{{ laporanKg.bulanan.trx }} Pesanan</strong>
                        </span>
                        <span v-if="laporanKg.bulanan.trx > 0" class="text-[0.7rem] bg-purple-50 text-purple-700 font-black px-2.5 py-1 rounded-xl border border-purple-100">
                            ~{{ formatRupiah(laporanKg.bulanan.pendapatan / laporanKg.bulanan.trx) }}/trx
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- RECENT TRANSACTIONS TABLE WITH KG EXPIRED VALUE -->
        <div class="bg-white rounded-3xl shadow-sm border border-slate-200/80 flex flex-col flex-1 overflow-hidden min-h-[350px] shrink-0">
            <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 z-10 shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg font-bold border border-slate-200/80">
                        <i class="ph-bold ph-list-numbers"></i>
                    </div>
                    <div>
                        <h3 class="text-md font-extrabold text-slate-800">10 Transaksi Terakhir</h3>
                        <p class="text-[0.7rem] font-medium text-slate-400">Daftar aktivitas cucian terbaru beserta rincian berat dan harga</p>
                    </div>
                </div>
            </div>
            <div class="overflow-auto flex-1 relative bg-white min-h-0">
                <table class="table-modern min-w-max">
                    <thead>
                        <tr>
                            <th>ID & TANGGAL</th>
                            <th>PELANGGAN</th>
                            <th>LAYANAN & BERAT (KG)</th>
                            <th>TOTAL BIAYA</th>
                            <th class="text-right">STATUS</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="tx in recentTransactions" :key="tx.ID" class="hover:bg-blue-50/40 transition-colors">
                            <td>
                                <span class="font-black text-slate-800 block text-sm">{{ tx.ID }}</span>
                                <span class="text-[0.7rem] text-slate-400 font-medium flex items-center gap-1 mt-0.5"><i class="ph-fill ph-clock text-slate-300"></i>{{ formatWaktu(tx['Waktu Masuk']) }}</span>
                            </td>
                            <td>
                                <span class="font-extrabold text-slate-800 text-sm">{{ getCustomerName(tx) }}</span>
                            </td>
                            <td>
                                <div class="flex items-center gap-2">
                                    <span class="font-bold text-slate-700 text-xs">{{ tx['Layanan'] }}</span>
                                    <span v-if="getTransactionKg(tx) > 0" class="px-2 py-0.5 bg-teal-50 border border-teal-200/80 text-teal-700 font-black text-[0.6875rem] rounded-lg shadow-2xs">
                                        {{ getTransactionKg(tx) }} KG
                                    </span>
                                </div>
                            </td>
                            <td>
                                <span class="font-extrabold text-slate-800 text-sm">{{ formatRupiah(tx['Total Harga']) }}</span>
                            </td>
                            <td class="text-right">
                                <span :class="['px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-block shadow-2xs border', 
                                    tx.Status === 'Proses' ? 'bg-orange-50 text-orange-600 border-orange-200/80' : 
                                    tx.Status === 'Selesai' ? 'bg-teal-50 text-teal-600 border-teal-200/80' : 
                                    'bg-slate-50 text-slate-600 border-slate-200/80']">
                                    {{ tx.Status }}
                                </span>
                            </td>
                        </tr>
                        <tr v-if="recentTransactions.length === 0">
                            <td colspan="5" class="text-center py-12 text-slate-400 font-medium">
                                <div class="flex flex-col items-center justify-center">
                                    <i class="ph-bold ph-inbox text-4xl text-slate-300 mb-2"></i>
                                    <span>Belum ada transaksi di dalam sistem</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</template>
