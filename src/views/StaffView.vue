<script setup>
import { ref, computed, defineAsyncComponent, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { useAppStore } from '../stores/useAppStore';
import { generateReceiptHTML, actionPrintReceipt, actionSendWA, actionSharePDF, actionShareJPG } from '../utils/posUtils';
import { getDatabase, ref as dbRef, update } from 'firebase/database';
const TransactionFormModal = defineAsyncComponent(() => import('../components/TransactionFormModal.vue'));
const BluetoothManagerModal = defineAsyncComponent(() => import('../components/BluetoothManagerModal.vue'));

const store = useAppStore();
const router = useRouter();

const searchQuery = ref('');
const filterStatus = ref('');
const filterDate = ref('');

const isDetailModalOpen = ref(false);
const selectedTx = ref(null);

const openDetailModal = (tx) => {
    selectedTx.value = { ...tx };
    isDetailModalOpen.value = true;
};

const closeDetailModal = () => {
    isDetailModalOpen.value = false;
    selectedTx.value = null;
};

const saveDetailStatus = async () => {
    if (!selectedTx.value) return;
    try {
        await store.updateRecord('Produksi', selectedTx.value.ID, {
            Status: selectedTx.value.Status,
            Pembayaran: selectedTx.value.Pembayaran
        });
        // Success
        closeDetailModal();
    } catch (e) {
        alert("Gagal menyimpan status: " + e.message);
    }
};

const isTxFormOpen = ref(false);
const txFormInitialData = ref(null);

const openAddTransaction = () => {
    txFormInitialData.value = null;
    isTxFormOpen.value = true;
};

const openEditRincian = () => {
    txFormInitialData.value = { ...selectedTx.value };
    isTxFormOpen.value = true;
    closeDetailModal();
};

const isSuccessModalOpen = ref(false);
const savedTxPreview = ref(null);

const handleTxSaved = (payload) => {
    isTxFormOpen.value = false;
    if (payload) {
        savedTxPreview.value = payload;
        isSuccessModalOpen.value = true;
    }
};

const closeSuccessModal = () => {
    isSuccessModalOpen.value = false;
    savedTxPreview.value = null;
};

const filteredTransactions = computed(() => {
    let data = store.appData.produksi || [];

    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        data = data.filter(d => 
            String(d['Nama Pelanggan']||'').toLowerCase().includes(q) || 
            String(d['No Nota']||'').toLowerCase().includes(q) ||
            String(d['Layanan']||'').toLowerCase().includes(q)
        );
    }
    if (filterStatus.value) {
        data = data.filter(d => d.Status === filterStatus.value);
    }
    if (filterDate.value) {
        data = data.filter(d => {
            if (!d['Waktu Masuk']) return false;
            // Assuming Waktu Masuk is in DD/MM/YYYY format or similar
            // This might need adjustment based on exact date format
            return d['Waktu Masuk'].includes(filterDate.value) || d['Waktu Masuk'].includes(filterDate.value.split('-').reverse().join('/'));
        });
    }
    
    return data;
});

const currentPage = ref(1);
const itemsPerPage = ref(15);

const totalPages = computed(() => {
    return Math.max(1, Math.ceil(filteredTransactions.value.length / itemsPerPage.value));
});

const transactions = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;
    return filteredTransactions.value.slice(start, end);
});

const totalTransaksiHariIni = computed(() => {
    const todayId = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
    const todayIso = new Date().toISOString().split('T')[0];
    return (store.appData.produksi || []).filter(d => {
        if (!d['Waktu Masuk']) return false;
        const w = String(d['Waktu Masuk']);
        return w.includes(todayId) || w.includes(todayIso);
    }).length;
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

const getEstimasiSelesai = (tx) => {
    let est = '+1 Hari';
    try {
        const parsed = JSON.parse(tx['Detail Layanan JSON'] || '{}');
        const items = Array.isArray(parsed) ? parsed : (parsed.items || []);
        if (items.length > 0) {
            est = items[0].estimasiSelesai ? String(items[0].estimasiSelesai).split(' - ')[0].split(' ')[0] : '+1 Hari';
            for(let i=1; i<items.length; i++){
                const currEst = items[i].estimasiSelesai ? String(items[i].estimasiSelesai).split(' - ')[0].split(' ')[0] : '+1 Hari';
                if(currEst !== est){ est = "Bervariasi"; break; }
            }
        }
    } catch(e) {}
    return est;
};

const logout = () => {
    localStorage.removeItem('zettbotUserAuth');
    store.currentUser = null;
    router.push('/');
};

const goAdmin = () => {
    router.push('/admin');
};

// Pull to refresh logic
const scrollContainer = ref(null);
const isPulling = ref(false);
const pullDistance = ref(0);
const isRefreshing = ref(false);
let startY = 0;

const handleTouchStart = (e) => {
    if (scrollContainer.value && scrollContainer.value.scrollTop <= 5) {
        startY = e.touches[0].clientY;
        isPulling.value = true;
    } else {
        isPulling.value = false;
    }
};

const handleTouchMove = (e) => {
    if (!isPulling.value || isRefreshing.value) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    
    if (diff > 0 && scrollContainer.value.scrollTop <= 5) {
        if (e.cancelable) e.preventDefault(); // Prevent native pull-to-refresh
        pullDistance.value = Math.min(diff * 0.4, 80);
    } else {
        pullDistance.value = 0;
    }
};

const handleTouchEnd = async () => {
    if (!isPulling.value || isRefreshing.value) return;
    
    if (pullDistance.value > 50) {
        forceRefresh();
    } else {
        pullDistance.value = 0;
        isPulling.value = false;
    }
};

const forceRefresh = async () => {
    isRefreshing.value = true;
    pullDistance.value = 50;
    
    // Reset filters
    filterDate.value = '';
    searchQuery.value = '';
    filterStatus.value = '';
    currentPage.value = 1;

    try {
        const minDelay = new Promise(resolve => setTimeout(resolve, 800));
        await Promise.all([store.fetchInitialData(), minDelay]);
    } finally {
        isRefreshing.value = false;
        pullDistance.value = 0;
        isPulling.value = false;
    }
};

// Barcode Scanner
const startScan = async () => {
    try {
        const { camera } = await BarcodeScanner.requestPermissions();
        if (camera !== 'granted' && camera !== 'limited') {
            alert("Akses kamera ditolak.");
            return;
        }
        
        // This will launch the native Google ML Kit scanner overlay
        const { barcodes } = await BarcodeScanner.scan();
        if (barcodes && barcodes.length > 0) {
            searchQuery.value = barcodes[0].displayValue;
            currentPage.value = 1;
        }
    } catch (e) {
        console.error("Barcode scan error", e);
        if(e.message && e.message.includes('not implemented')) {
            alert('Fitur scanner hanya tersedia di APK Native Android.');
        } else {
            alert("Gagal scan: " + e.message);
        }
    }
};
</script>

<template>
    <div class="flex-1 flex flex-col h-full w-full overflow-hidden relative bg-slate-50">
        <!-- Header POS -->
        <div class="px-4 py-3 bg-white border-b border-slate-100 flex justify-center items-center z-20 shrink-0 shadow-sm w-full">
            <div class="w-full max-w-3xl flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center shadow-md shadow-slate-900/10 overflow-hidden shrink-0"><i class="ph-bold ph-washing-machine text-white"></i></div>
                    <h1 class="font-black text-slate-800 tracking-tight text-lg truncate">Waroenk Laundry POS</h1>
                </div>
                <div class="flex items-center gap-2">
                    <button v-if="String(store.currentUser?.Role || '').toUpperCase() === 'ADMIN'" @click="goAdmin" class="w-9 h-9 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-all duration-300 active:scale-95 shadow-sm"><i class="ph-bold ph-squares-four text-lg"></i></button>
                    <button @click="router.push('/admin/pengaturan')" title="Pengaturan Aplikasi" class="relative w-9 h-9 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-all duration-300 active:scale-95 shadow-sm">
                        <i class="ph-bold ph-gear text-lg"></i>
                        <div v-if="store.connectedPrinter" class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-100 rounded-full"></div>
                    </button>
                    <button @click="logout" title="Logout" class="w-9 h-9 bg-red-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all duration-300 active:scale-95 shadow-sm"><i class="ph-bold ph-power text-lg"></i></button>
                </div>
            </div>
        </div>

        <!-- Body POS -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden pb-6 w-full flex flex-col items-center bg-slate-50 relative overscroll-y-contain" ref="scrollContainer" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
            
            <!-- PTR Indicator -->
            <div class="w-full flex justify-center items-end overflow-hidden z-10 shrink-0" :class="[!isPulling || isRefreshing ? 'transition-all duration-300' : '']" :style="{ height: pullDistance + 'px', opacity: pullDistance / 50 }">
                <div class="bg-white rounded-full p-2 mb-2 shadow-md flex items-center justify-center" :class="{ 'animate-spin': isRefreshing }">
                    <i class="ph-bold ph-arrow-clockwise text-teal-600 text-lg" :style="{ transform: `rotate(${pullDistance * 5}deg)` }"></i>
                </div>
            </div>

            <div class="w-full max-w-3xl px-4 pt-4 pb-20 shrink-0 flex-1">
                <div class="grid grid-cols-1 gap-3 w-full mb-4">
                    <div class="slide-up-fade bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 shadow-lg shadow-slate-900/10 text-white relative overflow-hidden">
                        <div class="absolute right-0 top-0 opacity-10"><i class="ph-fill ph-washing-machine text-8xl -mt-4 -mr-4"></i></div>
                        <p class="text-[0.6875rem] font-black uppercase tracking-widest text-slate-300 mb-1 relative z-10">Total Transaksi Hari Ini</p>
                        <div class="flex items-end gap-1 relative z-10"><h2 class="text-4xl font-black tracking-tighter">{{ totalTransaksiHariIni }}</h2></div>
                    </div>
                </div>
                
                <div class="slide-up-fade flex gap-2 w-full items-center mb-4">
                    <!-- Simplified Date Filter -->
                    <div class="relative w-[46px] h-[46px] shrink-0 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer" :class="{'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-50 text-emerald-600': filterDate}">
                        <input type="date" v-model="filterDate" @change="currentPage = 1" title="Pilih Tanggal" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10">
                        <i class="ph-bold ph-calendar-blank text-xl"></i>
                        <div v-if="filterDate" class="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></div>
                    </div>
                    
                    <!-- Search Field -->
                    <div class="relative flex-1 min-w-0 h-[46px]">
                        <i class="ph-bold ph-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
                        <input type="text" v-model="searchQuery" @input="currentPage = 1" placeholder="Cari nota, nama, hp..." class="w-full h-full pl-9 pr-10 py-2 text-[0.8125rem] font-bold border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-teal-300 bg-white outline-none transition-all placeholder-slate-400 text-slate-700">
                        <button @click="startScan" class="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center hover:bg-teal-100 transition-colors" title="Scan Barcode Resi">
                            <i class="ph-bold ph-barcode text-lg"></i>
                        </button>
                    </div>

                    <button @click="forceRefresh" :disabled="isRefreshing" title="Segarkan Data" class="w-[46px] h-[46px] shrink-0 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all active:scale-95 shadow-sm disabled:opacity-50">
                        <i class="ph-bold ph-arrows-clockwise text-lg" :class="{'animate-spin': isRefreshing}"></i>
                    </button>
                    
                    <select v-model="filterStatus" @change="currentPage = 1" class="w-[105px] h-[46px] shrink-0 px-2 py-2 text-[0.8125rem] font-bold border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-teal-300 bg-white text-slate-700 outline-none transition-all cursor-pointer">
                        <option value="">Semua</option>
                        <option value="Proses">Proses</option>
                        <option value="Selesai">Selesai</option>
                        <option value="Diambil">Diambil</option>
                    </select>
                </div>
                
                <div class="w-full">
                    <div v-for="(tx, index) in transactions" :key="tx.ID" @click="openDetailModal(tx)" class="bg-white px-4 py-3 border border-slate-100 rounded-2xl active:bg-slate-50 transition-colors cursor-pointer relative shadow-sm mb-3">
                        <div class="flex justify-between items-center mb-1">
                            <h3 class="text-[0.8125rem] font-black text-slate-800 uppercase tracking-tight truncate">{{ getCustomerName(tx) }}</h3>
                            <span class="text-[0.625rem] font-bold text-slate-500 font-mono tracking-widest">{{ tx['No Nota'] || tx.ID }}</span>
                        </div>
                        <div class="flex justify-between items-start mb-1.5">
                            <p class="text-[0.6875rem] font-semibold text-slate-500 leading-snug w-2/3 pr-2 truncate">{{ (tx['Layanan'] || '').replace(/\+/g, ', ') }}</p>
                            <p class="text-[0.75rem] font-black text-slate-700 whitespace-nowrap w-1/3 text-right">{{ formatRupiah(tx['Total Harga']) }}</p>
                        </div>
                        <div class="flex justify-between items-center">
                            <p class="text-[0.625rem] font-medium text-slate-400">
                                <i class="ph-fill ph-calendar-check"></i> Est: {{ getEstimasiSelesai(tx) }}
                            </p>
                            <div class="flex gap-1.5 items-center">
                                <span v-if="tx.Pembayaran === 'Lunas'" class="px-2 py-0.5 rounded-md border text-[0.5625rem] font-bold uppercase bg-emerald-50 text-emerald-600 border-emerald-200">LUNAS</span>
                                <span v-else-if="tx.Pembayaran === 'DP'" class="px-2 py-0.5 rounded-md border text-[0.5625rem] font-bold uppercase bg-amber-50 text-amber-600 border-amber-200">DP</span>
                                <span v-else-if="tx.Pembayaran === 'Potong Kuota'" class="px-2 py-0.5 rounded-md border text-[0.5625rem] font-bold uppercase bg-indigo-50 text-indigo-600 border-indigo-200">KUOTA</span>
                                <span v-else class="px-2 py-0.5 rounded-md border text-[0.5625rem] font-bold uppercase bg-red-50 text-red-500 border-red-200">BELUM LUNAS</span>
                                
                                <span :class="['px-2.5 py-0.5 rounded-full text-[0.5625rem] font-black uppercase tracking-wider', tx.Status === 'Proses' || !tx.Status ? 'bg-purple-100 text-purple-700' : (tx.Status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')]">{{ tx.Status || 'PROSES' }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Pagination Controls -->
                    <div class="w-full mt-4 mb-2 bg-white rounded-[1.5rem] p-3 sm:p-4 flex justify-between items-center text-[0.8125rem] text-slate-500 shadow-sm border border-slate-100" v-if="totalPages > 1">
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-slate-400">HAL <span class="text-teal-600">{{ currentPage }}</span> / {{ totalPages }}</span>
                            <select v-model="itemsPerPage" @change="currentPage = 1" class="border border-slate-200 bg-slate-50 rounded-lg px-2 py-1 outline-none font-bold text-slate-700 hover:border-teal-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 shadow-sm cursor-pointer appearance-none pr-7 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjMTRiOGE2Ij48cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS13aWR0aD0iMiIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:14px_14px] bg-[right_6px_center] bg-no-repeat text-[0.8125rem]">
                                <option :value="10">10</option>
                                <option :value="15">15</option>
                                <option :value="25">25</option>
                                <option :value="50">50</option>
                            </select>
                        </div>
                        <div class="flex gap-1.5">
                            <button @click="currentPage--" :disabled="currentPage === 1" class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-600 disabled:opacity-30 disabled:hover:bg-slate-50 disabled:hover:text-slate-600 transition-colors">
                                <i class="ph-bold ph-caret-left"></i>
                            </button>
                            <button @click="currentPage++" :disabled="currentPage === totalPages" class="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-600 disabled:opacity-30 disabled:hover:bg-slate-50 disabled:hover:text-slate-600 transition-colors">
                                <i class="ph-bold ph-caret-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Footer POS -->
        <div class="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200/50 pt-2 px-4 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-30 flex justify-center transition-all" style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom, 0px));">
            <div class="w-full max-w-3xl">
                <button @click="openAddTransaction" class="w-full bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-black tracking-wide py-2 rounded-xl shadow-sm shadow-teal-500/30 flex items-center justify-center text-[0.875rem] transition-transform transform active:scale-95"><i class="ph-bold ph-plus-circle text-lg mr-2"></i> TAMBAH TRX BARU</button>
            </div>
        </div>

        <!-- MODAL UPDATE TRANSAKSI -->
        <div v-if="isDetailModalOpen" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center sm:p-4">
            <div class="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col relative modal-enter overflow-hidden max-h-[90vh] mx-auto">
                <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
                    <h3 class="text-lg font-black text-slate-800 tracking-tight">Edit / Update Transaksi</h3>
                    <button type="button" @click="closeDetailModal" class="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors"><i class="ph-bold ph-x"></i></button>
                </div>
                
                <div class="p-5 overflow-y-auto bg-slate-50 flex-1 w-full flex justify-center items-start" v-if="selectedTx">
                    <div class="w-full max-w-[300px] bg-white p-4 shadow-sm border border-slate-200" v-html="generateReceiptHTML(selectedTx, store)"></div>
                </div>

                <div class="p-5 bg-white border-t border-slate-100 shrink-0" v-if="selectedTx">
                    <div class="grid grid-cols-2 gap-3 mb-5">
                        <div>
                            <label class="block text-[0.625rem] font-black text-slate-400 mb-2 uppercase tracking-widest truncate">Status Pembayaran</label>
                            <select v-model="selectedTx.Pembayaran" class="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-bold focus:ring-2 focus:ring-teal-300">
                                <option value="Belum Lunas">Belum Lunas</option>
                                <option value="Lunas">Lunas</option>
                                <option value="DP">DP</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[0.625rem] font-black text-slate-400 mb-2 uppercase tracking-widest truncate">Status Transaksi</label>
                            <select v-model="selectedTx.Status" class="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-bold focus:ring-2 focus:ring-teal-300">
                                <option value="Proses">Proses</option>
                                <option value="Selesai">Selesai</option>
                                <option value="Diambil">Diambil</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-2 w-full">
                        <button type="button" @click="actionPrintReceipt(selectedTx, store)" title="Print Nota" class="w-12 h-12 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center shrink-0">
                            <i class="ph-bold ph-printer text-xl"></i>
                        </button>
                        <button type="button" @click="actionSendWA(selectedTx, store)" title="Kirim WA" class="w-12 h-12 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center shrink-0">
                            <i class="ph-bold ph-whatsapp-logo text-xl"></i>
                        </button>
                        <button type="button" @click="actionSharePDF(selectedTx, store)" title="Share PDF" class="w-12 h-12 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center shrink-0">
                            <i class="ph-bold ph-file-pdf text-xl"></i>
                        </button>
                        <button type="button" @click="actionShareJPG(selectedTx, store)" title="Share JPG" class="w-12 h-12 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center shrink-0">
                            <i class="ph-bold ph-image text-xl"></i>
                        </button>
                        <button type="button" @click="saveDetailStatus" class="flex-1 bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-black h-12 rounded-2xl shadow-xl shadow-teal-500/30 active:scale-95 transition-all flex items-center justify-center text-[0.8125rem]">
                            <i class="ph-bold ph-floppy-disk mr-1 text-lg"></i> SIMPAN
                        </button>
                    </div>
                    
                    <button @click="openEditRincian" class="w-full mt-3 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                        <i class="ph-bold ph-pencil-simple"></i> UBAH RINCIAN LAYANAN
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Modals -->
        <TransactionFormModal v-if="isTxFormOpen" :isOpen="isTxFormOpen" :initialData="txFormInitialData" @close="isTxFormOpen = false" @saved="handleTxSaved" />
        
        <BluetoothManagerModal :is-open="store.isBluetoothModalOpen" @close="store.isBluetoothModalOpen = false" />
        
        <!-- Success Modal (After Save) -->
        <div v-if="isSuccessModalOpen" class="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col relative overflow-hidden max-h-[85vh] animate-scaleUp">
                <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
                    <h3 class="text-lg font-black text-slate-800 tracking-tight">Preview Nota</h3>
                    <button type="button" @click="closeSuccessModal" class="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors">
                        <i class="ph-bold ph-x"></i>
                    </button>
                </div>
                
                <div class="p-5 overflow-y-auto bg-slate-50 flex-1 w-full flex justify-center items-start" v-if="savedTxPreview">
                    <div class="w-full max-w-[300px] bg-white p-4 shadow-sm border border-slate-200" v-html="generateReceiptHTML(savedTxPreview, store)"></div>
                </div>

                <div class="p-4 bg-white border-t border-slate-100 shrink-0 flex gap-2" v-if="savedTxPreview">
                    <button type="button" @click="actionPrintReceipt(savedTxPreview, store)" class="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-2xl shadow-sm hover:bg-slate-200 flex items-center justify-center transition-transform active:scale-95 text-[0.75rem]">
                        <i class="ph-bold ph-printer text-lg mr-1"></i> PRINT
                    </button>
                    <button type="button" @click="actionSendWA(savedTxPreview, store)" class="flex-1 bg-emerald-50 text-emerald-600 font-black py-3 rounded-2xl shadow-sm hover:bg-emerald-100 flex items-center justify-center transition-transform active:scale-95 text-[0.75rem]">
                        <i class="ph-bold ph-whatsapp-logo text-lg mr-1"></i> WA
                    </button>
                    <button type="button" @click="actionSharePDF(savedTxPreview, store)" class="w-12 h-12 shrink-0 bg-rose-50 text-rose-600 font-black rounded-2xl shadow-sm hover:bg-rose-100 flex items-center justify-center transition-transform active:scale-95">
                        <i class="ph-bold ph-file-pdf text-lg"></i>
                    </button>
                    <button type="button" @click="actionShareJPG(savedTxPreview, store)" class="w-12 h-12 shrink-0 bg-blue-50 text-blue-600 font-black rounded-2xl shadow-sm hover:bg-blue-100 flex items-center justify-center transition-transform active:scale-95">
                        <i class="ph-bold ph-image text-lg"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
