<script setup>
import { ref, onMounted, watch } from 'vue';
import { useAppStore } from '../stores/useAppStore';

const store = useAppStore();

const formData = ref({
    namaToko: '',
    alamatToko: '',
    noTelp: '',
    logo: '',
    printerMac: '',
    footerText: ''
});

const isSaving = ref(false);
const saveSuccess = ref(false);

const loadSettings = () => {
    if (store.appData && store.appData.pengaturan) {
        // Since 'pengaturan' might still be an array from previous migrations, let's handle it
        let p = store.appData.pengaturan;
        if (Array.isArray(p)) {
            p = p[0] || {};
        }
        formData.value = {
            namaToko: p.namaToko || p['Nama Toko'] || '',
            alamatToko: p.alamatToko || p['Alamat Toko'] || '',
            noTelp: p.noTelp || p['No Telp'] || '',
            logo: p.logo || '',
            printerMac: p.printerMac || '',
            footerText: p.footerText || ''
        };
    }
};

watch(() => store.appData.pengaturan, () => {
    if (!isSaving.value) loadSettings();
}, { deep: true });

onMounted(() => {
    loadSettings();
});

const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('File harus berupa gambar (JPG/PNG).');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        formData.value.logo = e.target.result;
    };
    reader.readAsDataURL(file);
};

const clearLogo = () => {
    formData.value.logo = '';
};

const saveSettings = async () => {
    isSaving.value = true;
    saveSuccess.value = false;
    
    try {
        await store.updateSettings({ ...formData.value });
        saveSuccess.value = true;
        setTimeout(() => {
            saveSuccess.value = false;
        }, 3000);
    } catch (error) {
        console.error("Error saving settings:", error);
        alert("Gagal menyimpan pengaturan.");
    } finally {
        isSaving.value = false;
    }
};

</script>

<template>
    <div class="fade-in p-4 sm:p-6 w-full flex-1 flex flex-col min-h-0 min-w-0 items-center overflow-y-auto">
        <div class="w-full max-w-4xl space-y-6 pb-20">
            <!-- Header -->
            <div class="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 flex items-center justify-between">
                <div>
                    <h2 class="text-2xl font-black text-slate-800 tracking-tight flex items-center">
                        <div class="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mr-3 shadow-inner">
                            <i class="ph-bold ph-gear text-xl"></i>
                        </div>
                        Pengaturan Sistem
                    </h2>
                    <p class="text-slate-500 font-medium text-sm mt-1 ml-[52px]">Sesuaikan informasi toko, koneksi printer, dan preferensi struk aplikasi Anda.</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Col 1: Informasi Toko -->
                <div class="space-y-6">
                    <div class="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-50 to-white rounded-bl-full -z-10 opacity-60"></div>
                        
                        <h3 class="text-lg font-bold text-slate-800 mb-6 flex items-center">
                            <i class="ph-fill ph-storefront text-indigo-500 mr-2 text-xl"></i> Informasi Toko
                        </h3>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Nama Laundry</label>
                                <input type="text" v-model="formData.namaToko" placeholder="Masukkan nama toko..." class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 outline-none transition-all text-sm font-bold text-slate-800">
                            </div>
                            <div>
                                <label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Nomor Telepon / WA</label>
                                <input type="text" v-model="formData.noTelp" placeholder="Contoh: 08123456789" class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 outline-none transition-all text-sm font-bold text-slate-800">
                            </div>
                            <div>
                                <label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Alamat Toko</label>
                                <textarea rows="3" v-model="formData.alamatToko" placeholder="Alamat lengkap toko..." class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-50 outline-none transition-all text-sm font-medium text-slate-700 resize-none"></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Col 1: Logo Upload -->
                    <div class="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-fuchsia-50 to-white rounded-bl-full -z-10 opacity-60"></div>
                        
                        <h3 class="text-lg font-bold text-slate-800 mb-6 flex items-center">
                            <i class="ph-fill ph-image text-fuchsia-500 mr-2 text-xl"></i> Logo Toko
                        </h3>

                        <div class="flex items-center gap-6">
                            <div class="w-24 h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center shrink-0 overflow-hidden shadow-inner group relative">
                                <template v-if="formData.logo">
                                    <img :src="formData.logo" class="w-full h-full object-contain p-2" />
                                    <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button @click="clearLogo" class="w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform" title="Hapus Logo">
                                            <i class="ph-bold ph-trash"></i>
                                        </button>
                                    </div>
                                </template>
                                <template v-else>
                                    <i class="ph-bold ph-image text-4xl text-slate-300"></i>
                                </template>
                            </div>
                            
                            <div class="flex-1">
                                <input type="file" id="logo-upload" accept="image/png, image/jpeg" class="hidden" @change="handleImageUpload">
                                <label for="logo-upload" class="cursor-pointer inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-fuchsia-50 to-fuchsia-100 hover:from-fuchsia-100 hover:to-fuchsia-200 border border-fuchsia-200 text-fuchsia-700 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-all">
                                    <i class="ph-bold ph-upload-simple mr-2 text-lg"></i> Pilih Gambar
                                </label>
                                <p class="text-[11px] font-semibold text-slate-400 mt-3 bg-slate-50 p-2 rounded-lg inline-block border border-slate-100">Format: JPG, PNG. Max: 1MB.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Col 2: Printer & Footer -->
                <div class="space-y-6">
                    <div class="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 to-white rounded-bl-full -z-10 opacity-60"></div>
                        
                        <h3 class="text-lg font-bold text-slate-800 mb-6 flex items-center">
                            <i class="ph-fill ph-printer text-blue-500 mr-2 text-xl"></i> Printer Bluetooth
                        </h3>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Alamat MAC / Nama Printer</label>
                                <div class="relative">
                                    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <i class="ph-bold ph-bluetooth text-blue-400 text-lg"></i>
                                    </div>
                                    <input type="text" v-model="formData.printerMac" placeholder="Contoh: 00:11:22:33:44:55 atau MPT-II" class="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-50 outline-none transition-all text-sm font-bold text-slate-800">
                                </div>
                                <p class="text-[11px] text-slate-400 font-medium mt-2 leading-relaxed">
                                    Masukkan <span class="font-bold text-slate-500">MAC Address</span> atau <span class="font-bold text-slate-500">Nama Device Bluetooth</span> yang digunakan untuk mencetak struk thermal.
                                </p>
                            </div>
                            
                            <!-- Dummy button just to show UI completeness for bluetooth -->
                            <button type="button" class="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-colors border border-slate-200 flex justify-center items-center">
                                <i class="ph-bold ph-magnifying-glass mr-2"></i> Cari Printer (Beta)
                            </button>
                        </div>
                    </div>

                    <div class="bg-white rounded-[2rem] p-6 sm:p-8 shadow-sm border border-slate-100 relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-50 to-white rounded-bl-full -z-10 opacity-60"></div>
                        
                        <h3 class="text-lg font-bold text-slate-800 mb-6 flex items-center">
                            <i class="ph-fill ph-receipt text-amber-500 mr-2 text-xl"></i> Ketentuan Struk
                        </h3>
                        
                        <div class="space-y-4">
                            <div>
                                <label class="block text-[11px] font-extrabold text-slate-500 mb-1.5 uppercase tracking-wide">Pesan / Syarat & Ketentuan di Bawah Struk</label>
                                <textarea rows="4" v-model="formData.footerText" placeholder="Contoh:&#10;1. Cucian luntur bukan tanggung jawab kami.&#10;2. Terima kasih atas kunjungannya!" class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-50 outline-none transition-all text-sm font-medium text-slate-700 resize-none leading-relaxed"></textarea>
                                <p class="text-[11px] text-slate-400 font-medium mt-2 leading-relaxed">
                                    Teks ini akan dicetak otomatis di bagian paling bawah pada setiap struk pelanggan.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Save Action -->
            <div class="flex justify-end pt-4 pb-12">
                <button @click="saveSettings" :disabled="isSaving" :class="[
                    'px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center transition-all active:scale-95',
                    saveSuccess ? 'bg-green-500 hover:bg-green-600 text-white shadow-green-500/30' : 
                    (isSaving ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white shadow-teal-500/30')
                ]">
                    <template v-if="isSaving">
                        <i class="ph-bold ph-spinner animate-spin mr-2 text-xl"></i> MENYIMPAN...
                    </template>
                    <template v-else-if="saveSuccess">
                        <i class="ph-bold ph-check-circle mr-2 text-xl"></i> BERHASIL DISIMPAN!
                    </template>
                    <template v-else>
                        <i class="ph-bold ph-floppy-disk mr-2 text-xl"></i> SIMPAN PENGATURAN
                    </template>
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.fade-in { animation: fadeIn 0.3s ease-out forwards; }
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>
