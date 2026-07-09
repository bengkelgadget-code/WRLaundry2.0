<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useAppStore } from '../stores/useAppStore';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { getDatabase, ref as dbRef, update, set } from 'firebase/database';

const props = defineProps({
    isOpen: { type: Boolean, default: false },
    initialData: { type: Object, default: null }
});

const emit = defineEmits(['close', 'saved']);
const store = useAppStore();

const isEditMode = computed(() => !!props.initialData);

// Basic state
const isLoading = ref(false);
const formData = ref({
    ID: '',
    'No Nota': '',
    'ID Pelanggan': '',
    'Nama Pelanggan': '',
    'No Telpon': '',
    Status: 'Proses',
    Pembayaran: 'Belum Lunas',
    'Total Harga': 0,
    Diskon: 0,
    'Sisa Bayar': 0,
    DP: 0,
    'Layanan': '', // string summary
    'Detail Layanan JSON': '[]',
    'Foto': '',
    'Waktu Masuk': '',
    'Kg Terpakai': 0,
    'Potongan Member': 0
});

const services = ref([]);
const dpAmount = ref(0);
const diskonAmount = ref(0);
const selectedCustomer = ref(null);
const imageFile = ref(null);
const imagePreview = ref('');

// Autocomplete State
const showNamaDropdown = ref(false);
const showHpDropdown = ref(false);

// Services State
let itemIdCounter = 1;
const txItems = ref([
    { id: 1, type: '', serviceId: '', price: 0, qty: 1, subtotal: 0, showDropdown: false, searchQuery: '' }
]);

const subtotalAll = computed(() => txItems.value.reduce((sum, item) => sum + (item.subtotal || 0), 0));
const totalPotonganMember = ref(0);
const kgTerpakai = ref(0);

const calculateTotals = () => {
    let potong = 0;
    let kg = 0;
    
    if (formData.value.Pembayaran === 'Potong Kuota' && selectedCustomer.value) {
        let currentKuota = Number(selectedCustomer.value['Sisa Kuota (Kg)'] || 0);
        if (currentKuota > 0) {
            txItems.value.forEach(d => {
                if (d.type === 'Kiloan' && currentKuota > 0) {
                    let kgDipotong = Math.min(d.qty, currentKuota);
                    currentKuota -= kgDipotong;
                    kg += kgDipotong;
                    potong += (kgDipotong * d.price);
                }
            });
        }
    }
    
    totalPotonganMember.value = potong;
    kgTerpakai.value = kg;
    
    let total = subtotalAll.value - Number(formData.value.Diskon || 0) - potong;
    if (total < 0) total = 0;
    formData.value['Total Harga'] = total;
    
    if (formData.value.Pembayaran === 'DP') {
        formData.value['Sisa Bayar'] = total - Number(formData.value.DP || 0);
    } else if (formData.value.Pembayaran === 'Belum Lunas') {
        formData.value['Sisa Bayar'] = total;
    } else if (formData.value.Pembayaran === 'Lunas') {
        formData.value['Sisa Bayar'] = 0;
    } else {
        formData.value['Sisa Bayar'] = total > 0 ? total : 0;
    }
};

watch(() => formData.value.Pembayaran, () => {
    if (formData.value.Pembayaran === 'Potong Kuota' && selectedCustomer.value && Number(selectedCustomer.value['Sisa Kuota (Kg)'] || 0) === 0) {
        formData.value.Pembayaran = 'Belum Lunas';
        alert('Pelanggan ini tidak memiliki Sisa Kuota Member Kiloan!');
    }
    calculateTotals();
});
watch(() => formData.value.Diskon, () => calculateTotals());
watch(() => formData.value.DP, () => calculateTotals());
watch(() => selectedCustomer.value, () => calculateTotals());

const addServiceRow = () => {
    itemIdCounter++;
    txItems.value.push({ id: itemIdCounter, type: '', serviceId: '', price: 0, qty: 1, subtotal: 0, showDropdown: false, searchQuery: '' });
    calculateTotals();
    
    // Focus new service input after render
    setTimeout(() => {
        const srvInputs = document.querySelectorAll('.service-input');
        if (srvInputs.length > 0) {
            const el = srvInputs[srvInputs.length - 1];
            el.focus();
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 150);
        }
    }, 150);
};

const removeServiceRow = (index) => {
    txItems.value.splice(index, 1);
    calculateTotals();
};

const handleServiceChange = (item) => {
    if (!item.serviceId) {
        item.price = 0;
        item.type = '';
        calculateItemSubtotal(item);
        return;
    }
    const isKiloan = item.serviceId.startsWith('K-');
    const realId = item.serviceId.substring(2);
    
    if (isKiloan) {
        const srv = kiloanItems.value.find(x => x.ID === realId);
        if (srv) {
            item.price = parseFloat(srv['Harga/Kg']);
            item.type = 'Kiloan';
        }
    } else {
        const srv = satuanItems.value.find(x => x.ID === realId);
        if (srv) {
            item.price = parseFloat(srv['Harga/Pcs']);
            item.type = 'Satuan';
        }
    }
    calculateItemSubtotal(item);
};

const calculateItemSubtotal = (item) => {
    if (item.type === 'Satuan') item.qty = Math.ceil(item.qty);
    item.subtotal = (item.price || 0) * (item.qty || 0);
    calculateTotals();
};

const formatRupiah = (angka) => {
    return new Intl.NumberFormat('id-ID').format(angka || 0);
};

const filteredCustomersByName = computed(() => {
    if (!formData.value['Nama Pelanggan']) return customers.value;
    const q = formData.value['Nama Pelanggan'].toLowerCase();
    return customers.value.filter(c => (c['Nama Pelanggan'] || '').toLowerCase().includes(q));
});

const filteredCustomersByHp = computed(() => {
    if (!formData.value['No Telpon']) return customers.value;
    const q = formData.value['No Telpon'].toLowerCase();
    return customers.value.filter(c => (c['No Telpon'] || '').toLowerCase().includes(q));
});

const selectCustomer = (c) => {
    selectedCustomer.value = c;
    formData.value['ID Pelanggan'] = c.ID;
    formData.value['Nama Pelanggan'] = c['Nama Pelanggan'] || '';
    formData.value['No Telpon'] = c['No Telpon'] || '';
    formData.value['No Telpon'] = c['No Telpon'] || '';
    showNamaDropdown.value = false;
    showHpDropdown.value = false;
    
    // Potong Kuota status should be reset or checked based on this
    setTimeout(() => {
        const firstSrv = document.querySelector('.service-input');
        if (firstSrv) {
            firstSrv.focus();
            firstSrv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 150);
};

const handleCustomerInput = (field) => {
    // If user types, we reset selectedCustomer if it doesn't match perfectly
    selectedCustomer.value = null;
    if (field === 'nama') {
        showNamaDropdown.value = true;
        const exactMatch = customers.value.find(c => (c['Nama Pelanggan'] || '').toLowerCase() === (formData.value['Nama Pelanggan'] || '').toLowerCase());
        if (exactMatch) {
            formData.value['No Telpon'] = exactMatch['No Telpon'] || '';
            selectedCustomer.value = exactMatch;
            formData.value['ID Pelanggan'] = exactMatch.ID;
        }
    }
    if (field === 'hp') {
        showHpDropdown.value = true;
        const exactMatch = customers.value.find(c => (c['No Telpon'] || '') === (formData.value['No Telpon'] || ''));
        if (exactMatch) {
            formData.value['Nama Pelanggan'] = exactMatch['Nama Pelanggan'] || '';
            selectedCustomer.value = exactMatch;
            formData.value['ID Pelanggan'] = exactMatch.ID;
        }
    }
};

const handleAutocompleteKeydown = (e, field) => {
    if (field === 'nama') {
        if (showNamaDropdown.value && filteredCustomersByName.value.length > 0) {
            e.preventDefault();
            selectCustomer(filteredCustomersByName.value[0]);
            const hpInputEl = document.querySelector('input[placeholder="Ketik no HP..."]');
            if (hpInputEl) hpInputEl.focus();
        } else {
            e.preventDefault();
            const hpInputEl = document.querySelector('input[placeholder="Ketik no HP..."]');
            if (hpInputEl) hpInputEl.focus();
        }
    } else if (field === 'hp') {
        if (showHpDropdown.value && filteredCustomersByHp.value.length > 0) {
            e.preventDefault();
            selectCustomer(filteredCustomersByHp.value[0]);
            const firstSrv = document.querySelector('.service-input');
            if (firstSrv) firstSrv.focus();
        } else {
            e.preventDefault();
            const firstSrv = document.querySelector('.service-input');
            if (firstSrv) firstSrv.focus();
        }
    }
};

const scrollToActive = (e) => {
    setTimeout(() => {
        if (e && e.target) {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 150);
};

const handleQtyFocus = (e) => {
    scrollToActive(e);
    if (e && e.target) {
        e.target.select();
    }
};

const focusDiskon = () => {
    setTimeout(() => {
        const diskonEl = document.querySelector('.diskon-input');
        if (diskonEl) {
            diskonEl.focus();
            diskonEl.select();
            diskonEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 150);
};

const focusQty = (index) => {
    setTimeout(() => {
        const qtyInputs = document.querySelectorAll('.qty-input');
        if (qtyInputs[index]) qtyInputs[index].focus();
    }, 50);
};

const handleServiceKeydown = (e, item, index) => {
    if (item.showDropdown && item.searchQuery) {
        const kItems = filteredKiloan(item.searchQuery);
        const sItems = filteredSatuan(item.searchQuery);
        if (kItems.length > 0) {
            e.preventDefault();
            selectService(item, 'K-' + kItems[0].ID, kItems[0]);
            focusQty(index);
        } else if (sItems.length > 0) {
            e.preventDefault();
            selectService(item, 'S-' + sItems[0].ID, sItems[0]);
            focusQty(index);
        }
    } else {
        e.preventDefault();
        focusQty(index);
    }
};

// Computed properties for dropdowns
const kiloanItems = computed(() => {
    let items = [...(store.appData.kiloan || [])];
    items.forEach(i => {
        let w = store.appData.waktu?.find(x => x.ID === i['Jenis Waktu']);
        i._waktuJam = w ? parseInt(w['Waktu (Jam)']) : 0;
    });
    return items.sort((a, b) => b._waktuJam - a._waktuJam); // terlama pertama
});

const satuanItems = computed(() => {
    let items = [...(store.appData.satuan || [])];
    items.forEach(i => {
        let w = store.appData.waktu?.find(x => x.ID === i['Jenis Waktu']);
        i._waktuJam = w ? parseInt(w['Waktu (Jam)']) : 0;
    });
    return items.sort((a, b) => b._waktuJam - a._waktuJam);
});

const customers = computed(() => store.appData.pelanggan || []);

const filteredKiloan = (query) => {
    if (!query) return kiloanItems.value;
    const q = query.toLowerCase();
    return kiloanItems.value.filter(k => k['Nama Layanan'].toLowerCase().includes(q))
    .map(k => {
        let w = store.appData.waktu?.find(x => x.ID === k['Jenis Waktu']);
        return { ...k, _waktuJam: w ? parseInt(w['Waktu (Jam)']) : 0 };
    })
    .sort((a, b) => {
        const aName = a['Nama Layanan'].toLowerCase();
        const bName = b['Nama Layanan'].toLowerCase();
        if (aName === q && bName !== q) return -1;
        if (bName === q && aName !== q) return 1;
        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;
        return b._waktuJam - a._waktuJam;
    });
};

const filteredSatuan = (query) => {
    if (!query) return satuanItems.value;
    const q = query.toLowerCase();
    return satuanItems.value.filter(s => s['Nama Layanan'].toLowerCase().includes(q))
    .map(s => {
        let w = store.appData.waktu?.find(x => x.ID === s['Jenis Waktu']);
        return { ...s, _waktuJam: w ? parseInt(w['Waktu (Jam)']) : 0 };
    })
    .sort((a, b) => {
        const aName = a['Nama Layanan'].toLowerCase();
        const bName = b['Nama Layanan'].toLowerCase();
        if (aName === q && bName !== q) return -1;
        if (bName === q && aName !== q) return 1;
        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;
        return b._waktuJam - a._waktuJam;
    });
};

const selectService = (item, index, id, data) => {
    item.serviceId = id;
    item.searchQuery = data['Nama Layanan'];
    item.showDropdown = false;
    handleServiceChange(item);
    
    setTimeout(() => {
        const qtyEl = document.getElementById(`qty-input-${index}`);
        if (qtyEl) {
            qtyEl.focus();
            qtyEl.select();
            qtyEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, 150);
};

const closeServiceDropdown = (item) => {
    setTimeout(() => { 
        item.showDropdown = false;
        // If they didn't select anything valid, revert search query to the selected item's name or empty
        if (item.serviceId) {
            const isKiloan = item.serviceId.startsWith('K-');
            const realId = item.serviceId.substring(2);
            const s = isKiloan ? kiloanItems.value.find(x => x.ID === realId) : satuanItems.value.find(x => x.ID === realId);
            item.searchQuery = s ? s['Nama Layanan'] : '';
        } else {
            item.searchQuery = '';
        }
    }, 200);
};

const closeNamaDropdown = () => {
    setTimeout(() => { showNamaDropdown.value = false; }, 200);
};

const closeHpDropdown = () => {
    setTimeout(() => { showHpDropdown.value = false; }, 200);
};

const closeModal = () => {
    emit('close');
};

const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
        imageFile.value = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            imagePreview.value = event.target.result;
        };
        reader.readAsDataURL(file);
    }
};

const takePicture = async () => {
    if (Capacitor.isNativePlatform()) {
        try {
            const image = await Camera.getPhoto({
                quality: 60,
                allowEditing: false,
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Prompt
            });
            if (image && image.dataUrl) {
                imagePreview.value = image.dataUrl;
            }
        } catch (e) {
            console.log("Kamera dibatalkan atau error:", e);
        }
    } else {
        const hiddenInput = document.getElementById('hiddenFileInput');
        if (hiddenInput) hiddenInput.click();
    }
};

const saveTransaction = async () => {
    if (!formData.value['Nama Pelanggan'] || !formData.value['No Telpon']) {
        alert('Nama dan No WhatsApp wajib diisi');
        return;
    }
    
    if (formData.value.Pembayaran === 'Potong Kuota' && totalPotonganMember.value <= 0 && formData.value['Total Harga'] > 0) {
        if (!confirm('Tagihan campuran: Kuota tidak mencukupi, sisa tagihan: Rp ' + formatRupiah(formData.value['Total Harga']) + '. Lanjutkan?')) {
            return;
        }
    }
    
    // Validasi layanan
    const validItems = txItems.value.filter(t => t.serviceId && t.qty > 0);
    if (validItems.length === 0 && formData.value['Total Harga'] === 0) {
        alert('Pilih minimal 1 layanan!');
        return;
    }

    isLoading.value = true;
    try {
        let finalHp = formData.value['No Telpon'];
        if (finalHp.startsWith('0')) finalHp = "'" + finalHp;
        
        // Cek Pelanggan Baru
        let cust = customers.value.find(p => p['Nama Pelanggan'] === formData.value['Nama Pelanggan']);
        if (!cust) {
            let maxPlg = 0;
            customers.value.forEach(r => {
                let idStr = String(r.ID || '');
                if (idStr.startsWith('PLG-')) {
                    let num = parseInt(idStr.split('-')[1]);
                    if (!isNaN(num) && num > maxPlg) maxPlg = num;
                }
            });
            let newId = 'PLG-' + String(maxPlg + 1).padStart(4, '0');
            formData.value['ID Pelanggan'] = newId;
            let newCust = {
                'ID': newId,
                'Nama Pelanggan': formData.value['Nama Pelanggan'],
                'No Telpon': formData.value['No Telpon'],
                'Status': 'Umum',
                'Paket Member': '',
                'Sisa Kuota (Kg)': 0
            };
            await store.saveRecord('Pelanggan', newCust);
        }

        // Format Detail Layanan
        const detailLayanan = validItems.map(t => {
            let nama = '';
            let waktuJam = 0;
            if (t.type === 'Kiloan') {
                const s = kiloanItems.value.find(k => k.ID === t.serviceId.substring(2));
                nama = s?.['Nama Layanan'] || '';
                const wObj = store.appData.waktu?.find(x => x.ID === s?.['Jenis Waktu']);
                if (wObj) waktuJam = parseInt(wObj['Waktu (Jam)']) || 0;
            } else {
                const s = satuanItems.value.find(s => s.ID === t.serviceId.substring(2));
                nama = s?.['Nama Layanan'] || '';
                const wObj = store.appData.waktu?.find(x => x.ID === s?.['Jenis Waktu']);
                if (wObj) waktuJam = parseInt(wObj['Waktu (Jam)']) || 0;
            }
            
            let estDate = new Date();
            estDate = new Date(estDate.getTime() + (waktuJam * 60 * 60 * 1000));
            const day = ('0' + estDate.getDate()).slice(-2);
            const month = ('0' + (estDate.getMonth() + 1)).slice(-2);
            const year = estDate.getFullYear();
            const hrs = ('0' + estDate.getHours()).slice(-2);
            const mins = ('0' + estDate.getMinutes()).slice(-2);

            return {
                nama,
                qty: t.qty,
                satuan: t.type === 'Kiloan' ? 'Kg' : 'Pcs',
                harga: t.price,
                subtotal: t.subtotal,
                estimasiSelesai: `${day}/${month}/${year} ${hrs}:${mins}`
            };
        });
        
        let layanans = detailLayanan.map(d => `${d.nama} x ${d.qty}${d.satuan}`).join(' + ');
        
        // Prepare Foto Base64
        let fotoData = formData.value.Foto;
        if (imagePreview.value && imagePreview.value.startsWith('data:image')) {
            fotoData = imagePreview.value; // Store as base64
        }
        
        const payload = {
            ...formData.value,
            'Detail Layanan JSON': JSON.stringify({ items: detailLayanan, subtotal: subtotalAll.value, diskon: formData.value.Diskon, potonganMember: totalPotonganMember.value, kgTerpakai: kgTerpakai.value }),
            Layanan: layanans,
            Foto: fotoData,
            'Kg Terpakai': kgTerpakai.value,
            'Potongan Member': totalPotonganMember.value,
        };
        
        if (isEditMode.value) {
            // Restore Sisa Kuota if previous was Potong Kuota
            const oldTx = props.initialData;
            if (oldTx['Pembayaran'] === 'Potong Kuota' && oldTx['Kg Terpakai']) {
                let c = store.appData.pelanggan.find(p => p['Nama Pelanggan'] === oldTx['Nama Pelanggan']);
                if (c) c['Sisa Kuota (Kg)'] = parseFloat(c['Sisa Kuota (Kg)']) + parseFloat(oldTx['Kg Terpakai']);
            }
            
            await store.updateRecord('Produksi', formData.value.ID, payload);
        } else {
            // Generate Nota and ID
            let maxNum = 0;
            (store.appData.produksi || []).forEach(r => {
                let idStr = String(r.ID || '');
                if(idStr.startsWith('TX-')) {
                    let num = parseInt(idStr.split('-')[1]);
                    if(!isNaN(num) && num > maxNum) maxNum = num;
                }
            });
            payload.ID = 'TX-' + String(maxNum + 1).padStart(4, '0');
            
            let maxNota = 0;
            let dDate = new Date();
            let notaPrefix = `WRL.${('0'+dDate.getDate()).slice(-2)}${('0'+(dDate.getMonth()+1)).slice(-2)}${String(dDate.getFullYear()).slice(-2)}.`;
            (store.appData.produksi || []).forEach(row => {
                if(row['No Nota'] && String(row['No Nota']).startsWith(notaPrefix)) {
                    let parts = String(row['No Nota']).split('.');
                    if (parts.length > 2) {
                        let n = parseInt(parts[2]);
                        if(!isNaN(n) && n > maxNota) maxNota = n;
                    }
                }
            });
            payload['No Nota'] = formData.value['No Nota'] || notaPrefix + String(maxNota + 1).padStart(3, '0');
            payload['Waktu Masuk'] = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(dDate);
            
            await store.saveRecord('Produksi', payload);
        }
        
        // Deduct Sisa Kuota if new is Potong Kuota
        if (payload.Pembayaran === 'Potong Kuota' && payload['Kg Terpakai']) {
            let c = store.appData.pelanggan.find(p => p['Nama Pelanggan'] === payload['Nama Pelanggan']);
            if (c) {
                let sisa = parseFloat(c['Sisa Kuota (Kg)']) - parseFloat(payload['Kg Terpakai']);
                c['Sisa Kuota (Kg)'] = sisa < 0 ? 0 : Math.round(sisa * 100) / 100;
                
                await store.updateRecord('Pelanggan', c.ID, c);
            }
        }
        
        emit('saved', payload);
        closeModal();
    } catch(e) {
        alert('Gagal menyimpan: ' + e.message);
    } finally {
        isLoading.value = false;
    }
};

// Lifecycle / Watchers
watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        if (isEditMode.value) {
            formData.value = { ...props.initialData };
            imagePreview.value = formData.value.Foto || '';
            // Parse Detail Layanan JSON
            try {
                const parsed = JSON.parse(formData.value['Detail Layanan JSON'] || '{}');
                const items = parsed.items || [];
                txItems.value = items.map((t, idx) => {
                    const type = t.satuan === 'Kg' ? 'Kiloan' : 'Satuan';
                    const srvId = (t.satuan === 'Kg' ? 'K-' : 'S-') + (t.satuan === 'Kg' ? kiloanItems.value.find(k => k['Nama Layanan'] === t.nama)?.ID : satuanItems.value.find(s => s['Nama Layanan'] === t.nama)?.ID);
                    return {
                        id: idx + 1,
                        type: type,
                        serviceId: srvId,
                        price: t.harga,
                        qty: t.qty,
                        subtotal: t.subtotal,
                        showDropdown: false,
                        searchQuery: t.nama
                    };
                });
                itemIdCounter = txItems.value.length || 1;
            } catch(e) {
                txItems.value = [{ id: 1, type: '', serviceId: '', price: 0, qty: 1, subtotal: 0, showDropdown: false, searchQuery: '' }];
            }
            calculateTotals();
        } else {
            // Generate Nota automatically
            let maxNota = 0;
            let d = new Date();
            let day = ('0' + d.getDate()).slice(-2);
            let month = ('0' + (d.getMonth() + 1)).slice(-2);
            let year = String(d.getFullYear()).slice(-2);
            let notaPrefix = 'WRL.' + day + month + year + '.';
            (store.appData.produksi || []).forEach(row => {
                if(row['No Nota'] && String(row['No Nota']).startsWith(notaPrefix)) {
                    let parts = String(row['No Nota']).split('.');
                    if (parts.length > 2) {
                        let n = parseInt(parts[2]);
                        if(!isNaN(n) && n > maxNota) maxNota = n;
                    }
                }
            });
            let generatedNota = notaPrefix + String(maxNota + 1).padStart(3, '0');

            // Reset form for Add mode
            formData.value = {
                ID: '', 'No Nota': generatedNota, 'ID Pelanggan': '', 'Nama Pelanggan': '', 'No Telpon': '',
                Status: 'Proses', Pembayaran: 'Belum Lunas', 'Total Harga': 0, Diskon: 0, 'Sisa Bayar': 0, DP: 0,
                'Layanan': '', 'Detail Layanan JSON': '[]', 'Foto': '', 'Waktu Masuk': '', 'Kg Terpakai': 0, 'Potongan Member': 0
            };
            txItems.value = [{ id: 1, type: '', serviceId: '', price: 0, qty: 1, subtotal: 0, showDropdown: false, searchQuery: '' }];
            itemIdCounter = 1;
            selectedCustomer.value = null;
            imagePreview.value = '';
            imageFile.value = null;
        }
        
        setTimeout(() => {
            const namaEl = document.querySelector('.nama-pelanggan-input');
            if (namaEl) {
                namaEl.focus();
                namaEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    }
}, { immediate: true });

</script>

<template>
    <Teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 z-[200] flex items-center justify-center fade-in">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="closeModal"></div>
            
            <!-- Modal Panel -->
            <div class="relative bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden slide-up border border-slate-100">
                <!-- Header -->
                <div class="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-white z-20 shrink-0">
                    <div class="w-full flex justify-between items-center">
                        <h3 class="text-lg font-black text-slate-800 tracking-tight flex items-center">
                            <i class="ph-bold mr-2 text-teal-600" :class="isEditMode ? 'ph-pencil-simple' : 'ph-plus-circle'"></i> 
                            {{ isEditMode ? 'Edit Transaksi' : 'Transaksi Baru' }}
                        </h3>
                        <button type="button" @click="closeModal" class="w-8 h-8 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors">
                            <i class="ph-bold ph-x"></i>
                        </button>
                    </div>
                </div>
                
                <!-- Body Area -->
                <div class="overflow-x-hidden overflow-y-auto flex-1 w-full bg-slate-50 flex flex-col items-center scroll-smooth p-4 sm:p-6" id="form-scroll-area">
                    <div class="w-full max-w-3xl pb-[50vh]">
                        <form @submit.prevent="saveTransaction" class="space-y-4">
                            <!-- Section Pelanggan -->
                            <div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                                <h4 class="text-[0.6875rem] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                                    <i class="ph-bold ph-user mr-2"></i> Info Pelanggan
                                </h4>
                                
                                <div class="mb-4">
                                    <label class="block text-[0.6875rem] font-bold text-slate-600 mb-1.5 uppercase">No Nota</label>
                                    <input type="text" v-model="formData['No Nota']" disabled class="w-full px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-mono font-bold text-sm cursor-not-allowed text-center tracking-widest">
                                </div>
                                
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <!-- Input Nama -->
                                    <div class="relative">
                                        <label class="block text-[0.6875rem] font-bold text-slate-600 mb-1.5 uppercase">Nama Pelanggan <span class="text-red-500">*</span></label>
                                        <input type="text" v-model="formData['Nama Pelanggan']" required @focus="showNamaDropdown = true; scrollToActive($event)" @input="handleCustomerInput('nama')" @blur="closeNamaDropdown" @keydown.tab="handleAutocompleteKeydown($event, 'nama')" @keydown.enter.prevent="handleAutocompleteKeydown($event, 'nama')" placeholder="Ketik nama pelanggan..." class="nama-pelanggan-input w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all text-sm font-bold text-slate-800">
                                        
                                        <!-- Dropdown Nama -->
                                        <div v-if="showNamaDropdown" class="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto overflow-x-hidden">
                                            <div v-for="c in filteredCustomersByName" :key="c.ID" @mousedown.prevent="selectCustomer(c)" class="py-2 px-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50">
                                                <span class="font-bold block text-slate-800 text-[0.8125rem] mb-0.5">{{ c['Nama Pelanggan'] }}</span>
                                                <span class="text-[0.6875rem] font-mono text-slate-400"><i class="ph-fill ph-phone text-teal-500 mr-1"></i> {{ c['No Telpon'] }}</span>
                                            </div>
                                            <div v-if="filteredCustomersByName.length === 0 && formData['Nama Pelanggan']" class="py-2 px-3 text-sm border-b border-slate-50">
                                                Tambah baru: <strong class="text-teal-600">{{ formData['Nama Pelanggan'] }}</strong>
                                            </div>
                                        </div>

                                        <!-- Member Info -->
                                        <div v-if="selectedCustomer && Number(selectedCustomer['Sisa Kuota (Kg)'] || 0) > 0" class="mt-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-xs font-bold flex items-center gap-2 transition-all">
                                            <i class="ph-fill ph-diamonds-four"></i> Member: Sisa Kuota {{ selectedCustomer['Sisa Kuota (Kg)'] }} Kg
                                        </div>
                                    </div>
                                    
                                    <!-- Input No WA -->
                                    <div class="relative">
                                        <label class="block text-[0.6875rem] font-bold text-slate-600 mb-1.5 uppercase">No WhatsApp <span class="text-red-500">*</span></label>
                                        <input type="text" v-model="formData['No Telpon']" required @focus="showHpDropdown = true; scrollToActive($event)" @input="handleCustomerInput('hp')" @blur="closeHpDropdown" @keydown.tab="handleAutocompleteKeydown($event, 'hp')" @keydown.enter.prevent="handleAutocompleteKeydown($event, 'hp')" placeholder="Ketik no HP..." class="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 outline-none transition-all text-sm font-bold text-slate-800 font-mono">
                                        
                                        <!-- Dropdown HP -->
                                        <div v-if="showHpDropdown" class="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto overflow-x-hidden">
                                            <div v-for="c in filteredCustomersByHp" :key="c.ID" @mousedown.prevent="selectCustomer(c)" class="py-2 px-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50">
                                                <span class="font-bold block text-slate-800 text-[0.8125rem] mb-0.5 font-mono">{{ c['No Telpon'] }}</span>
                                                <span class="text-[0.6875rem] font-mono text-slate-400"><i class="ph-fill ph-user text-teal-500 mr-1"></i> {{ c['Nama Pelanggan'] }}</span>
                                            </div>
                                            <div v-if="filteredCustomersByHp.length === 0 && formData['No Telpon']" class="py-2 px-3 text-sm border-b border-slate-50">
                                                Tambah baru: <strong class="text-teal-600 font-mono">{{ formData['No Telpon'] }}</strong>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Section Detail Layanan -->
                            <div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                                <h4 class="text-[0.6875rem] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                                    <i class="ph-bold ph-t-shirt mr-2"></i> Detail Layanan
                                </h4>
                                
                                <div class="space-y-4">
                                    <div v-for="(item, index) in txItems" :key="item.id" class="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative slide-up-fade">
                                        <button v-if="txItems.length > 1" type="button" @click="removeServiceRow(index)" class="absolute -top-2 -right-2 w-7 h-7 bg-white border border-slate-200 text-red-500 rounded-full flex items-center justify-center shadow-sm hover:bg-red-50 z-10 transition-colors">
                                            <i class="ph-bold ph-minus"></i>
                                        </button>
                                        
                                        <div class="mb-3 relative w-full">
                                            <input type="text" v-model="item.searchQuery" 
                                                   @focus="item.showDropdown = true; scrollToActive($event)" 
                                                   @input="item.showDropdown = true"
                                                   @blur="closeServiceDropdown(item)"
                                                   @keydown.tab="handleServiceKeydown($event, item, index)"
                                                   @keydown.enter.prevent="handleServiceKeydown($event, item, index)"
                                                   placeholder="🔍 Cari dan pilih layanan..."
                                                   required
                                                   class="service-input w-full px-4 py-3 rounded-xl bg-white border border-slate-200 outline-none text-sm font-bold text-slate-700 focus:border-teal-400 focus:ring-2 focus:ring-teal-50 transition-all">
                                            
                                            <div v-if="item.showDropdown" class="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto overflow-x-hidden">
                                                <div class="py-1 px-3 text-[0.625rem] font-black tracking-widest text-slate-400 uppercase bg-slate-50 border-b border-slate-100">Layanan Kiloan</div>
                                                <div v-for="k in filteredKiloan(item.searchQuery)" :key="'K-'+k.ID" @mousedown.prevent="selectService(item, index, 'K-'+k.ID, k)" class="py-2 px-3 hover:bg-teal-50 cursor-pointer border-b border-slate-50 transition-colors">
                                                    <span class="font-bold block text-slate-700 text-[1rem] mb-0.5">{{ k['Nama Layanan'] }}</span>
                                                    <span class="text-[0.6875rem] font-bold text-teal-600">Rp {{ formatRupiah(k['Harga/Kg']) }} / Kg</span>
                                                </div>
                                                <div v-if="filteredKiloan(item.searchQuery).length === 0 && item.searchQuery" class="py-2 px-3 text-xs text-slate-400 italic">Tidak ditemukan...</div>
                                                
                                                <div class="py-1 px-3 text-[0.625rem] font-black tracking-widest text-slate-400 uppercase bg-slate-50 border-b border-slate-100 border-t border-t-slate-200 mt-1">Layanan Satuan</div>
                                                <div v-for="s in filteredSatuan(item.searchQuery)" :key="'S-'+s.ID" @mousedown.prevent="selectService(item, index, 'S-'+s.ID, s)" class="py-2 px-3 hover:bg-teal-50 cursor-pointer border-b border-slate-50 transition-colors">
                                                    <span class="font-bold block text-slate-700 text-[1rem] mb-0.5">{{ s['Nama Layanan'] }}</span>
                                                    <span class="text-[0.6875rem] font-bold text-teal-600">Rp {{ formatRupiah(s['Harga/Pcs']) }} / Pcs</span>
                                                </div>
                                                <div v-if="filteredSatuan(item.searchQuery).length === 0 && item.searchQuery" class="py-2 px-3 text-xs text-slate-400 italic">Tidak ditemukan...</div>
                                            </div>
                                        </div>
                                        
                                        <div class="flex gap-3 items-end">
                                            <div class="w-1/3">
                                                <label class="block text-[0.625rem] font-black text-slate-400 mb-1.5 uppercase">{{ item.type === 'Kiloan' ? 'Bobot (Kg)' : 'Qty (Pcs)' }}</label>
                                                <input type="number" step="any" min="0.1" v-model.number="item.qty" @focus="handleQtyFocus($event)" @input="calculateItemSubtotal(item)" @keydown.enter.prevent="focusDiskon()" class="qty-input w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 focus:border-teal-400 outline-none text-sm font-black text-slate-700 text-center" :id="`qty-input-${index}`">
                                            </div>
                                            <div class="w-2/3">
                                                <label class="block text-[0.625rem] font-black text-slate-400 mb-1.5 uppercase text-right">Subtotal</label>
                                                <div class="w-full px-3 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-sm font-black text-slate-800 text-right tracking-tight">
                                                    Rp {{ formatRupiah(item.subtotal) }}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="button" @click="addServiceRow" class="mt-4 w-full bg-gradient-to-r from-teal-50 to-teal-100 hover:from-teal-100 hover:to-teal-200 text-teal-700 font-bold py-3 rounded-xl border border-teal-200 transition-colors flex justify-center items-center text-sm shadow-sm active:scale-95">
                                    <i class="ph-bold ph-plus-circle mr-2 text-lg"></i> Tambah Layanan Lain
                                </button>
                            </div>

                            <!-- Section Pembayaran & Dokumentasi -->
                            <div class="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
                                <h4 class="text-[0.6875rem] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center">
                                    <i class="ph-bold ph-money mr-2"></i> Pembayaran & Dokumentasi
                                </h4>
                                
                                <div class="flex flex-row items-stretch gap-3 sm:gap-4">
                                    <!-- Foto Placeholder -->
                                    <div class="w-[35%] sm:w-1/4 flex-shrink-0 pt-[22px] sm:pt-0">
                                        <label class="block text-[0.6875rem] font-bold text-slate-600 mb-1.5 uppercase opacity-0 hidden sm:block">Foto</label>
                                        <div @click="takePicture" class="relative overflow-hidden w-full h-full min-h-[120px] border-2 border-dashed border-slate-300 rounded-2xl flex items-center justify-center bg-slate-50 group hover:border-slate-400 transition-colors cursor-pointer" title="Ambil Foto Nota / Cucian">
                                            <input type="file" id="hiddenFileInput" accept="image/*" @change="handleFileChange" class="hidden">
                                            
                                            <img v-if="imagePreview" :src="imagePreview" class="absolute inset-0 w-full h-full object-cover z-0">
                                            <div v-if="imagePreview" class="absolute inset-0 bg-slate-900/30 flex items-center justify-center z-0">
                                                <i class="ph-fill ph-check-circle text-white drop-shadow-md text-3xl sm:text-4xl shadow-slate-900"></i>
                                            </div>

                                            <div v-else class="flex flex-col items-center justify-center text-slate-300 group-hover:text-slate-400 transition-colors">
                                                <i class="ph-bold ph-camera text-3xl sm:text-4xl"></i>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="flex-1 flex flex-col gap-3">
                                        <div>
                                            <label class="block text-[0.6875rem] font-bold text-slate-600 mb-1.5 uppercase">Diskon (Rp)</label>
                                            <input type="number" v-model.number="formData.Diskon" @focus="scrollToActive($event)" placeholder="Rp 0" class="diskon-input w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-bold focus:ring-2 focus:ring-teal-300 font-mono text-slate-700">
                                        </div>
                                        <div>
                                            <label class="block text-[0.6875rem] font-bold text-slate-600 mb-1.5 uppercase">Status Pembayaran</label>
                                            <select v-model="formData.Pembayaran" class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-bold focus:ring-2 focus:ring-teal-300 text-slate-700">
                                                <option value="Belum Lunas">Belum Lunas</option>
                                                <option value="Lunas">Lunas</option>
                                                <option value="DP">DP</option>
                                                <option v-if="selectedCustomer && Number(selectedCustomer['Sisa Kuota (Kg)'] || 0) > 0" value="Potong Kuota" class="font-bold text-indigo-600">💎 Potong Kuota (Member)</option>
                                            </select>
                                        </div>
                                        <div v-if="formData.Pembayaran === 'DP'" class="fade-in">
                                            <label class="block text-[0.6875rem] font-bold text-slate-600 mb-1.5 uppercase">Nominal DP</label>
                                            <input type="number" v-model.number="formData.DP" @focus="scrollToActive($event)" placeholder="Rp 0" class="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 outline-none text-sm font-bold focus:ring-2 focus:ring-teal-300 font-mono text-slate-700">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
                
                <!-- Footer (Sticky) -->
                <div class="absolute bottom-0 left-0 w-full bg-white/95 backdrop-blur-md border-t border-slate-200/50 py-3 px-4 sm:px-6 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-30 flex justify-center">
                    <div class="w-full max-w-3xl flex items-center justify-between gap-3">
                        <div class="flex flex-col pl-1">
                            <span class="text-[0.5625rem] font-black text-slate-400 uppercase tracking-wider leading-none mb-0.5">{{ formData.Pembayaran === 'DP' ? 'SISA BAYAR' : 'TOTAL BIAYA' }}</span>
                            <span class="text-lg font-black text-slate-800 tracking-tight leading-none" :class="(formData.Pembayaran === 'Potong Kuota' && formData['Total Harga'] === 0) ? 'text-indigo-600' : ''">
                                <span v-if="formData.Pembayaran === 'Potong Kuota' && totalPotonganMember > 0" class="text-[0.75rem] text-indigo-400 line-through mr-1.5 font-bold tracking-normal block -mb-1">
                                    Rp {{ formatRupiah(subtotalAll - formData.Diskon) }}
                                </span>
                                Rp {{ formatRupiah(formData.Pembayaran === 'DP' ? formData['Sisa Bayar'] : formData['Total Harga']) }}
                            </span>
                        </div>
                        <button type="button" @click="saveTransaction" :disabled="isLoading" class="w-[120px] bg-gradient-to-r from-teal-400 to-teal-500 hover:from-teal-500 hover:to-teal-600 text-white font-bold py-2.5 rounded-xl shadow-sm shadow-teal-500/30 active:scale-95 transition-all flex items-center justify-center text-[0.75rem] disabled:opacity-50">
                            <i v-if="isLoading" class="ph-bold ph-spinner animate-spin mr-1.5 text-base"></i>
                            <i v-else class="ph-bold ph-paper-plane-tilt mr-1.5 text-base"></i> SIMPAN
                        </button>
                    </div>
                </div>

            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.fade-in { animation: fadeIn 0.2s ease-out forwards; }
.slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
</style>
