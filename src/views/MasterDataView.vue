<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAppStore } from '../stores/useAppStore';
import CustomerHistoryModal from '../components/CustomerHistoryModal.vue';
import TransactionModal from '../components/TransactionModal.vue';
import DynamicModal from '../components/DynamicModal.vue';

const route = useRoute();
const store = useAppStore();
const sheetConfigs = {
    'Pelanggan': {
        id: 'pelanggan',
        storeKey: 'pelanggan',
        title: 'Data Pelanggan',
        fields: [
            { key: 'Nama Pelanggan', type: 'text' },
            { key: 'No Telpon', type: 'text' },
            { key: 'Status', type: 'select', options: ['Umum', 'Member'] },
            { key: 'Paket Member', type: 'select', relation: 'member' },
            { key: 'Sisa Kuota (Kg)', type: 'number' }
        ]
    },
    'LayananWaktu': {
        id: 'layanan-waktu',
        storeKey: 'waktu',
        title: 'Layanan Waktu',
        fields: [
            { key: 'Nama Layanan', type: 'text' },
            { key: 'Waktu (Jam)', type: 'number' }
        ]
    },
    'LayananKiloan': {
        id: 'layanan-kiloan',
        storeKey: 'kiloan',
        title: 'Layanan Kiloan',
        fields: [
            { key: 'Nama Layanan', type: 'text' },
            { key: 'Jenis Waktu', type: 'select', relation: 'waktu' },
            { key: 'Harga/Kg', type: 'number' }
        ]
    },
    'LayananSatuan': {
        id: 'layanan-satuan',
        storeKey: 'satuan',
        title: 'Layanan Satuan',
        fields: [
            { key: 'Nama Layanan', type: 'text' },
            { key: 'Jenis Waktu', type: 'select', relation: 'waktu' },
            { key: 'Harga/Pcs', type: 'number' }
        ]
    },
    'LayananPewangi': {
        id: 'layanan-pewangi',
        storeKey: 'pewangi',
        title: 'Layanan Pewangi',
        fields: [
            { key: 'Nama Pewangi', type: 'text' }
        ]
    },
    'LayananMember': {
        id: 'layanan-member',
        storeKey: 'member',
        title: 'Paket Member',
        fields: [
            { key: 'Nama Paket', type: 'text' },
            { key: 'Kuota (Kg)', type: 'number' },
            { key: 'Harga', type: 'number' }
        ]
    },
    'Users': {
        id: 'users',
        storeKey: 'users',
        title: 'Data User / Pegawai',
        fields: [
            { key: 'Nama User', type: 'text' },
            { key: 'Username', type: 'text' },
            { key: 'Password', type: 'text' },
            { key: 'Role', type: 'select', options: ['ADMIN', 'STAFF'] }
        ]
    }
};

const currentSheet = computed(() => {
    const sheetParam = route.params.sheet || '';
    return Object.keys(sheetConfigs).find(k => sheetConfigs[k].id.toLowerCase() === sheetParam.toLowerCase()) || '';
});

const currentConfig = computed(() => {
    return sheetConfigs[currentSheet.value];
});

const currentFields = computed(() => {
    if (!currentConfig.value) return [];
    return currentConfig.value.fields.map(f => {
        if (f.relation) {
            let relatedData = store.appData[f.relation] || [];
            let options = [];
            if (f.relation === 'waktu') options = relatedData.map(r => r['Nama Layanan']);
            if (f.relation === 'member') options = ['Tanpa Paket', ...relatedData.map(r => r['Nama Paket'])];
            return { ...f, options };
        }
        return f;
    });
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

const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(parseRupiah(number));
};

const searchQuery = ref('');
const sortKey = ref('ID');
const sortOrder = ref('desc'); // 'asc' or 'desc'

// Pagination State
const currentPage = ref(1);
const itemsPerPage = ref(15);

// View Modal Logic
const isViewModalOpen = ref(false);
const viewModalData = ref(null);

// History Modal Logic
const isHistoryModalOpen = ref(false);
const currentHistoryCustomerId = ref(null);

// Tx View Modal from History
const isTxViewModalOpen = ref(false);
const txViewModalData = ref(null);

const openHistoryModal = (id) => {
    currentHistoryCustomerId.value = id;
    isHistoryModalOpen.value = true;
};

const handleViewTransactionFromHistory = (tx) => {
    txViewModalData.value = tx;
    isTxViewModalOpen.value = true;
};

// Modal State
const isModalOpen = ref(false);
const modalTitle = ref('');
const modalInitialData = ref(null);
const isViewOnly = ref(false);

const filteredAndSortedData = computed(() => {
    if (!currentConfig.value) return [];
    
    let data = store.appData[currentConfig.value.storeKey] || [];
    
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        data = data.filter(d => {
            return currentConfig.value.fields.some(f => 
                String(d[f.key]||'').toLowerCase().includes(q)
            ) || String(d.ID||'').toLowerCase().includes(q);
        });
    }
    
    // Sort logic
    return data.sort((a, b) => {
        let valA = a[sortKey.value] || '';
        let valB = b[sortKey.value] || '';
        
        if (sortKey.value === 'ID') {
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

const formatValue = (key, value) => {
    if (key.toLowerCase().includes('harga')) {
        return formatRupiah(value);
    }
    return value;
};

// ACTIONS
const openAddModal = () => {
    modalTitle.value = `Tambah ${currentConfig.value.title}`;
    modalInitialData.value = null;
    isViewOnly.value = false;
    isModalOpen.value = true;
};

const openEditModal = (row) => {
    modalTitle.value = `Edit ${currentConfig.value.title}`;
    modalInitialData.value = row;
    isViewOnly.value = false;
    isModalOpen.value = true;
};

const openViewModal = (row) => {
    modalTitle.value = `Detail ${currentConfig.value.title}`;
    modalInitialData.value = row;
    isViewOnly.value = true;
    isModalOpen.value = true;
};

const deleteRow = async (id) => {
    if (confirm(`Apakah Anda yakin ingin menghapus data ini (${id})?`)) {
        await store.deleteRecord(currentSheet.value, id);
    }
};

const saveModalData = async (formData) => {
    if (modalInitialData.value && modalInitialData.value.ID) {
        // Edit mode
        await store.updateRecord(currentSheet.value, modalInitialData.value.ID, formData);
    } else {
        // Add mode
        await store.saveRecord(currentSheet.value, formData);
    }
    isModalOpen.value = false;
};

</script>

<template>
    <div class="fade-in p-4 sm:p-6 w-full flex-1 flex flex-col min-h-0 min-w-0 items-center" v-if="currentConfig">
        <DynamicModal 
            :isOpen="isModalOpen"
            :title="modalTitle"
            :fields="currentFields"
            :initialData="modalInitialData"
            :isViewOnly="isViewOnly"
            @close="isModalOpen = false"
            @save="saveModalData"
        />

        <CustomerHistoryModal 
            :isOpen="isHistoryModalOpen" 
            :customerId="currentHistoryCustomerId" 
            @close="isHistoryModalOpen = false"
            @view-transaction="handleViewTransactionFromHistory"
        />

        <TransactionModal
            :isOpen="isTxViewModalOpen"
            :initialData="txViewModalData"
            :isViewOnly="true"
            @close="isTxViewModalOpen = false"
        />

        <div class="w-full max-w-7xl flex-1 flex flex-col min-h-0">
            <div class="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 flex flex-col flex-1 overflow-hidden min-h-0 min-w-0">
            
            <div class="p-4 sm:p-6 flex justify-end items-center bg-white z-10 shrink-0">
                <div class="flex items-center justify-end w-full gap-3" v-if="currentConfig.fields.length > 0">
                    <div class="relative flex items-center h-[36px] w-full max-w-[240px] bg-white border border-slate-200 rounded-lg focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-400 transition-all overflow-hidden shrink">
                        <i class="ph-bold ph-magnifying-glass text-slate-400 ml-3 shrink-0"></i>
                        <input type="text" v-model="searchQuery" placeholder="Cari data..." class="h-full w-full bg-transparent pl-2 pr-3 text-[0.8125rem] font-semibold text-slate-600 placeholder-slate-400 focus:outline-none min-w-0 border-none outline-none">
                    </div>
                    <button @click="openAddModal" class="shrink-0 h-[36px] bg-[#1bc5a3] hover:bg-[#15a387] text-white text-[0.8125rem] font-bold px-4 rounded-lg transition-all flex items-center justify-center whitespace-nowrap active:scale-95 shadow-sm border border-transparent">
                        <i class="ph-bold ph-plus mr-1.5 text-[0.9375rem]"></i> Tambah
                    </button>
                </div>
            </div>
            
            <div class="overflow-auto flex-1 relative bg-white px-0 pt-0 pb-0 min-h-0 min-w-0 w-full" v-if="currentConfig.fields.length > 0">
                <table class="table-modern w-full">
                    <thead class="sticky top-0 bg-white z-10">
                        <tr>
                            <th @click="handleSort('ID')" class="w-[15%] cursor-pointer hover:bg-slate-50 transition-colors select-none group px-4 py-3"><div class="flex items-center justify-between"><span>ID</span> <i class="ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500 ml-1"></i></div></th>
                            <th v-for="field in currentConfig.fields" :key="field.key" @click="handleSort(field.key)" class="cursor-pointer hover:bg-slate-50 transition-colors select-none group px-4 py-3">
                                <div class="flex items-center justify-between"><span>{{ field.key.toUpperCase() }}</span> <i class="ph-bold ph-caret-up-down text-slate-300 group-hover:text-slate-500 ml-1"></i></div>
                            </th>
                            <th class="w-[15%] text-right px-4 py-3" v-if="currentConfig.fields.length > 0">AKSI</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in paginatedData" :key="row.ID" class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td class="px-4 py-3">
                                <span class="bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full text-[0.75rem] uppercase tracking-wider">{{ row.ID }}</span>
                            </td>
                            
                            <td class="px-4 py-3" v-for="field in currentConfig.fields" :key="field.key">
                                <template v-if="field.key === 'Status'">
                                    <span class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-[0.6875rem] font-bold uppercase">{{ row[field.key] || '-' }}</span>
                                </template>
                                <template v-else-if="field.key === 'Sisa Kuota (Kg)'">
                                    <span class="px-2.5 py-1 bg-indigo-50 text-indigo-600 rounded text-[0.6875rem] font-bold whitespace-nowrap">{{ row[field.key] || '-' }} {{ row[field.key] && row[field.key] !== '-' ? 'Kg' : '' }}</span>
                                </template>
                                <template v-else-if="field.key === 'Nama Pelanggan'">
                                    <div class="text-[0.8125rem] font-bold text-slate-800 uppercase">{{ row[field.key] || '-' }}</div>
                                </template>
                                <template v-else-if="field.key === 'No Telpon'">
                                    <div class="text-[0.8125rem] font-bold text-slate-500">{{ row[field.key] || '-' }}</div>
                                </template>
                                <template v-else-if="field.key.includes('Harga')">
                                    <span class="text-teal-600 font-bold tracking-wide text-[0.8125rem]">{{ formatRupiah(row[field.key]) }}</span>
                                </template>
                                <template v-else-if="field.key === 'Jenis Waktu'">
                                    <span class="bg-slate-50 text-slate-500 border border-slate-200 font-bold px-2 py-0.5 rounded-full text-[0.75rem] inline-flex items-center">
                                        <i class="ph-bold ph-clock mr-1 text-[0.8125rem]"></i> {{ String(row[field.key] || '-').toUpperCase() }}
                                    </span>
                                </template>
                                
                                <template v-else-if="field.key === 'Nama Layanan' || field.key === 'Nama Paket' || field.key === 'Nama Pewangi'">
                                    <span class="text-slate-800 font-bold uppercase text-[0.8125rem]">{{ row[field.key] || '-' }}</span>
                                </template>
                                
                                <template v-else>
                                    <p class="font-semibold text-slate-600 text-[0.8125rem] truncate">{{ row[field.key] || '-' }}</p>
                                </template>
                            </td>
                            
                            <td class="text-right whitespace-nowrap" v-if="currentConfig.fields.length > 0">
                                <button v-if="currentSheet === 'Pelanggan'" @click="openHistoryModal(row.ID)" class="text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-500 p-2 rounded-xl transition-all mr-1.5 inline-flex items-center justify-center shadow-sm active:scale-95" title="History">
                                    <i class="ph-bold ph-eye text-[1rem]"></i>
                                </button>
                                <button v-else @click="openViewModal(row)" class="text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-500 p-2 rounded-xl transition-all mr-1.5 inline-flex items-center justify-center shadow-sm active:scale-95" title="Detail">
                                    <i class="ph-bold ph-eye text-[1rem]"></i>
                                </button>
                                <button @click="openEditModal(row)" class="text-amber-500 hover:text-white bg-amber-50 hover:bg-amber-500 p-2 rounded-xl transition-all mr-1.5 inline-flex items-center justify-center shadow-sm active:scale-95" title="Edit">
                                    <i class="ph-bold ph-pencil-simple text-[1rem]"></i>
                                </button>
                                <button @click="deleteRow(row.ID)" class="text-red-500 hover:text-white bg-rose-50 hover:bg-rose-500 p-2 rounded-xl transition-all inline-flex items-center justify-center shadow-sm active:scale-95" title="Hapus">
                                    <i class="ph-bold ph-trash text-[1rem]"></i>
                                </button>
                            </td>
                        </tr>
                        <tr v-if="paginatedData.length === 0">
                            <td :colspan="currentConfig.fields.length + 2" class="!text-center py-12 text-slate-400">Belum ada data</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            
            <div v-else class="flex-1 flex items-center justify-center text-slate-400 p-8">
                <div class="text-center">
                    <i class="ph-fill ph-gear text-6xl mb-3 text-slate-300"></i>
                    <p class="font-bold">Halaman sedang dalam pengembangan</p>
                </div>
            </div>
            
            <div class="w-full shrink-0 border-t border-slate-100 bg-white rounded-b-[1.5rem] p-3 sm:p-4 flex justify-between items-center text-[0.8125rem] text-slate-500 pr-[19px]" v-if="currentConfig.fields.length > 0">
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
    
    <div v-else class="flex-1 flex items-center justify-center p-8 text-slate-400">
        Halaman tidak ditemukan.
    </div>
</template>
