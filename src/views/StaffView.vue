<script setup>
import { ref, computed, defineAsyncComponent } from 'vue';
import { useRouter } from 'vue-router';
import { useAppStore } from '../stores/useAppStore';
import { generateReceiptHTML, actionPrintReceipt, actionSendWA } from '../utils/posUtils';
import { getDatabase, ref as dbRef, update } from 'firebase/database';

const TransactionFormModal = defineAsyncComponent(() => import('../components/TransactionFormModal.vue'));

const store = useAppStore();
const router = useRouter();

const searchQuery = ref('');
const filterStatus = ref('');
const filterDateEnabled = ref(false);
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
        const db = getDatabase();
        const txRef = dbRef(db, 'appData/produksi/' + selectedTx.value.ID);
        await update(txRef, {
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
    if (filterDateEnabled.value && filterDate.value) {
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
    if (scrollContainer.value && scrollContainer.value.scrollTop === 0) {
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
    
    if (diff > 0) {
        pullDistance.value = Math.min(diff * 0.4, 80);
    } else {
        pullDistance.value = 0;
    }
};

const handleTouchEnd = async () => {
    if (!isPulling.value || isRefreshing.value) return;
    
    if (pullDistance.value > 50) {
        isRefreshing.value = true;
        pullDistance.value = 50;
        await store.fetchInitialData();
        isRefreshing.value = false;
    }
    
    pullDistance.value = 0;
    isPulling.value = false;
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
                    <button title="Hubungkan Printer Bluetooth" class="w-9 h-9 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-all duration-300 active:scale-95 shadow-sm"><i class="ph-bold ph-printer text-lg"></i></button>
                    <button @click="logout" title="Logout" class="w-9 h-9 bg-red-50 text-red-600 rounded-xl flex items-center justify-center hover:bg-red-100 transition-all duration-300 active:scale-95 shadow-sm"><i class="ph-bold ph-power text-lg"></i></button>
                </div>
            </div>
        </div>

        <!-- Body POS -->
        <div class="flex-1 overflow-y-auto overflow-x-hidden pb-6 w-full flex flex-col items-center bg-slate-50 relative" ref="scrollContainer" @touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
            
            <!-- PTR Indicator -->
            <div class="w-full flex justify-center items-end overflow-hidden transition-all duration-300 z-10 shrink-0" :style="{ height: pullDistance + 'px', opacity: pullDistance / 50 }">
                <div class="bg-white rounded-full p-2 mb-2 shadow-md flex items-center justify-center" :class="{ 'animate-spin': isRefreshing }">
                    <i class="ph-bold ph-arrow-clockwise text-teal-600 text-lg" :style="{ transform: `rotate(${pullDistance * 5}deg)` }"></i>
                </div>
            </div>

            <div class="w-full max-w-3xl px-4 pt-4 pb-20 shrink-0 flex-1">
                <div class="grid grid-cols-1 gap-3 w-full mb-4">
                    <div class="slide-up-fade bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-5 shadow-lg shadow-slate-900/10 text-white relative overflow-hidden">
                        <div class="absolute right-0 top-0 opacity-10"><i class="ph-fill ph-washing-machine text-8xl -mt-4 -mr-4"></i></div>
                        <p class="text-[11px] font-black uppercase tracking-widest text-slate-300 mb-1 relative z-10">Total Transaksi Hari Ini</p>
                        <div class="flex items-end gap-1 relative z-10"><h2 class="text-4xl font-black tracking-tighter">{{ totalTransaksiHariIni }}</h2></div>
                    </div>
                </div>
                
                <div class="slide-up-fade flex gap-2 w-full items-center mb-4">
                    <div class="flex items-center gap-2.5 shrink-0 bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm z-20 h-[46px]">
                        <label class="relative inline-flex items-center cursor-pointer ml-1.5" title="Aktifkan/Matikan Filter Tanggal">
                            <input type="checkbox" v-model="filterDateEnabled" class="sr-only peer">
                            <div class="w-[36px] h-5 bg-rose-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                        </label>
                        <div class="w-px h-6 bg-slate-100"></div>
                        <div :class="['relative w-[34px] h-[34px] transition-all duration-300', !filterDateEnabled ? 'opacity-40 grayscale pointer-events-none' : '']">
                            <input type="date" v-model="filterDate" @change="currentPage = 1" title="Pilih Tanggal" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" :disabled="!filterDateEnabled">
                            <div class="w-full h-full bg-slate-50 rounded-xl flex items-center justify-center text-slate-500 relative transition-colors border border-transparent active:scale-95">
                                <i class="ph-bold ph-calendar-blank text-[22px]"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="relative flex-1 min-w-0 h-[46px]">
                        <i class="ph-bold ph-magnifying-glass absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
                        <input type="text" v-model="searchQuery" @input="currentPage = 1" placeholder="Cari..." class="w-full h-full pl-9 pr-3 py-2 text-[13px] font-bold border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-teal-300 bg-white outline-none transition-all">
                    </div>
                    
                    <select v-model="filterStatus" @change="currentPage = 1" class="w-[105px] h-[46px] shrink-0 px-2 py-2 text-[13px] font-bold border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-teal-300 bg-white text-slate-700 outline-none transition-all cursor-pointer">
                        <option value="">Semua</option>
                        <option value="Proses">Proses</option>
                        <option value="Selesai">Selesai</option>
                        <option value="Diambil">Diambil</option>
                    </select>
                </div>
                
                <div class="w-full">
                    <div v-for="(tx, index) in transactions" :key="tx.ID" @click="openDetailModal(tx)" class="bg-white px-4 py-3 border border-slate-100 rounded-2xl active:bg-slate-50 transition-colors cursor-pointer relative shadow-sm mb-3">
                        <div class="flex justify-between items-center mb-1">
                            <h3 class="text-[13px] font-black text-slate-800 uppercase tracking-tight truncate">{{ getCustomerName(tx) }}</h3>
                            <span class="text-[10px] font-bold text-slate-500 font-mono tracking-widest">{{ tx['No Nota'] || tx.ID }}</span>
                        </div>
                        <div class="flex justify-between items-start mb-1.5">
                            <p class="text-[11px] font-semibold text-slate-500 leading-snug w-2/3 pr-2 truncate">{{ (tx['Layanan'] || '').replace(/\+/g, ', ') }}</p>
                            <p class="text-[12px] font-black text-slate-700 whitespace-nowrap w-1/3 text-right">{{ formatRupiah(tx['Total Harga']) }}</p>
                        </div>
                        <div class="flex justify-between items-center">
                            <p class="text-[10px] font-medium text-slate-400">
                                <i class="ph-fill ph-calendar-check"></i> Est: {{ getEstimasiSelesai(tx) }}
                            </p>
                            <div class="flex gap-1.5 items-center">
                                <span v-if="tx.Pembayaran === 'Lunas'" class="px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase bg-emerald-50 text-emerald-600 border-emerald-200">LUNAS</span>
                                <span v-else-if="tx.Pembayaran === 'DP'" class="px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border-amber-200">DP</span>
                                <span v-else-if="tx.Pembayaran === 'Potong Kuota'" class="px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase bg-indigo-50 text-indigo-600 border-indigo-200">KUOTA</span>
                                <span v-else class="px-2 py-0.5 rounded-md border text-[9px] font-bold uppercase bg-red-50 text-red-500 border-red-200">BELUM LUNAS</span>
                                
                                <span :class="['px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider', tx.Status === 'Proses' || !tx.Status ? 'bg-purple-100 text-purple-700' : (tx.Status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')]">{{ tx.Status || 'PROSES' }}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Pagination Controls -->
                    <div class="w-full mt-4 mb-2 bg-white rounded-[1.5rem] p-3 sm:p-4 flex justify-between items-center text-[13px] text-slate-500 shadow-sm border border-slate-100" v-if="totalPages > 1">
                        <div class="flex items-center gap-3">
                            <span class="font-bold text-slate-400">HAL <span class="text-teal-600">{{ currentPage }}</span> / {{ totalPages }}</span>
                            <select v-model="itemsPerPage" @change="currentPage = 1" class="border border-slate-200 bg-slate-50 rounded-lg px-2 py-1 outline-none font-bold text-slate-700 hover:border-teal-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 shadow-sm cursor-pointer appearance-none pr-7 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjMTRiOGE2Ij48cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS13aWR0aD0iMiIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:14px_14px] bg-[right_6px_center] bg-no-repeat text-[13px]">
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
        <div class="fixed bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200/50 py-2 px-4 shadow-[0_-5px_15px_rgba(0,0,0,0.05)] z-30 flex justify-center transition-all">
            <div class="w-full max-w-3xl">
                <button @click="openAddTransaction" class="w-full bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-black tracking-wide py-2 rounded-xl shadow-sm shadow-teal-500/30 flex items-center justify-center text-[14px] transition-transform transform active:scale-95"><i class="ph-bold ph-plus-circle text-lg mr-2"></i> TAMBAH TRANSAKSI</button>
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
                            <label class="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest truncate">Status Pembayaran</label>
                            <select v-model="selectedTx.Pembayaran" class="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-bold focus:ring-2 focus:ring-teal-300">
                                <option value="Belum Lunas">Belum Lunas</option>
                                <option value="Lunas">Lunas</option>
                                <option value="DP">DP</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest truncate">Status Transaksi</label>
                            <select v-model="selectedTx.Status" class="w-full px-3 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-bold focus:ring-2 focus:ring-teal-300">
                                <option value="Proses">Proses</option>
                                <option value="Selesai">Selesai</option>
                                <option value="Diambil">Diambil</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-3 w-full">
                        <button type="button" @click="actionPrintReceipt(selectedTx, store)" title="Print Nota" class="w-14 h-14 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center shrink-0">
                            <i class="ph-bold ph-printer text-2xl"></i>
                        </button>
                        <button type="button" @click="actionSendWA(selectedTx, store)" title="Kirim WA" class="w-14 h-14 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-2xl shadow-sm active:scale-95 transition-all flex items-center justify-center shrink-0">
                            <i class="ph-bold ph-whatsapp-logo text-2xl"></i>
                        </button>
                        <button type="button" @click="saveDetailStatus" class="flex-1 bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-black h-14 rounded-2xl shadow-xl shadow-teal-500/30 active:scale-95 transition-all flex items-center justify-center text-[15px]">
                            <i class="ph-bold ph-floppy-disk mr-2 text-xl"></i> SIMPAN
                        </button>
                    </div>
                    
                    <button @click="openEditRincian" class="w-full mt-3 py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors flex items-center justify-center gap-2">
                        <i class="ph-bold ph-pencil-simple"></i> UBAH RINCIAN LAYANAN
                    </button>
                </div>
            </div>
        </div>
        
        <TransactionFormModal v-if="isTxFormOpen" :isOpen="isTxFormOpen" :initialData="txFormInitialData" @close="isTxFormOpen = false" @saved="handleTxSaved" />
        
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

                <div class="p-4 bg-white border-t border-slate-100 shrink-0 flex gap-3" v-if="savedTxPreview">
                    <button type="button" @click="actionPrintReceipt(savedTxPreview, store)" class="flex-1 bg-gradient-to-r from-teal-400 to-teal-500 text-white font-black py-3.5 rounded-2xl shadow-xl shadow-teal-500/30 hover:from-teal-500 hover:to-teal-600 flex items-center justify-center transition-transform active:scale-95 text-[14px]">
                        <i class="ph-bold ph-printer text-xl mr-2"></i> PRINT
                    </button>
                    <button type="button" @click="actionSendWA(savedTxPreview, store)" class="flex-1 bg-gradient-to-r from-teal-400 to-teal-500 text-white font-black py-3.5 rounded-2xl shadow-xl shadow-teal-500/30 hover:from-teal-500 hover:to-teal-600 flex items-center justify-center transition-transform active:scale-95 text-[14px]">
                        <i class="ph-bold ph-whatsapp-logo text-xl mr-2"></i> WA
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>
