<script setup>
import { ref, watch, computed } from 'vue';
import { useAppStore } from '../stores/useAppStore';

const store = useAppStore();

const props = defineProps({
    isOpen: Boolean,
    title: String,
    initialData: Object,
    isViewOnly: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(['close', 'save']);

const formData = ref({});

// Default fields to show in the modal, in order
const displayFields = [
    { key: 'ID', type: 'text', disabled: true },
    { key: 'Waktu Masuk', type: 'text', disabled: true },
    { key: 'No Nota', type: 'text' },
    { key: 'Nama Pelanggan', type: 'text' },
    { key: 'Layanan', type: 'textarea' },
    { key: 'Status', type: 'select', options: ['Proses', 'Selesai', 'Diambil', 'Batal'] },
    { key: 'Diskon', type: 'number' },
    { key: 'Total Harga', type: 'number' },
    { key: 'Pembayaran', type: 'select', options: ['Cash', 'Transfer', 'Qris', 'Belum Bayar'] },
    { key: 'Kasir', type: 'text', disabled: true },
    { key: 'Keterangan', type: 'textarea' }
];

watch(() => props.isOpen, (newVal) => {
    if (newVal && props.initialData) {
        formData.value = { ...props.initialData };
    }
});

const closeModal = () => {
    emit('close');
};

const saveModal = () => {
    emit('save', { ...formData.value });
};

const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

const customerDetail = computed(() => {
    if (!formData.value || !formData.value['ID Pelanggan']) return { nama: 'Unknown', hp: '-' };
    const cust = (store.appData.pelanggan || []).find(p => p.ID === formData.value['ID Pelanggan'] || p['Nama Pelanggan'] === formData.value['Nama Pelanggan']);
    if (cust) return { nama: cust['Nama Pelanggan'], hp: cust['No Telpon'] || '-', sisaKuota: parseFloat(cust['Sisa Kuota (Kg)']) || 0 };
    return { nama: formData.value['Nama Pelanggan'] || 'Unknown', hp: '-' };
});

const txItems = computed(() => {
    if (!formData.value || !formData.value['Detail Layanan JSON']) return [];
    try {
        let parsed = JSON.parse(formData.value['Detail Layanan JSON']);
        if (!Array.isArray(parsed)) return parsed.items || [];
        return parsed;
    } catch(e) { return []; }
});

const calculatedValues = computed(() => {
    let subtotalTx = Number(formData.value['Total Harga'] || 0);
    let diskonTx = 0;
    let potonganMemberTx = 0;
    let kgTerpakaiTx = parseFloat(formData.value['Kg Terpakai']) || 0;
    
    if (formData.value['Detail Layanan JSON']) {
        try {
            let parsed = JSON.parse(formData.value['Detail Layanan JSON']);
            if (!Array.isArray(parsed)) {
                diskonTx = parsed.diskon || 0;
                potonganMemberTx = parsed.potonganMember || 0;
                subtotalTx = parsed.subtotal || subtotalTx;
            }
        } catch(e) {}
    }
    
    let totalHarga = Number(formData.value['Total Harga'] || 0);
    let pmbStatusVal = formData.value['Pembayaran'] || 'Belum Lunas';
    if (totalHarga === 0 && subtotalTx > 0 && diskonTx === 0) { pmbStatusVal = 'Potong Kuota'; }
    let isPureMember = (totalHarga === 0 && pmbStatusVal === 'Potong Kuota');
    
    let currentSisaKuotaView = customerDetail.value.sisaKuota;
    currentSisaKuotaView = Math.round(currentSisaKuotaView * 100) / 100;
    
    let dp = Number(formData.value['DP'] || 0);
    
    return {
        subtotalTx, diskonTx, totalHarga, pmbStatusVal, isPureMember,
        currentSisaKuotaView, kgTerpakaiTx, dp
    };
});

const txImage = computed(() => {
    let url = formData.value?.Foto || '';
    if (!url) return '';
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
        let m = url.match(/id=([^&]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (m) {
            // Use Google Drive thumbnail API which is much more reliable for <img> tags
            return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w800`;
        }
    }
    return url;
});

</script>

<template>
    <Teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 z-[10000] flex items-center justify-center fade-in p-[10px]">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeModal"></div>
        
        <!-- Modal Panel -->
        <div class="relative bg-white rounded-[2rem] shadow-2xl w-full flex flex-col overflow-hidden slide-up border border-slate-100" :class="isViewOnly ? 'max-w-2xl max-h-[95vh]' : 'max-w-4xl max-h-full'">
            <!-- Header (View Mode) -->
            <div v-if="isViewOnly" class="px-6 py-3.5 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
                <h3 class="text-lg font-black text-slate-800 tracking-tight flex items-center">
                    <i class="ph-bold ph-receipt mr-2 text-teal-600"></i> Detail Lengkap Transaksi
                </h3>
                <button @click="closeModal" class="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors">
                    <i class="ph-bold ph-x"></i>
                </button>
            </div>
            
            <!-- Header (Edit Mode) -->
            <div v-else class="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                    <h3 class="text-xl font-bold text-slate-800">{{ title }}</h3>
                    <p class="text-sm font-semibold text-slate-500 mt-1" v-if="formData.ID">ID Transaksi: <span class="text-indigo-500">{{ formData.ID }}</span></p>
                </div>
                <button @click="closeModal" class="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-100 transition-all">
                    <i class="ph-bold ph-x text-lg"></i>
                </button>
            </div>
            
            <!-- Body -->
            <div class="p-4 sm:p-5 overflow-y-auto bg-slate-50 w-full flex-1" v-if="isViewOnly">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-5">
                        <!-- Informasi Umum -->
                        <div class="bg-white p-3 rounded-3xl shadow-sm border border-slate-100">
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2 flex items-center">
                                <i class="ph-bold ph-info mr-2"></i> Informasi Umum
                            </h4>
                            <div class="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                                <div class="text-slate-500 font-medium text-[12px]">ID Transaksi</div>
                                <div class="font-bold text-slate-800 text-right">{{ formData.ID }}</div>
                                <div class="text-slate-500 font-medium text-[12px]">No Nota</div>
                                <div class="font-mono font-bold text-indigo-600 text-right">{{ formData['No Nota'] || '-' }}</div>
                                <div class="text-slate-500 font-medium text-[12px]">Waktu Masuk</div>
                                <div class="font-semibold text-slate-800 text-right text-[12px]">{{ formData['Waktu Masuk'] ? String(formData['Waktu Masuk']).split(' ')[0] : '-' }}</div>
                                <div class="text-slate-500 font-medium text-[12px]">Status</div>
                                <div class="text-right">
                                    <span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider"
                                          :class="formData.Status === 'Proses' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'">
                                        {{ formData.Status }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Pelanggan -->
                        <div class="bg-white p-3 rounded-3xl shadow-sm border border-slate-100">
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2 flex items-center">
                                <i class="ph-bold ph-user mr-2"></i> Pelanggan
                            </h4>
                            <div class="flex items-center">
                                <div class="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xl mr-4 uppercase">
                                    {{ customerDetail.nama.charAt(0) }}
                                </div>
                                <div>
                                    <p class="font-bold text-slate-800 text-sm mb-0.5">{{ customerDetail.nama }}</p>
                                    <p class="text-xs text-slate-500 font-mono font-semibold">{{ customerDetail.hp }}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Pembayaran -->
                        <div class="bg-white p-3 rounded-3xl shadow-sm border border-slate-100">
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2 flex items-center">
                                <i class="ph-bold ph-wallet mr-2"></i> Pembayaran
                            </h4>
                            <div class="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                                <template v-if="calculatedValues.pmbStatusVal === 'Potong Kuota' || calculatedValues.kgTerpakaiTx > 0">
                                    <div class="text-slate-500 font-medium text-[12px]">Sisa Kuota</div>
                                    <div class="font-bold text-indigo-600 text-right">{{ calculatedValues.currentSisaKuotaView }} Kg</div>
                                    <div class="text-slate-500 font-medium text-[12px]">Status Bayar</div>
                                    <div class="font-bold text-indigo-600 text-right">Potong Kuota</div>
                                    <div class="col-span-2 border-b border-dashed border-slate-200 my-1" v-if="!calculatedValues.isPureMember"></div>
                                </template>
                                
                                <template v-if="!calculatedValues.isPureMember">
                                    <template v-if="calculatedValues.diskonTx > 0">
                                        <div class="text-slate-500 font-medium text-[12px]">Diskon</div>
                                        <div class="font-bold text-emerald-600 text-right">- Rp {{ calculatedValues.diskonTx.toLocaleString('id-ID') }}</div>
                                    </template>
                                    <div class="text-slate-500 font-medium text-[12px]">Total Bayar</div>
                                    <div class="font-black text-slate-800 text-right text-[15px]">Rp {{ calculatedValues.totalHarga.toLocaleString('id-ID') }}</div>
                                    
                                    <div class="text-slate-500 font-medium text-[12px]">Status Bayar</div>
                                    <div class="font-bold text-slate-800 text-right">{{ (calculatedValues.pmbStatusVal === 'Potong Kuota' && calculatedValues.totalHarga > 0) ? 'Belum Lunas' : calculatedValues.pmbStatusVal }}</div>
                                    
                                    <template v-if="calculatedValues.pmbStatusVal === 'DP' || (calculatedValues.pmbStatusVal === 'Potong Kuota' && calculatedValues.totalHarga > 0)">
                                        <div class="text-slate-500 font-medium text-[12px]">DP</div>
                                        <div class="font-semibold text-slate-800 text-right">Rp {{ calculatedValues.dp.toLocaleString('id-ID') }}</div>
                                        <div class="col-span-2 border-b border-dashed border-slate-200 my-1"></div>
                                        <div class="text-slate-500 font-medium text-[12px]">Sisa Tagihan</div>
                                        <div class="font-black text-rose-500 text-right text-[15px]">Rp {{ (calculatedValues.totalHarga - calculatedValues.dp).toLocaleString('id-ID') }}</div>
                                    </template>
                                </template>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-3">
                        <!-- Detail Layanan -->
                        <div class="bg-white p-3 rounded-3xl shadow-sm border border-slate-100">
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2 flex items-center">
                                <i class="ph-bold ph-t-shirt mr-2"></i> Detail Layanan
                            </h4>
                            <div class="space-y-0" v-if="txItems.length > 0">
                                <div v-for="(item, idx) in txItems" :key="idx" class="flex justify-between items-center py-2 border-b border-slate-100 last:border-0 gap-3">
                                    <div class="min-w-0">
                                        <p class="text-sm font-bold text-slate-700 uppercase break-words">{{ item.nama }}</p>
                                        <p class="text-[11px] font-bold text-slate-400 mt-0.5">{{ item.qty }} {{ item.satuan }} x Rp {{ Number(item.subtotal/item.qty).toLocaleString('id-ID') }}</p>
                                    </div>
                                    <p class="text-sm font-black text-slate-800 whitespace-nowrap shrink-0">Rp {{ Number(item.subtotal).toLocaleString('id-ID') }}</p>
                                </div>
                            </div>
                            <div v-else class="text-sm font-bold text-slate-700" v-html="(formData.Layanan || '').replace(/\+/g, '<br>')"></div>
                        </div>
                        
                        <!-- Lampiran Foto -->
                        <div class="bg-white p-3 rounded-3xl shadow-sm border border-slate-100 flex-1 flex flex-col">
                            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-100 pb-2 flex items-center shrink-0">
                                <i class="ph-bold ph-camera mr-2"></i> Lampiran Foto
                            </h4>
                            <a v-if="txImage" :href="formData.Foto" target="_blank" class="block w-full flex-1 min-h-[300px] rounded-2xl overflow-hidden border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative group bg-slate-100/50">
                                <img :src="txImage" class="absolute inset-0 w-full h-full object-contain p-1" alt="Foto Transaksi" onerror="this.src='https://placehold.co/400x400/f8fafc/94a3b8?text=Gagal+Memuat+Foto'" />
                                <div class="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <i class="ph-bold ph-arrows-out text-3xl text-white drop-shadow-md"></i>
                                </div>
                            </a>
                            <div v-else class="w-full py-10 bg-slate-100/50 rounded-2xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                                <i class="ph-duotone ph-image-broken text-4xl mb-2"></i>
                                <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Tidak Ada Foto</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="p-8 overflow-y-auto max-h-[70vh] bg-white" v-else>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    <div v-for="field in displayFields" :key="field.key" 
                         :class="{'md:col-span-2': field.type === 'textarea'}">
                        
                        <label class="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            {{ field.key }}
                        </label>
                        
                        <div>
                            <!-- Textarea -->
                            <textarea v-if="field.type === 'textarea'"
                                v-model="formData[field.key]"
                                rows="3"
                                :disabled="field.disabled"
                                :class="{'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed': field.disabled, 'bg-white border-slate-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-400': !field.disabled}"
                                class="w-full px-4 py-3 rounded-xl border text-sm font-bold text-slate-700 transition-all outline-none"></textarea>
                            
                            <!-- Select -->
                            <select v-else-if="field.type === 'select'"
                                v-model="formData[field.key]"
                                :disabled="field.disabled"
                                :class="{'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed': field.disabled, 'bg-white border-slate-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-400': !field.disabled}"
                                class="w-full px-4 py-3 rounded-xl border text-sm font-bold text-slate-700 transition-all outline-none appearance-none cursor-pointer">
                                <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
                            </select>
                            
                            <!-- Input -->
                            <input v-else
                                :type="field.type === 'number' ? 'number' : 'text'"
                                v-model="formData[field.key]"
                                :disabled="field.disabled"
                                :class="{'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed': field.disabled, 'bg-white border-slate-200 focus:border-teal-400 focus:ring-1 focus:ring-teal-400': !field.disabled}"
                                class="w-full px-4 py-3 rounded-xl border text-sm font-bold text-slate-700 transition-all outline-none" />
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Footer -->
            <div v-if="!isViewOnly" class="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                <button @click="closeModal" class="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-800 transition-colors">
                    Tutup
                </button>
                <button @click="saveModal" class="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-teal-500 hover:bg-teal-600 shadow-[0_4px_12px_-2px_rgba(20,184,166,0.4)] transition-all flex items-center gap-2 active:scale-95">
                    <i class="ph-bold ph-floppy-disk text-base"></i> Simpan Transaksi
                </button>
            </div>
        </div>
        </div>
    </Teleport>
</template>

<style scoped>
.fade-in { animation: fadeIn 0.2s ease-out forwards; }
.slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideUp {
    from { opacity: 0; transform: translateY(20px) scale(0.95); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
