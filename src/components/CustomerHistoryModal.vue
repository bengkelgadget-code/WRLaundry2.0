<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { useAppStore } from '../stores/useAppStore';

const props = defineProps({
    isOpen: { type: Boolean, default: false },
    customerId: { type: String, default: null }
});

const emit = defineEmits(['close', 'view-transaction']);
const store = useAppStore();

const filterType = ref('all');
const filterMonth = ref('');
const filterDate = ref('');
const isExporting = ref(false);

const customer = computed(() => {
    if (!props.customerId) return null;
    let cust = store.appData.pelanggan?.find(c => String(c.ID) === String(props.customerId));
    if (!cust) {
        let prodCust = store.appData.produksi?.find(t => String(t['ID Pelanggan']) === String(props.customerId));
        if (prodCust) {
            cust = { ID: props.customerId, 'Nama Pelanggan': prodCust['Nama Pelanggan'], 'No Telpon': '' };
        }
    }
    return cust;
});

const customerName = computed(() => customer.value ? customer.value['Nama Pelanggan'] : '');
const customerPhone = computed(() => customer.value ? customer.value['No Telpon'] : '');

// Set default dates if needed
watch(filterType, (newVal) => {
    if (newVal === 'month' && !filterMonth.value) {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        filterMonth.value = `${d.getFullYear()}-${m}`;
    } else if (newVal === 'date' && !filterDate.value) {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dy = String(d.getDate()).padStart(2, '0');
        filterDate.value = `${d.getFullYear()}-${m}-${dy}`;
    }
});

const txData = computed(() => {
    if (!props.customerId) return [];
    return store.appData.produksi?.filter(tx => String(tx['ID Pelanggan']) === String(props.customerId)) || [];
});

const filteredTransactions = computed(() => {
    return txData.value.filter(tx => {
        if (filterType.value === 'all') return true;
        
        const wktMasuk = tx['Waktu Masuk'] ? String(tx['Waktu Masuk']) : '';
        
        if (filterType.value === 'month' && filterMonth.value) {
            const fParts = filterMonth.value.split('-');
            if (fParts.length === 2) {
                const formatSlash = `/${fParts[1]}/${fParts[0]}`;
                const formatDash = `-${fParts[1]}-${fParts[0]}`;
                return wktMasuk.includes(formatSlash) || wktMasuk.includes(formatDash) || wktMasuk.includes(filterMonth.value);
            }
        } else if (filterType.value === 'date' && filterDate.value) {
            const fParts = filterDate.value.split('-');
            if (fParts.length === 3) {
                const formatSlash = `${fParts[2]}/${fParts[1]}/${fParts[0]}`;
                const formatDash = `${fParts[2]}-${fParts[1]}-${fParts[0]}`;
                return wktMasuk.includes(formatSlash) || wktMasuk.includes(formatDash) || wktMasuk.includes(filterDate.value);
            }
        }
        return true;
    });
});

const totals = computed(() => {
    let kg = 0;
    let pcs = 0;
    let rp = 0;
    
    filteredTransactions.value.forEach(tx => {
        rp += Number(tx['Total Harga']) || 0;
        let items = [];
        try { 
            const parsed = JSON.parse(tx['Detail Layanan JSON'] || '{}'); 
            items = Array.isArray(parsed) ? parsed : (parsed.items || []); 
        } catch(e) {}
        
        items.forEach(item => {
            if (item.satuan === 'Kg') kg += Number(item.qty) || 0;
            else if (item.satuan === 'Pcs') pcs += Number(item.qty) || 0;
        });
    });
    
    return {
        kg: Math.round(kg * 100) / 100,
        pcs,
        rp
    };
});

const closeModal = () => {
    emit('close');
};

const viewTx = (tx) => {
    emit('view-transaction', tx);
};

// HELPER LOGIC FOR EXPORT
const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID').format(angka || 0);
};

const loadScript = (src, checkVar) => {
    return new Promise((resolve, reject) => {
        if (window[checkVar]) {
            resolve();
            return;
        }
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
    });
};

const showToast = (msg) => {
    alert(msg); // fallback toast
};

const exportHistory = async (type) => {
    if (filteredTransactions.value.length === 0) {
        showToast("Tidak ada data transaksi untuk diexport");
        return;
    }

    isExporting.value = true;
    
    try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'html2canvas');
        if (type === 'pdf') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', 'jspdf');
        }

        // Tunggu komponen dirender sempurna
        await nextTick();
        await new Promise(r => setTimeout(r, 500)); // beri waktu font/css ter-apply

        const container = document.getElementById('report-export-container');
        if (!container) throw new Error("Render container not found");
        
        // Setup hidden container style for rendering
        container.style.display = 'block';
        
        const canvas = await window.html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        
        // Hide again
        container.style.display = 'none';

        const imgData = canvas.toDataURL('image/jpeg', 0.85);

        if (type === 'wa') {
            const fileName = 'Laporan_' + customerName.value.replace(/ /g, '_') + '.jpg';
            let phone = customerPhone.value || '';
            phone = phone.replace(/\D/g, ''); 
            if (phone.startsWith('0')) phone = '62' + phone.substring(1);
            
            const waMsg = `Halo *${customerName.value}*,\nBerikut adalah lampiran laporan/rekap transaksi Anda. Mohon konfirmasi laporan yang telah kami bagikan ya. Terima kasih! 🙏`;
            
            canvas.toBlob((blob) => {
                const file = new File([blob], fileName, { type: 'image/jpeg' });
                
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    navigator.share({
                        title: 'Laporan Transaksi',
                        text: waMsg,
                        files: [file]
                    }).then(() => {
                        showToast("Laporan berhasil dibagikan!");
                    }).catch(err => {
                        console.log('Share canceled/failed:', err);
                    });
                } else {
                    // Fallback
                    const a = document.createElement('a');
                    a.href = imgData;
                    a.download = fileName;
                    a.click();
                    
                    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`;
                    try {
                        canvas.toBlob((blobPng) => {
                            if (navigator.clipboard && navigator.clipboard.write) {
                                navigator.clipboard.write([
                                    new window.ClipboardItem({ 'image/png': blobPng })
                                ]).then(() => {
                                    showToast("Gambar disalin! Tekan Paste (Ctrl+V) di WhatsApp.");
                                }).catch(e => console.log(e));
                            }
                        }, 'image/png');
                    } catch(e) {}
                    
                    setTimeout(() => window.open(waUrl, '_blank'), 800);
                }
            }, 'image/jpeg', 0.85);

        } else if (type === 'pdf') {
            const jsPDF = window.jspdf.jsPDF;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save('Laporan_' + customerName.value.replace(/ /g, '_') + '.pdf');
            showToast("PDF berhasil diunduh!");
        }

    } catch (e) {
        showToast("Gagal memproses laporan: " + e.message);
        console.error(e);
    } finally {
        isExporting.value = false;
    }
};

const resolveLayananName = (nama) => {
    return (nama || '').replace(/\+/g, ', ');
};

</script>

<template>
    <Teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 fade-in">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeModal"></div>
            
            <!-- Modal Container -->
            <div class="relative bg-white w-full max-w-2xl max-h-[95vh] sm:h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden slide-up border border-slate-100">
                
                <!-- Header -->
                <div class="px-5 py-4 sm:px-6 sm:py-5 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
                    <h3 class="text-lg font-black text-slate-800 tracking-tight flex items-center truncate">
                        <i class="ph-bold ph-clock-counter-clockwise mr-2 text-teal-600"></i> 
                        History: <span class="ml-2 text-teal-600 truncate max-w-[150px] sm:max-w-xs">{{ customerName }}</span>
                    </h3>
                    <button type="button" @click="closeModal" class="w-8 h-8 sm:w-9 sm:h-9 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors shrink-0">
                        <i class="ph-bold ph-x"></i>
                    </button>
                </div>

                <!-- Toolbar Filters -->
                <div class="bg-white px-5 py-4 border-b border-slate-100 shrink-0 flex flex-row flex-wrap gap-2 items-center justify-between">
                    <div class="flex gap-2">
                        <select v-model="filterType" class="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-300">
                            <option value="all">Semua</option>
                            <option value="month">Per Bulan</option>
                            <option value="date">Tanggal</option>
                        </select>
                        <input v-if="filterType === 'month'" type="month" v-model="filterMonth" class="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-300 slide-left">
                        <input v-if="filterType === 'date'" type="date" v-model="filterDate" class="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-teal-300 slide-left">
                    </div>

                    <div class="flex gap-2 shrink-0">
                        <button type="button" @click="exportHistory('pdf')" :disabled="isExporting" class="flex items-center justify-center bg-white text-rose-500 border border-rose-100 shadow-sm hover:bg-rose-50 rounded-xl px-4 py-2 text-[0.6875rem] font-black transition-all active:scale-95 disabled:opacity-50">
                            <i v-if="isExporting" class="ph-bold ph-spinner animate-spin text-sm mr-1.5"></i>
                            <i v-else class="ph-bold ph-file-pdf text-sm mr-1.5"></i> PDF
                        </button>
                        <button type="button" @click="exportHistory('wa')" :disabled="isExporting" class="flex items-center justify-center bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-sm hover:from-emerald-500 hover:to-emerald-600 rounded-xl px-4 py-2 text-[0.6875rem] font-black transition-all active:scale-95 disabled:opacity-50">
                            <i v-if="isExporting" class="ph-bold ph-spinner animate-spin text-sm mr-1.5"></i>
                            <i v-else class="ph-bold ph-whatsapp-logo text-sm mr-1.5"></i> WA
                        </button>
                    </div>
                </div>
                
                <!-- List Transactions -->
                <div class="overflow-y-auto flex-1 p-4 sm:p-5 bg-slate-50 w-full relative space-y-3">
                    <div v-if="filteredTransactions.length === 0" class="flex flex-col items-center justify-center py-12 opacity-50 h-full">
                        <i class="ph-duotone ph-receipt text-6xl mb-3 text-slate-400"></i>
                        <p class="text-sm font-bold text-slate-500">Tidak ada transaksi ditemukan.</p>
                    </div>
                    
                    <div v-for="tx in filteredTransactions" :key="tx.ID" @click="viewTx(tx)" class="bg-white p-4 border border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-100 hover:border-teal-300 transition-all shadow-sm active:scale-95 group">
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-[0.625rem] font-bold text-slate-500 font-mono tracking-widest">{{ tx['No Nota'] || tx.ID }}</span>
                            <span class="text-[0.625rem] font-bold text-slate-400 group-hover:text-teal-600 transition-colors flex items-center">
                                <i class="ph-bold ph-calendar-blank mr-1"></i> {{ (tx['Waktu Masuk'] || '-').split(' ')[0] }}
                            </span>
                        </div>
                        <div class="flex justify-between items-start mb-3">
                            <p class="text-[0.75rem] font-bold text-slate-700 leading-snug w-2/3 pr-2">{{ resolveLayananName(tx['Layanan']) }}</p>
                            <p class="text-[0.875rem] font-black text-slate-800 w-1/3 text-right shrink-0">Rp {{ formatRupiah(tx['Total Harga']) }}</p>
                        </div>
                        <div class="flex justify-between items-center">
                            <div class="flex gap-2 items-center">
                                <!-- Pembayaran Badge -->
                                <span class="px-2 py-0.5 rounded-md text-[0.5625rem] font-black uppercase tracking-wide" 
                                      :class="{
                                          'bg-emerald-50 text-emerald-600 border border-emerald-200': tx['Pembayaran'] === 'Lunas',
                                          'bg-amber-50 text-amber-600 border border-amber-200': tx['Pembayaran'] === 'DP',
                                          'bg-indigo-50 text-indigo-600 border border-indigo-200': tx['Pembayaran'] === 'Potong Kuota',
                                          'bg-red-50 text-red-500 border border-red-200': !['Lunas','DP','Potong Kuota'].includes(tx['Pembayaran'])
                                      }">
                                    {{ tx['Pembayaran'] || 'Belum Lunas' }}
                                </span>
                                <!-- Status Badge -->
                                <span class="px-2 py-0.5 rounded-md text-[0.5625rem] font-black uppercase tracking-wide"
                                      :class="{
                                          'bg-amber-100 text-amber-700 border border-amber-200': tx.Status === 'Proses',
                                          'bg-emerald-100 text-emerald-700 border border-emerald-200': tx.Status === 'Selesai',
                                          'bg-blue-100 text-blue-700 border border-blue-200': !['Proses','Selesai'].includes(tx.Status)
                                      }">
                                    {{ tx.Status }}
                                </span>
                            </div>
                            <i class="ph-bold ph-caret-right text-slate-300 group-hover:text-teal-500 transition-colors"></i>
                        </div>
                    </div>
                </div>

                <!-- Footer Stats -->
                <div class="p-4 sm:p-5 bg-white border-t border-slate-100 shrink-0 grid grid-cols-3 gap-2 sm:gap-3">
                    <div class="bg-slate-50 rounded-xl p-2 sm:p-3 border border-slate-100 text-center">
                        <p class="text-[0.5625rem] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Berat Kiloan</p>
                        <p class="text-sm sm:text-base font-black text-slate-800">{{ totals.kg }} Kg</p>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-2 sm:p-3 border border-slate-100 text-center">
                        <p class="text-[0.5625rem] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Satuan</p>
                        <p class="text-sm sm:text-base font-black text-slate-800">{{ totals.pcs }} Pcs</p>
                    </div>
                    <div class="bg-teal-50 rounded-xl p-2 sm:p-3 border border-teal-100 text-center">
                        <p class="text-[0.5625rem] font-black text-teal-500 uppercase tracking-widest mb-1 truncate">Total Biaya</p>
                        <p class="text-sm sm:text-base font-black text-teal-700 truncate">Rp {{ formatRupiah(totals.rp) }}</p>
                    </div>
                </div>
            </div>

            <!-- HIDDEN RENDER CONTAINER FOR EXPORT -->
            <div id="report-export-container" class="absolute -left-[9999px] -top-[9999px] w-[700px] bg-white p-5 font-sans text-black" style="display: none;">
                <table style="width: 100%; border: none; font-size: 13px; margin-bottom: 12px; font-weight: bold; text-align: left; font-family: Arial, sans-serif;">
                    <tr>
                        <td style="width: 120px; padding: 2px 0;">Nama</td>
                        <td>: {{ customerName.toUpperCase() }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 0;">ID Cust</td>
                        <td>: {{ customerId || '-' }}</td>
                    </tr>
                    <tr>
                        <td style="padding: 2px 0;">Periode</td>
                        <td>: 
                            <span v-if="filterType === 'all'">SEMUA WAKTU</span>
                            <span v-else-if="filterType === 'month' && filterMonth">
                                {{ new Date(filterMonth + '-01').toLocaleString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase() }}
                            </span>
                            <span v-else-if="filterType === 'date' && filterDate">
                                {{ new Date(filterDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase() }}
                            </span>
                        </td>
                    </tr>
                </table>

                <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: center; font-family: Arial, sans-serif;">
                    <thead>
                        <tr style="background-color: #203864; color: white;">
                            <th style="border: 1px solid #000; padding: 6px;">TANGGAL</th>
                            <th style="border: 1px solid #000; padding: 6px;">LAYANAN</th>
                            <th style="border: 1px solid #000; padding: 6px;">KG/PCS</th>
                            <th style="border: 1px solid #000; padding: 6px;">NOMINAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        <template v-for="tx in filteredTransactions" :key="'export-'+tx.ID">
                            <!-- Helper function equivalent to parse items inside template is tricky, so we will do a V-for over computed array or inline logic -->
                            <tr v-if="!JSON.parse(tx['Detail Layanan JSON'] || '{}').items?.length">
                                <td style="border: 1px solid #000; padding: 4px 6px;">{{ tx['Waktu Masuk']?.split(' ')[0] || '-' }}</td>
                                <td style="border: 1px solid #000; padding: 4px 6px; text-align: left;">{{ (tx['Layanan'] || '-').toUpperCase() }}</td>
                                <td style="border: 1px solid #000; padding: 4px 6px;">-</td>
                                <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{{ formatRupiah(tx['Total Harga']) }}</td>
                            </tr>
                            <template v-else>
                                <tr v-for="(item, idx) in JSON.parse(tx['Detail Layanan JSON'] || '{}').items" :key="'item-'+idx">
                                    <td v-if="idx === 0" style="border: 1px solid #000; padding: 4px 6px;" :rowspan="JSON.parse(tx['Detail Layanan JSON'] || '{}').items.length">{{ tx['Waktu Masuk']?.split(' ')[0] || '-' }}</td>
                                    <td style="border: 1px solid #000; padding: 4px 6px; text-align: left;">{{ String(item.nama).toUpperCase() }}</td>
                                    <td style="border: 1px solid #000; padding: 4px 6px;">{{ item.qty }}</td>
                                    <td style="border: 1px solid #000; padding: 4px 6px; text-align: right;">{{ formatRupiah(item.subtotal) }}</td>
                                </tr>
                            </template>
                        </template>
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" style="border: 1px solid #000; padding: 6px; border-right: none;"></td>
                            <td style="border: 1px solid #000; padding: 6px; font-weight: bold;">{{ totals.kg + totals.pcs }}</td>
                            <td style="border: 1px solid #000; padding: 6px; font-weight: bold; text-align: right;">{{ formatRupiah(totals.rp) }}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

        </div>
    </Teleport>
</template>

<style scoped>
.fade-in { animation: fadeIn 0.2s ease-out forwards; }
.slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.slide-left { animation: slideLeft 0.2s ease-out forwards; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideLeft { from { transform: translateX(10px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
</style>
