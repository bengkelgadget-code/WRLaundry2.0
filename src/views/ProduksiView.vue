<script setup>
import { ref, computed, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import TransactionModal from '../components/TransactionModal.vue';
import TransactionFormModal from '../components/TransactionFormModal.vue';

const store = useAppStore();
const searchQuery = ref('');
const sortKey = ref('ID');
const sortOrder = ref('desc'); // 'asc' or 'desc'

// Pagination State
const currentPage = ref(1);
const itemsPerPage = ref(15);

// Filter State
const filterType = ref('all');
const filterMonth = ref('');
const filterDate = ref('');

watch([filterType, filterMonth, filterDate], () => {
    currentPage.value = 1;
});

// Bulk Actions State
const selectedRows = ref([]);
const bulkStatus = ref('');
const bulkPembayaran = ref('');

const isAllSelected = computed({
    get: () => {
        return filteredAndSortedData.value.length > 0 && selectedRows.value.length === filteredAndSortedData.value.length;
    },
    set: (val) => {
        if (val) {
            selectedRows.value = filteredAndSortedData.value.map(tx => tx.ID);
        } else {
            selectedRows.value = [];
        }
    }
});

watch(searchQuery, () => {
    selectedRows.value = []; // Clear selection when search changes to prevent applying bulk action to hidden items
});

const applyBulkUpdate = async () => {
    if ((!bulkStatus.value && !bulkPembayaran.value) || selectedRows.value.length === 0) return;
    
    let confirmMsg = `Apakah Anda yakin ingin mengubah `;
    if (bulkStatus.value && bulkPembayaran.value) {
        confirmMsg += `status menjadi '${bulkStatus.value.toUpperCase()}' dan pembayaran menjadi '${bulkPembayaran.value.toUpperCase()}'`;
    } else if (bulkStatus.value) {
        confirmMsg += `status menjadi '${bulkStatus.value.toUpperCase()}'`;
    } else if (bulkPembayaran.value) {
        confirmMsg += `pembayaran menjadi '${bulkPembayaran.value.toUpperCase()}'`;
    }
    confirmMsg += ` untuk ${selectedRows.value.length} transaksi?`;

    if (confirm(confirmMsg)) {
        const updateData = {};
        if (bulkStatus.value) updateData.Status = bulkStatus.value;
        if (bulkPembayaran.value) updateData.Pembayaran = bulkPembayaran.value;

        for (const id of selectedRows.value) {
            await store.updateRecord('Produksi', id, updateData);
        }
        
        selectedRows.value = [];
        bulkStatus.value = '';
        bulkPembayaran.value = '';
    }
};

// Modal State
const isModalOpen = ref(false);
const modalTitle = ref('');
const modalInitialData = ref(null);
const isViewOnly = ref(false);

const filteredAndSortedData = computed(() => {
    let data = store.appData.produksi || [];
    
    // Filter out data errors (e.g. absurdly high prices > 100M)
    data = data.filter(d => {
        const harga = parseRupiah(d['Total Harga']);
        return harga < 100000000;
    });

    if (filterType.value === 'month' && filterMonth.value) {
        const [yyyy, mm] = filterMonth.value.split('-');
        data = data.filter(d => {
            if (!d['Waktu Masuk']) return false;
            return d['Waktu Masuk'].includes(`${mm}/${yyyy}`) || d['Waktu Masuk'].includes(`${yyyy}-${mm}`);
        });
    } else if (filterType.value === 'date' && filterDate.value) {
        const [yyyy, mm, dd] = filterDate.value.split('-');
        data = data.filter(d => {
            if (!d['Waktu Masuk']) return false;
            return d['Waktu Masuk'].includes(`${dd}/${mm}/${yyyy}`) || d['Waktu Masuk'].includes(filterDate.value);
        });
    }
    
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        data = data.filter(d => 
            String(getCustomerName(d)).toLowerCase().includes(q) || 
            String(d['No Nota']||'').toLowerCase().includes(q) ||
            String(d['Layanan']||'').toLowerCase().includes(q)
        );
    }
    
    // Sort logic
    return data.sort((a, b) => {
        let valA = a[sortKey.value] || '';
        let valB = b[sortKey.value] || '';
        
        if (sortKey.value === 'Total Harga' || sortKey.value === 'ID') {
            valA = parseRupiah(valA);
            valB = parseRupiah(valB);
            return sortOrder.value === 'asc' ? valA - valB : valB - valA;
        } else {
            return sortOrder.value === 'asc' 
                ? String(valA).localeCompare(String(valB)) 
                : String(valB).localeCompare(String(valA));
        }
    });
});

const totalPages = computed(() => {
    return Math.max(1, Math.ceil(filteredAndSortedData.value.length / itemsPerPage.value));
});

const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage.value;
    const end = start + itemsPerPage.value;
    return filteredAndSortedData.value.slice(start, end);
});

const nextPage = () => {
    if (currentPage.value < totalPages.value) currentPage.value++;
};

const prevPage = () => {
    if (currentPage.value > 1) currentPage.value--;
};

const handleSort = (key) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'asc';
    }
};

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

const formatTanggal = (waktu) => {
    if (!waktu) return '-';
    let str = String(waktu);
    
    if (str.includes(',')) {
        return str.split(',')[0] + ',';
    }
    if (str.includes(' ')) {
        return str.split(' ')[0] + ',';
    }
    
    let parts = str.split('T');
    if (parts.length > 0) {
        let dateParts = parts[0].split('-');
        if (dateParts.length === 3) {
            return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]},`;
        }
    }
    return str + ',';
};

const getCustomerName = (tx) => {
    if (tx['Nama Pelanggan']) return tx['Nama Pelanggan'];
    if (tx['ID Pelanggan']) {
        const cust = store.appData.pelanggan?.find(p => p.ID === tx['ID Pelanggan']);
        if (cust) return cust['Nama Pelanggan'] || cust.nama;
    }
    return 'Tanpa Nama';
};

const isTxFormOpen = ref(false);
const txFormInitialData = ref(null);

// ACTIONS
const openAddModal = () => {
    txFormInitialData.value = null;
    isTxFormOpen.value = true;
};

const openEditModal = (row) => {
    txFormInitialData.value = { ...row };
    isTxFormOpen.value = true;
};

const openViewModal = (row) => {
    modalTitle.value = `Detail Transaksi`;
    modalInitialData.value = row;
    isViewOnly.value = true;
    isModalOpen.value = true;
};

const deleteRow = async (id) => {
    if (confirm(`Apakah Anda yakin ingin menghapus transaksi ini (${id})?`)) {
        await store.deleteRecord('Produksi', id);
    }
};

const saveModalData = async (formData) => {
    if (modalInitialData.value && modalInitialData.value.ID) {
        await store.updateRecord('Produksi', modalInitialData.value.ID, formData);
    }
    isModalOpen.value = false;
};
</script>

<template>
    <div class="fade-in p-4 sm:p-6 w-full flex-1 flex flex-col min-h-0 min-w-0 items-center overflow-auto">
        <TransactionModal 
            :isOpen="isModalOpen"
            :title="modalTitle"
            :initialData="modalInitialData"
            :isViewOnly="isViewOnly"
            @close="isModalOpen = false"
            @save="saveModalData"
        />
        <TransactionFormModal :isOpen="isTxFormOpen" :initialData="txFormInitialData" @close="isTxFormOpen = false" @saved="isTxFormOpen = false" />

        <div class="w-full max-w-7xl flex-1 flex flex-col min-h-0">
            <div class="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col flex-1 overflow-hidden min-h-0 min-w-0">
                <div class="p-3 sm:p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white z-10 shrink-0 gap-3 border-b border-slate-100">
                    <!-- Left Side: Date Filters and Bulk Actions -->
                    <div class="flex items-center gap-2 overflow-x-auto min-w-0 w-full lg:w-auto shrink-0 flex-wrap">
                        
                        <!-- Date Filter -->
                        <div class="flex gap-2 items-center">
                            <select v-model="filterType" class="h-[34px] px-2 rounded-lg bg-slate-50 border border-slate-200 text-[0.8125rem] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-teal-400 cursor-pointer">
                                <option value="all">Semua Waktu</option>
                                <option value="month">Per Bulan</option>
                                <option value="date">Tanggal</option>
                            </select>
                            <input v-if="filterType === 'month'" type="month" v-model="filterMonth" class="h-[34px] px-2 rounded-lg bg-slate-50 border border-slate-200 text-[0.8125rem] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-teal-400 slide-left">
                            <input v-if="filterType === 'date'" type="date" v-model="filterDate" class="h-[34px] px-2 rounded-lg bg-slate-50 border border-slate-200 text-[0.8125rem] font-bold text-slate-600 outline-none focus:ring-1 focus:ring-teal-400 slide-left">
                        </div>

                        <!-- Divider if both are present -->
                        <div v-if="selectedRows.length > 0" class="w-px h-6 bg-slate-200 hidden sm:block mx-1"></div>

                        <!-- Bulk Actions -->
                        <template v-if="selectedRows.length > 0">
                            <span class="text-[0.6875rem] font-bold text-slate-500 whitespace-nowrap bg-slate-100 px-2 py-1.5 rounded-md border border-slate-200">{{ selectedRows.length }} dipilih</span>
                            <select v-model="bulkStatus" class="h-[34px] text-[0.8125rem] font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none cursor-pointer shadow-sm px-2">
                                <option value="" disabled selected>Ubah Status...</option>
                                <option value="Proses">Proses</option>
                                <option value="Selesai">Selesai</option>
                                <option value="Diambil">Diambil</option>
                                <option value="Batal">Batal</option>
                            </select>
                            <select v-model="bulkPembayaran" class="h-[34px] text-[0.8125rem] font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 outline-none cursor-pointer shadow-sm px-2">
                                <option value="" disabled selected>Ubah Bayar...</option>
                                <option value="Lunas">Lunas</option>
                                <option value="Belum Lunas">Belum Lunas</option>
                            </select>
                            <button @click="applyBulkUpdate" :disabled="!bulkStatus && !bulkPembayaran" class="shrink-0 h-[34px] bg-indigo-500 hover:bg-indigo-600 text-white text-[0.8125rem] font-bold px-4 rounded-lg transition-all flex items-center justify-center whitespace-nowrap active:scale-95 shadow-sm disabled:opacity-50 border border-transparent">
                                Terapkan
                            </button>
                        </template>
                    </div>

                    <!-- Search and Add -->
                    <div class="flex items-center justify-end gap-3 shrink-0 w-full sm:w-auto">
                        <div class="relative flex items-center h-[34px] w-full sm:max-w-[220px] bg-white border border-slate-200 rounded-lg focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-400 transition-all overflow-hidden shrink shadow-sm">
                            <i class="ph-bold ph-magnifying-glass text-slate-400 ml-3 shrink-0"></i>
                            <input type="text" v-model="searchQuery" placeholder="Cari transaksi..." class="h-full w-full bg-transparent pl-2 pr-3 text-[0.8125rem] font-semibold text-slate-600 placeholder-slate-400 focus:outline-none min-w-0 border-none outline-none">
                        </div>
                        <button @click="openAddModal" class="shrink-0 h-[34px] bg-[#1bc5a3] hover:bg-[#15a387] text-white text-[0.8125rem] font-bold px-4 rounded-lg transition-all flex items-center justify-center whitespace-nowrap active:scale-95 shadow-sm border border-transparent">
                            <i class="ph-bold ph-plus mr-1 text-[0.875rem]"></i> Tambah
                        </button>
                    </div>
                </div>
                
                <div class="overflow-auto flex-1 relative bg-white px-0 pt-0 pb-0 min-h-0 min-w-0 w-full">
                    <table class="table-modern w-full">
                        <thead class="sticky top-0 bg-white z-10">
                            <tr>
                                <th class="w-[40px] px-4 py-3 border-r border-slate-50">
                                    <div class="flex items-center justify-center">
                                        <input type="checkbox" v-model="isAllSelected" class="w-4 h-4 text-teal-500 bg-white border-slate-300 rounded focus:ring-teal-500 cursor-pointer accent-teal-500">
                                    </div>
                                </th>
                                <th @click="handleSort('Waktu Masuk')" class="w-[15%] cursor-pointer hover:bg-slate-50 transition-colors select-none group px-4 py-3"><div class="flex items-center justify-between"><span class="text-[0.625rem]">WAKTU MASUK</span> <i class="ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500"></i></div></th>
                                <th @click="handleSort('Nama Pelanggan')" class="w-[20%] cursor-pointer hover:bg-slate-50 transition-colors select-none group px-4 py-3"><div class="flex items-center justify-between"><span class="text-[0.625rem]">PELANGGAN</span> <i class="ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500"></i></div></th>
                                <th @click="handleSort('Layanan')" class="w-auto cursor-pointer hover:bg-slate-50 transition-colors select-none group px-4 py-3"><div class="flex items-center justify-between"><span class="text-[0.625rem]">LAYANAN</span> <i class="ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500"></i></div></th>
                                <th @click="handleSort('Total Harga')" class="w-[15%] cursor-pointer hover:bg-slate-50 transition-colors select-none group px-4 py-3"><div class="flex items-center justify-between"><span class="text-[0.625rem]">TOTAL HARGA</span> <i class="ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500"></i></div></th>
                                <th @click="handleSort('Status')" class="w-[12%] cursor-pointer hover:bg-slate-50 transition-colors select-none group px-4 py-3"><div class="flex items-center justify-center text-center"><span class="text-[0.625rem]">STATUS</span> <i class="ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500 ml-1"></i></div></th>
                                <th class="w-[12%] !text-center px-4 py-3 text-[0.625rem]">AKSI</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="tx in paginatedData" :key="tx.ID" :class="['border-b border-slate-50 transition-colors hover:bg-slate-50/80', selectedRows.includes(tx.ID) ? 'bg-teal-50/30' : '']">
                                <td class="px-4 py-2.5 border-r border-slate-50">
                                    <div class="flex items-center justify-center">
                                        <input type="checkbox" v-model="selectedRows" :value="tx.ID" class="w-4 h-4 text-teal-500 bg-white border-slate-300 rounded focus:ring-teal-500 cursor-pointer accent-teal-500">
                                    </div>
                                </td>
                                <td class="px-3 py-2.5">
                                    <p class="font-bold text-slate-800 text-[0.8125rem]">{{ formatTanggal(tx['Waktu Masuk']) }}</p>
                                    <p class="text-[0.6875rem] font-bold text-slate-400">{{ tx.ID }}</p>
                                </td>
                                <td class="px-3 py-2.5">
                                    <p class="font-bold text-slate-800 text-[0.8125rem] uppercase">{{ getCustomerName(tx) }}</p>
                                    <p class="text-[0.6875rem] font-bold text-indigo-400 uppercase">{{ tx['No Nota'] || '-' }}</p>
                                </td>
                                <td class="px-3 py-2.5">
                                    <p class="font-semibold text-slate-600 text-[0.8125rem] whitespace-normal leading-snug min-w-[140px]">{{ tx['Layanan'] }}</p>
                                </td>
                                <td class="px-3 py-2.5 font-bold text-slate-800 text-[0.8125rem] whitespace-nowrap">
                                    {{ formatRupiah(tx['Total Harga']) }}
                                </td>
                                <td class="!text-center px-3 py-2.5">
                                    <span v-if="tx.Status === 'Proses'" class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-white text-amber-500 border border-amber-300 whitespace-nowrap">
                                        <i class="ph-bold ph-spinner-gap animate-spin mr-1 text-[0.75rem]"></i> PROSES
                                    </span>
                                    <span v-else-if="tx.Status === 'Selesai'" class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-white text-teal-500 border border-teal-300 whitespace-nowrap">
                                        <i class="ph-bold ph-check-circle mr-1 text-[0.75rem]"></i> SELESAI
                                    </span>
                                    <span v-else class="inline-flex items-center px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-white text-slate-500 border border-slate-300 uppercase whitespace-nowrap">
                                        {{ (tx.Status || 'UNKNOWN').toUpperCase() }}
                                    </span>
                                </td>
                                <td class="!text-center px-3 py-2.5">
                                    <div class="flex justify-center items-center gap-1">
                                        <button @click="openViewModal(tx)" class="w-7 h-7 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center hover:bg-indigo-100 hover:text-indigo-600 transition-colors shrink-0" title="Lihat">
                                            <i class="ph-bold ph-eye text-[0.8125rem]"></i>
                                        </button>
                                        <button @click="openEditModal(tx)" class="w-7 h-7 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center hover:bg-amber-100 hover:text-amber-600 transition-colors shrink-0" title="Edit">
                                            <i class="ph-bold ph-pencil-simple text-[0.8125rem]"></i>
                                        </button>
                                        <button @click="deleteRow(tx.ID)" class="w-7 h-7 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center hover:bg-rose-100 hover:text-rose-600 transition-colors shrink-0" title="Hapus">
                                            <i class="ph-bold ph-trash text-[0.8125rem]"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="paginatedData.length === 0">
                                <td colspan="7" class="!text-center py-12 text-slate-400">Belum ada transaksi</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="w-full shrink-0 border-t border-slate-100 bg-white rounded-b-[1.5rem] p-3 sm:p-4 flex justify-between items-center text-[0.8125rem] text-slate-500 pr-[19px]">
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-slate-400">HAL <span class="text-teal-600">{{ currentPage }}</span> / {{ totalPages }}</span>
                        <select v-model="itemsPerPage" @change="currentPage = 1" class="border border-slate-200 bg-white rounded-lg px-2 py-1 outline-none font-bold text-slate-700 hover:border-teal-400 focus:border-teal-400 focus:ring-1 focus:ring-teal-400 shadow-sm cursor-pointer appearance-none pr-7 relative bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSIjMTRiOGE2Ij48cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS13aWR0aD0iMiIgZD0iTTE5IDlsLTcgNy03LTciLz48L3N2Zz4=')] bg-[length:14px_14px] bg-[right_6px_center] bg-no-repeat text-[0.8125rem]">
                            <option :value="15">15 Baris</option>
                            <option :value="25">25 Baris</option>
                            <option :value="50">50 Baris</option>
                            <option :value="100">100 Baris</option>
                        </select>
                    </div>
                    <div class="flex gap-2">
                        <button @click="prevPage" :disabled="currentPage === 1" :class="['px-3 py-1.5 rounded-lg border bg-white font-bold transition-all flex items-center shadow-sm', currentPage === 1 ? 'border-slate-100 text-slate-300 cursor-not-allowed opacity-70' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300']">
                            <i class="ph-bold ph-caret-left mr-1"></i> Prev
                        </button>
                        <button @click="nextPage" :disabled="currentPage === totalPages" :class="['px-3 py-1.5 rounded-lg border bg-white font-bold transition-all flex items-center shadow-sm', currentPage === totalPages ? 'border-slate-100 text-slate-300 cursor-not-allowed opacity-70' : 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300']">
                            Next <i class="ph-bold ph-caret-right ml-1"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
