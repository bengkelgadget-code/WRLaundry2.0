import { defineStore } from 'pinia';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, onValue } from 'firebase/database';

const GAS_URL = "https://script.google.com/macros/s/AKfycbw4LsV2mB_x517QfNxQtA4AQmdYzyaUNPp0KCcC1F-_o-0wJtUaKYvdlqKmZcWBKq4Cyw/exec";

const firebaseConfig = {
    apiKey: "AIzaSyBbTTYAroluZ3UYMPgnoxLYn1aqPFq9Wik",
    authDomain: "kasirwaroeng-laundry.firebaseapp.com",
    projectId: "kasirwaroeng-laundry",
    storageBucket: "kasirwaroeng-laundry.firebasestorage.app",
    messagingSenderId: "496085821478",
    appId: "1:496085821478:web:420e0e871de41ccf409ee7",
    measurementId: "G-832ZC51E2V",
    databaseURL: "https://kasirwaroeng-laundry-default-rtdb.asia-southeast1.firebasedatabase.app/" 
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

export const useAppStore = defineStore('appData', {
  state: () => ({
    appData: {
      produksi: [],
      pelanggan: [],
      waktu: [],
      kiloan: [],
      satuan: [],
      pewangi: [],
      member: [],
      users: [],
      pengaturan: {}
    },
    appConfig: {},
    isLoading: true,
    currentUser: null, // For auth
    connectedPrinter: null, // For bluetooth printer {name, address}
    isBluetoothModalOpen: false,
  }),
  actions: {
    initBluetooth() {
        const savedPrinter = localStorage.getItem('waroenk_printer');
        if (savedPrinter) {
            try {
                const parsed = JSON.parse(savedPrinter);
                if (parsed && parsed.address) {
                    this.connectedPrinter = parsed;
                } else {
                    localStorage.removeItem('waroenk_printer');
                }
            } catch (e) {
                console.error('Gagal memuat printer tersimpan', e);
            }
        }
    },
    setPrinter(printer) {
        this.connectedPrinter = printer;
        if (printer) {
            localStorage.setItem('waroenk_printer', JSON.stringify(printer));
        } else {
            localStorage.removeItem('waroenk_printer');
        }
    },
    sanitizeFbKeys(data) {
        if (!data) return data;
        return JSON.parse(JSON.stringify(data).replace(/"Harga\/Kg":/g, '"Harga_Kg":').replace(/"Harga\/Pcs":/g, '"Harga_Pcs":'));
    },
    restoreFbKeys(data) {
        if (!data) return data;
        return JSON.parse(JSON.stringify(data).replace(/"Harga_Kg":/g, '"Harga/Kg":').replace(/"Harga_Pcs":/g, '"Harga/Pcs":'));
    },
    sortDataByIdDesc(arr) {
        if (!arr || !Array.isArray(arr)) return arr;
        return [...arr].sort(function(a, b) {
            let idA = parseInt(String(a['ID'] || '').replace(/[^0-9]/g, '')) || 0;
            let idB = parseInt(String(b['ID'] || '').replace(/[^0-9]/g, '')) || 0;
            return idB - idA;
        });
    },
    async fetchInitialData() {
        this.isLoading = true;
        try {
            // First try Firebase for instant data
            const snapshot = await get(ref(database, 'appData'));
            if (snapshot.exists() && snapshot.val().produksi) {
                console.log("⚡ Memuat dari Firebase Instan");
                let restored = this.restoreFbKeys(snapshot.val());
                
                ['produksi', 'pelanggan', 'waktu', 'kiloan', 'satuan', 'pewangi', 'member', 'users'].forEach((k) => {
                    if (restored[k]) {
                        if (!Array.isArray(restored[k])) restored[k] = Object.values(restored[k]);
                        restored[k] = this.sortDataByIdDesc(restored[k]);
                    }
                });
                
                this.appData = restored;
                this.isLoading = false;
                
                // Set up real-time listener
                this.setupRealtimeListener();

                // Background sync from GAS to make sure nothing was missed
                this.backgroundSyncGasToFirebase();
            } else {
                console.log("Memuat dari GAS (Firebase Kosong)");
                await this.fetchFromGas();
                this.setupRealtimeListener();
            }
        } catch (error) {
            console.error("Firebase error, fallback to GAS", error);
            await this.fetchFromGas();
        }
    },
    setupRealtimeListener() {
        onValue(ref(database, 'appData'), (snapshot) => {
            if (snapshot.exists()) {
                let restored = this.restoreFbKeys(snapshot.val());
                ['produksi', 'pelanggan', 'waktu', 'kiloan', 'satuan', 'pewangi', 'member', 'users'].forEach((k) => {
                    if (restored[k]) {
                        if (!Array.isArray(restored[k])) restored[k] = Object.values(restored[k]);
                        restored[k] = this.sortDataByIdDesc(restored[k]);
                    }
                });
                this.appData = restored;
            }
        });
    },
    async updateSettings(settings) {
        try {
            await set(ref(database, 'appData/pengaturan'), settings);
            this.appData.pengaturan = settings;
        } catch (error) {
            console.error("Failed to update settings in Firebase", error);
            throw error;
        }
    },
    async fetchFromGas() {
        try {
            const res = await fetch(GAS_URL + "?action=getInitialData");
            const data = await res.json();
            if (data && data.success) {
                this.appData = data.data;
                this.isLoading = false;
                await set(ref(database, 'appData'), this.sanitizeFbKeys(this.appData));
            }
        } catch (error) {
            console.error("Gagal load dari GAS", error);
            this.isLoading = false;
        }
    },
    backgroundSyncGasToFirebase() {
        setTimeout(async () => {
            try {
                const res = await fetch(GAS_URL + "?action=getInitialData");
                const data = await res.json();
                if (data && data.success) {
                    // In a full implementation, you'd merge data here,
                    // but since Firebase is the source of truth, 
                    // we'll only update if Firebase is somehow out of sync or missing data.
                    console.log("Background sync dari GAS sukses");
                    // Actually, the original script does a mergeProduksiData here.
                    // Let's implement mergeProduksiData briefly.
                    this.mergeProduksiData(data.data.produksi);
                }
            } catch (error) {
                console.warn("Background sync terganggu.", error);
            }
        }, 3000);
    },
    mergeProduksiData(newData) {
        if (!newData || !Array.isArray(newData)) return;
        let validNewData = newData.filter(row => row && row.ID);
        let merged = (this.appData.produksi || []).filter(row => row && row.ID).slice();
        
        validNewData.forEach(newRow => {
            let existIdx = merged.findIndex(x => String(x.ID) === String(newRow.ID));
            if (existIdx >= 0) {
                let oldRow = merged[existIdx];
                if (oldRow['Foto'] && String(oldRow['Foto']).startsWith('data:') && (!newRow['Foto'] || !String(newRow['Foto']).startsWith('http'))) {
                    newRow['Foto'] = oldRow['Foto'];
                }
                merged[existIdx] = newRow;
            } else {
                merged.push(newRow);
            }
        });
        this.appData.produksi = this.sortDataByIdDesc(merged);
        set(ref(database, 'appData'), this.sanitizeFbKeys(this.appData));
    },
    async saveRecord(sheet, dataObj) {
        let key = sheet.toLowerCase().replace('layanan', '');
        if (!this.appData[key]) this.appData[key] = [];
        
        let prefixMap = { 'Pelanggan': 'PLG', 'LayananWaktu': 'LWT', 'LayananKiloan': 'LKL', 'LayananSatuan': 'LST', 'LayananPewangi': 'LPW', 'LayananMember': 'LMB', 'Users': 'USR' };
        let prefix = prefixMap[sheet] || sheet.substring(0, 3).toUpperCase();
        
        // Ensure ID is set for non-produksi
        if (sheet !== 'Produksi' && !dataObj['ID']) {
            let maxNum = 0;
            this.appData[key].forEach(r => {
                if (!r) return;
                let idStr = String(r.ID || '');
                if (idStr.startsWith(prefix + '-')) {
                    let num = parseInt(idStr.split('-')[1]);
                    if (!isNaN(num) && num > maxNum) maxNum = num;
                }
            });
            dataObj['ID'] = prefix + '-' + String(maxNum + 1).padStart(4, '0');
        }
        
        this.appData[key].push(dataObj);
        this.appData[key] = this.sortDataByIdDesc(this.appData[key]); 
        
        await set(ref(database, 'appData'), this.sanitizeFbKeys(this.appData));
        
        fetch(GAS_URL, { 
            method: 'POST', 
            redirect: 'follow', 
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({ action: 'saveRecord', payload: {sheetName: sheet, data: dataObj} }) 
        }).catch(e => console.warn("GAS sync failed", e));
        
        return dataObj;
    },
    async updateRecord(sheet, id, dataObj) {
        let key = sheet.toLowerCase().replace('layanan', '');
        if (!this.appData[key]) return false;
        
        let idx = this.appData[key].findIndex(r => r.ID === id);
        if (idx !== -1) {
            this.appData[key][idx] = { ...this.appData[key][idx], ...dataObj, ID: id };
            this.appData[key] = this.sortDataByIdDesc(this.appData[key]);
            
            await set(ref(database, 'appData'), this.sanitizeFbKeys(this.appData));
            
            fetch(GAS_URL, { 
                method: 'POST', 
                redirect: 'follow', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify({ action: 'updateRecord', payload: {sheetName: sheet, id: id, data: dataObj} }) 
            }).catch(e => console.warn("GAS sync failed", e));
            return true;
        }
        return false;
    },
    async deleteRecord(sheet, id) {
        let key = sheet.toLowerCase().replace('layanan', '');
        if (!this.appData[key]) return false;
        
        let idx = this.appData[key].findIndex(r => r.ID === id);
        if (idx !== -1) {
            this.appData[key].splice(idx, 1);
            
            await set(ref(database, 'appData'), this.sanitizeFbKeys(this.appData));
            
            fetch(GAS_URL, { 
                method: 'POST', 
                redirect: 'follow', 
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify({ action: 'deleteRecord', payload: {sheetName: sheet, id: id} }) 
            }).catch(e => console.warn("GAS sync failed", e));
            return true;
        }
        return false;
    }
  }
});
