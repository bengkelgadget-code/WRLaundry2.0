export const appSettings = {
    nama: "WAROENK LAUNDRY",
    alamat: "Jl. Markisa No 52 Rt 05, Tenggarong"
};
import { Capacitor } from '@capacitor/core';
import { BluetoothSerial } from '@e-is/capacitor-bluetooth-serial';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';


export const parseDateDMY = (dateStr) => {
    if (!dateStr) return new Date(9999, 11, 31).getTime();
    var p1 = dateStr.split(' ');
    var pD = p1[0].split('/');
    if (pD.length !== 3) return new Date(9999, 11, 31).getTime();
    var d = new Date(pD[2], pD[1] - 1, pD[0]);
    if (p1[1]) {
        var pT = p1[1].split(':');
        if (pT.length === 2) { d.setHours(parseInt(pT[0]), parseInt(pT[1])); }
    }
    return d.getTime();
};

export const wrapTextCenterRaw = (text, width) => {
    if (!text) return "";
    var words = text.split(' ');
    var lines = [];
    var currentLine = "";
    for (var i = 0; i < words.length; i++) {
        if ((currentLine + words[i]).length <= width) {
            currentLine += (currentLine === "" ? "" : " ") + words[i];
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }
    if (currentLine) lines.push(currentLine);
    var res = "";
    for (var j = 0; j < lines.length; j++) {
        var space = Math.floor((width - lines[j].length) / 2);
        res += " ".repeat(Math.max(0, space)) + lines[j] + "\n";
    }
    return res;
};

export const wrapTextHangingIndentRaw = (text, width, indentSpaces) => {
    if (!text) return "";
    var words = text.split(' ');
    var lines = [];
    var currentLine = "";
    var isFirstLine = true;
    for (var i = 0; i < words.length; i++) {
        var currentWidth = isFirstLine ? width : width - indentSpaces;
        var testLine = currentLine + (currentLine === "" ? "" : " ") + words[i];
        if (testLine.length <= currentWidth) {
            currentLine = testLine;
        } else {
            lines.push(currentLine);
            currentLine = words[i];
            isFirstLine = false;
        }
    }
    if (currentLine) lines.push(currentLine);
    var res = "";
    for (var j = 0; j < lines.length; j++) {
        if (j === 0) {
            res += lines[j] + "\n";
        } else {
            res += " ".repeat(indentSpaces) + lines[j] + "\n";
        }
    }
    return res;
};

export const resolvePelangganName = (px, store) => {
    if (px['Nama Pelanggan']) return px['Nama Pelanggan'];
    if (px['ID Pelanggan'] && store?.appData?.pelanggan) {
        const cust = store.appData.pelanggan.find(p => p.ID === px['ID Pelanggan']);
        if (cust) return cust['Nama Pelanggan'] || cust.nama;
    }
    return '-';
};

export const generateReceiptHTML = (px, store) => {
    if (!px) return '';
    var layananHTML = ''; var items = []; var diskonTx = 0; var potonganMemberTx = 0; var subtotalTx = Number(px['Total Harga'] || 0); var kgTerpakaiTx = parseFloat(px['Kg Terpakai']) || 0;
    var custData = (store.appData.pelanggan || []).find(function (p) { return p && p['Nama Pelanggan'] === px['Nama Pelanggan']; }); var currentSisaKuota = custData ? (parseFloat(custData['Sisa Kuota (Kg)']) || 0) : 0;
    currentSisaKuota = Math.round(currentSisaKuota * 100) / 100;
    if (px['Detail Layanan JSON']) { try { var parsed = JSON.parse(px['Detail Layanan JSON']); if (!Array.isArray(parsed)) { items = parsed.items || []; diskonTx = parsed.diskon || 0; potonganMemberTx = parsed.potonganMember || 0; subtotalTx = parsed.subtotal || subtotalTx; } else { items = parsed; } } catch (e) { } }
    var totalHarga = Number(px['Total Harga'] || 0);
    var pmbStatusVal = px['Pembayaran'] || 'Belum Lunas';
    if (totalHarga === 0 && subtotalTx > 0 && diskonTx === 0) { pmbStatusVal = 'Potong Kuota'; }
    else if (totalHarga === 0 && (pmbStatusVal === 'Potong Kuota' || kgTerpakaiTx > 0)) { pmbStatusVal = 'Potong Kuota'; }
    var isPureMember = (totalHarga === 0 && pmbStatusVal === 'Potong Kuota');
    if (pmbStatusVal === 'Potong Kuota' && kgTerpakaiTx === 0 && items.length > 0) { items.forEach(function (i) { if (i.satuan === 'Kg') kgTerpakaiTx += i.qty; }); }
    var trackingSisaKuota = currentSisaKuota + kgTerpakaiTx;
    var remainingKg = kgTerpakaiTx;

    var allSameDate = true;
    var firstDate = '';

    if (items.length > 0) {
        items.sort(function (a, b) {
            return parseDateDMY(a.estimasiSelesai) - parseDateDMY(b.estimasiSelesai);
        });

        var firstFull = items[0].estimasiSelesai ? String(items[0].estimasiSelesai) : '';
        firstDate = firstFull.split(' ')[0];
        for (var i = 1; i < items.length; i++) {
            var currEst = items[i].estimasiSelesai ? String(items[i].estimasiSelesai) : '';
            if (currEst !== firstFull) { allSameDate = false; break; }
        }

        var arrHtml = [];
        items.forEach(function (item, index) {
            var isCoveredByQuota = false; var kgDeducted = 0;
            if (pmbStatusVal === 'Potong Kuota' && item.satuan === 'Kg' && remainingKg > 0) { isCoveredByQuota = true; kgDeducted = Math.min(item.qty, remainingKg); remainingKg -= kgDeducted; }

            var itemEst = item.estimasiSelesai ? String(item.estimasiSelesai) : '';
            var estHtml = (!allSameDate && itemEst) ? ('<div style="font-size:9px; color:black; font-style: italic; margin-top:2px; margin-left:4px;">&gt; Selesai: ' + itemEst + '</div>') : '';
            var mb = (index < items.length - 1) ? '8px' : '4px';

            if (isCoveredByQuota) {
                arrHtml.push('<div style="margin-bottom:' + mb + ';"><div style="display:flex; justify-content:space-between; font-weight:bold; color:black;"><span>' + item.nama + '</span><span>-</span></div><div style="font-size:10px; color:black;">' + (Math.round(trackingSisaKuota * 100) / 100) + ' Kg - ' + item.qty + ' Kg = ' + (Math.round((trackingSisaKuota - item.qty) * 100) / 100) + ' Kg</div>' + estHtml + '</div>');
                trackingSisaKuota -= item.qty;
            } else {
                arrHtml.push('<div style="margin-bottom:' + mb + ';"><div style="display:flex; justify-content:space-between; font-weight:bold; color:black;"><span>' + item.nama + '</span><span>Rp ' + Number(item.subtotal).toLocaleString('id-ID') + '</span></div><div style="font-size:10px; color:black;">' + item.qty + ' ' + item.satuan + ' x Rp ' + Number(item.subtotal / item.qty).toLocaleString('id-ID') + '</div>' + estHtml + '</div>');
            }
        });
        layananHTML = arrHtml.join('');
        if (allSameDate && firstFull) {
            layananHTML += '<div style="font-size:10px; font-weight:bold; color:black; font-style: italic; margin-top:6px; text-align: left;">Selesai: ' + firstFull + '</div>';
        }
    } else {
        layananHTML = (px['Layanan'] || '').replace(/\+/g, '<br>');
    }

    var dpAmount = Number(px['DP'] || 0); var sisaAmount = Number(px['Sisa Bayar'] !== undefined ? px['Sisa Bayar'] : totalHarga);
    if (pmbStatusVal === 'Lunas' || pmbStatusVal === 'Potong Kuota') { sisaAmount = 0; }

    var paymentHTML = '<table width="100%" style="font-size: 11px; border-collapse: collapse; color: black; margin-top: 8px;">';
    var usedQuota = (pmbStatusVal === 'Potong Kuota' || kgTerpakaiTx > 0);
    if (usedQuota) {
        paymentHTML += '<tr><td style="text-align:left; padding:2px 0;">Sisa Kuota:</td><td style="text-align:right; font-weight:bold; padding:2px 0;">' + currentSisaKuota + ' Kg</td></tr>';
        paymentHTML += '<tr><td style="text-align:left; padding:2px 0;">Status Bayar:</td><td style="text-align:right; font-weight:bold; padding:2px 0;">Potong Kuota</td></tr>';
    }
    if (!isPureMember) {
        if (diskonTx > 0) { paymentHTML += '<tr><td style="text-align:left; padding:2px 0;">DISKON:</td><td style="text-align:right; padding:2px 0;">- Rp ' + diskonTx.toLocaleString('id-ID') + '</td></tr>'; }
        paymentHTML += '<tr><td style="text-align:left; font-weight:900; font-size:13px; padding-top:6px; color:black;">TOTAL:</td><td style="text-align:right; font-weight:900; font-size:13px; padding-top:6px; color:black;">Rp ' + totalHarga.toLocaleString('id-ID') + '</td></tr>';

        var statusTagihan = pmbStatusVal; if (statusTagihan === 'Potong Kuota' && totalHarga > 0) statusTagihan = 'Belum Lunas';
        paymentHTML += '<tr><td style="text-align:left; padding:2px 0; padding-top:4px;">Status Bayar:</td><td style="text-align:right; font-weight:bold; padding:2px 0; padding-top:4px;">' + statusTagihan + '</td></tr>';
        if (statusTagihan === 'DP') {
            paymentHTML += '<tr><td style="text-align:left; padding:2px 0;">DP:</td><td style="text-align:right; padding:2px 0;">Rp ' + dpAmount.toLocaleString('id-ID') + '</td></tr>';
        }
    }
    paymentHTML += '</table>';

    var kasirName = (store.currentUser && store.currentUser['Nama Lengkap']) ? store.currentUser['Nama Lengkap'] : (store.currentUser?.Nama || 'Admin');
    var tglMasuk = (px['Waktu Masuk'] ? String(px['Waktu Masuk']).split(' ')[0] : '-');
    var nameCust = resolvePelangganName(px, store);

    var nameFontSizeNum = nameCust.length > 15 ? 16 : 22;
    var nameFontSize = nameFontSizeNum + 'px';
    var sisaFontSize = (nameFontSizeNum - 2) + 'px';

    var finalHtml = '<style>@import url("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&display=swap");</style>';
    finalHtml += '<div style="font-family: monospace; color: black; font-size: 11px; width: 100%;">';
    finalHtml += '<div style="text-align: center; margin: 18px 0 8px 0; padding-bottom:4px;">';
    finalHtml += '<h2 style="margin:0 0 6px 0; font-size:' + nameFontSize + '; font-weight:900; letter-spacing:1px; color:black; font-family:\'Bricolage Grotesque\', sans-serif;">' + (appSettings.nama.toUpperCase()) + '</h2>';
    finalHtml += '<p style="margin:0; font-size:10px; color:black; line-height:1.3; white-space: normal; word-wrap: break-word; text-align: center;">' + (appSettings.alamat) + '</p>';
    finalHtml += '</div>';
    finalHtml += '<div style="border-top: 1px dashed black; border-bottom: 1px dashed black; height: 2px; margin: 6px 0;"></div>';
    finalHtml += '<table width="100%" style="font-size:11px; color:black; margin-bottom:6px; font-weight:bold;">';
    finalHtml += '<tr><td width="25%">Tgl</td><td width="5%">:</td><td>' + tglMasuk + '</td></tr>';
    finalHtml += '<tr><td>Kasir</td><td>:</td><td>' + kasirName + '</td></tr>';
    finalHtml += '<tr><td>No. Nota</td><td>:</td><td>' + (px['No Nota'] || '-') + '</td></tr>';
    finalHtml += '</table>';
    finalHtml += '<div style="text-align: center; margin: 18px 0 8px 0;">';
    finalHtml += '<h1 style="margin:0; font-size:' + nameFontSize + '; font-weight:900; color:black; line-height:1.1; word-wrap:break-word;">' + nameCust + '</h1>';
    finalHtml += '</div>';
    finalHtml += '<div style="border-bottom: 1px dashed black; margin: 6px 0;"></div>';
    finalHtml += '<div style="font-size:11px; line-height:1.6; color:black;">' + layananHTML + '</div>';
    finalHtml += paymentHTML;

    if (!isPureMember && !usedQuota) {
        finalHtml += '<div style="border-top: 1px dashed black; border-bottom: 1px dashed black; padding: 6px 0; margin: 12px 0; text-align: center;">';
        finalHtml += '<div style="font-size: 11px; font-weight: bold; color: black; margin-bottom: 2px;">SISA BAYAR</div>';
        finalHtml += '<div style="font-size: ' + sisaFontSize + '; font-weight: 900; color: black; font-family:\'Bricolage Grotesque\', sans-serif;">Rp ' + sisaAmount.toLocaleString('id-ID') + '</div>';
        finalHtml += '</div>';
    } else {
        finalHtml += '<div style="border-bottom: 1px dashed black; margin: 12px 0;"></div>';
    }

    finalHtml += '<div style="text-align: left; margin-top: 6px; font-size: 8px; color: black; line-height: 1.3;">';
    finalHtml += '<p style="margin:0; text-align: center; font-weight: bold; padding-bottom: 4px; font-size:9px;">Terima Kasih</p>';
    var pSetting = store?.appData?.pengaturan;
    if (Array.isArray(pSetting)) pSetting = pSetting[0] || {};
    else pSetting = pSetting || {};
    var footerText = pSetting.footerText || '';
    
    if (footerText) {
        var linesF = footerText.split('\n');
        for (var f = 0; f < linesF.length; f++) {
            if (linesF[f].trim() !== '') {
                finalHtml += '<div style="padding-left: 12px; text-indent: -12px; padding-bottom: 2px;">' + linesF[f] + '</div>';
            }
        }
    } else {
        finalHtml += '<div style="padding-left: 12px; text-indent: -12px; padding-bottom: 2px;">1. Pakaian luntur bukan tanggung jawab laundry.</div>';
        finalHtml += '<div style="padding-left: 12px; text-indent: -12px; padding-bottom: 2px;">2. Minimum perhitungan laundry kiloan (1 Kg).</div>';
        finalHtml += '<div style="padding-left: 12px; text-indent: -12px; padding-bottom: 2px;">3. Tidak menerima laundry dalaman.</div>';
        finalHtml += '<div style="padding-left: 12px; text-indent: -12px; padding-bottom: 2px;">4. Cucian tdk diambil 1 bln bukan tanggung jawab kami.</div>';
    }
    finalHtml += '<div style="height: 15px;"></div>';
    finalHtml += '</div>';

    finalHtml += '</div>';

    return finalHtml;
};

export const generateRawTextReceipt = (px, store) => {
    var str = "";
    var ESC = "\x1B"; var GS = "\x1D";
    var init = ESC + "@"; var center = ESC + "a\x01"; var left = ESC + "a\x00";
    var sizeNormal = GS + "!\x00"; var sizeDoubleHeight = GS + "!\x01"; var sizeDouble = GS + "!\x11";
    var fontSmall = ESC + "M\x01"; var fontNormal = ESC + "M\x00";
    var italicOn = ESC + "4\x01"; var italicOff = ESC + "4\x00";

    var splitKV = function (k, v) { var space = Math.max(1, 32 - k.length - String(v).length); return k + " ".repeat(space) + v + "\n"; };

    str += init;
    str += center;

    var nameCust = resolvePelangganName(px, store);

    if (nameCust.length > 15) {
        str += sizeDoubleHeight + appSettings.nama.toUpperCase() + "\n";
    } else {
        str += sizeDouble + appSettings.nama.toUpperCase() + "\n";
    }

    str += sizeNormal + wrapTextCenterRaw(appSettings.alamat, 32) + "\n";
    str += left + "-".repeat(32) + "\n";

    var tglMasuk = px['Waktu Masuk'] ? String(px['Waktu Masuk']).split(' ')[0] : '-';
    var kasirName = (store.currentUser && store.currentUser['Nama Lengkap']) ? store.currentUser['Nama Lengkap'] : (store.currentUser?.Nama || 'Admin');

    str += "Tgl  : " + tglMasuk + "\n";
    str += "Kasir: " + kasirName + "\n";
    str += "Nota : " + (px['No Nota'] || px['ID']) + "\n";
    str += "-".repeat(32) + "\n";

    str += center;
    if (nameCust.length > 15) { str += sizeDoubleHeight + nameCust + "\n"; }
    else { str += sizeDouble + nameCust + "\n"; }

    str += sizeNormal + left + "-".repeat(32) + "\n";

    var totalHarga = Number(px['Total Harga'] || 0);
    var pmbStatusVal = px['Pembayaran'] || 'Belum Lunas';
    var items = []; var subtotalTx = totalHarga; var diskonTx = 0; var kgTerpakaiTx = parseFloat(px['Kg Terpakai']) || 0;
    var custData = (store.appData.pelanggan || []).find(function (p) { return p && p['Nama Pelanggan'] === px['Nama Pelanggan']; }); var currentSisaKuota = custData ? (parseFloat(custData['Sisa Kuota (Kg)']) || 0) : 0;

    if (px['Detail Layanan JSON']) { try { var parsed = JSON.parse(px['Detail Layanan JSON']); if (!Array.isArray(parsed)) { items = parsed.items || []; diskonTx = parsed.diskon || 0; subtotalTx = parsed.subtotal || subtotalTx; } else { items = parsed; } } catch (e) { } }

    if (totalHarga === 0 && subtotalTx > 0 && diskonTx === 0) { pmbStatusVal = 'Potong Kuota'; }
    else if (totalHarga === 0 && (pmbStatusVal === 'Potong Kuota' || kgTerpakaiTx > 0)) { pmbStatusVal = 'Potong Kuota'; }
    var isPureMember = (totalHarga === 0 && pmbStatusVal === 'Potong Kuota');
    if (pmbStatusVal === 'Potong Kuota' && kgTerpakaiTx === 0 && items.length > 0) { items.forEach(function (i) { if (i.satuan === 'Kg') kgTerpakaiTx += i.qty; }); }

    var remainingKg = kgTerpakaiTx; var trackingSisaKuota = currentSisaKuota + kgTerpakaiTx;
    var allSameDate = true; var firstDate = '';

    if (items.length > 0) {
        items.sort(function (a, b) { return parseDateDMY(a.estimasiSelesai) - parseDateDMY(b.estimasiSelesai); });
        var firstFull = items[0].estimasiSelesai ? String(items[0].estimasiSelesai) : '';
        firstDate = firstFull.split(' ')[0];
        for (var i = 1; i < items.length; i++) { var currEst = items[i].estimasiSelesai ? String(items[i].estimasiSelesai) : ''; if (currEst !== firstFull) { allSameDate = false; break; } }

        items.forEach(function (item) {
            var isCoveredByQuota = false; var kgDeducted = 0;
            if (pmbStatusVal === 'Potong Kuota' && item.satuan === 'Kg' && remainingKg > 0) { isCoveredByQuota = true; kgDeducted = Math.min(item.qty, remainingKg); remainingKg -= kgDeducted; }
            var itemEst = item.estimasiSelesai ? String(item.estimasiSelesai) : '';
            var estHtml = (!allSameDate && itemEst) ? (italicOn + '  Selesai: ' + itemEst + italicOff + '\n') : '';

            if (isCoveredByQuota) {
                str += item.nama + "\n";
                str += (Math.round(trackingSisaKuota * 100) / 100) + " Kg - " + item.qty + " Kg = " + (Math.round((trackingSisaKuota - item.qty) * 100) / 100) + " Kg\n";
                str += estHtml;
                trackingSisaKuota -= item.qty;
            } else {
                str += splitKV(item.nama, "Rp " + Number(item.subtotal).toLocaleString('id-ID'));
                str += item.qty + " " + item.satuan + " x Rp " + Number(item.subtotal / item.qty).toLocaleString('id-ID') + "\n";
                str += estHtml;
            }
        });
        if (allSameDate && firstFull) { str += italicOn + "Selesai: " + firstFull + italicOff + "\n"; }
    } else {
        str += (px['Layanan'] || '').replace(/\+/g, '\n') + "\n";
    }

    str += "-".repeat(32) + "\n";

    var dpAmount = Number(px['DP'] || 0); var sisaAmount = Number(px['Sisa Bayar'] !== undefined ? px['Sisa Bayar'] : totalHarga);
    if (pmbStatusVal === 'Lunas' || pmbStatusVal === 'Potong Kuota') { sisaAmount = 0; }

    var usedQuota = (pmbStatusVal === 'Potong Kuota' || kgTerpakaiTx > 0);
    if (usedQuota) {
        str += splitKV("Sisa Kuota:", currentSisaKuota + " Kg");
        str += splitKV("Status Bayar:", "Potong Kuota");
    }
    if (!isPureMember) {
        if (diskonTx > 0) str += splitKV("DISKON:", "- Rp " + diskonTx.toLocaleString('id-ID'));
        str += sizeDoubleHeight + splitKV("TOTAL:", "Rp " + totalHarga.toLocaleString('id-ID')) + sizeNormal;

        var statusTagihan = pmbStatusVal; if (statusTagihan === 'Potong Kuota' && totalHarga > 0) statusTagihan = 'Belum Lunas';
        str += splitKV("Status Bayar:", statusTagihan);
        if (statusTagihan === 'DP') { str += splitKV("DP:", "Rp " + dpAmount.toLocaleString('id-ID')); }
    }

    if (!isPureMember && !usedQuota) {
        str += "-".repeat(32) + "\n";
        str += "SISA BAYAR:\n";
        if (nameCust.length > 15) { str += sizeDoubleHeight + "Rp " + sisaAmount.toLocaleString('id-ID') + sizeNormal + "\n"; }
        else { str += sizeDouble + "Rp " + sisaAmount.toLocaleString('id-ID') + sizeNormal + "\n"; }
        str += "-".repeat(32) + "\n";
    } else {
        str += "-".repeat(32) + "\n";
    }

    str += center + "\nTerima Kasih\n";
    str += fontSmall;
    str += left;
    var pSetting2 = store?.appData?.pengaturan;
    if (Array.isArray(pSetting2)) pSetting2 = pSetting2[0] || {};
    else pSetting2 = pSetting2 || {};
    var footerText2 = pSetting2.footerText || '';
    
    if (footerText2) {
        var linesF2 = footerText2.split('\n');
        for (var f2 = 0; f2 < linesF2.length; f2++) {
            if (linesF2[f2].trim() !== '') {
                str += wrapTextHangingIndentRaw(linesF2[f2], 32, 3);
            }
        }
    } else {
        str += wrapTextHangingIndentRaw("1. Pakaian luntur bkn tgg jawab kami.", 32, 3);
        str += wrapTextHangingIndentRaw("2. Min perhitungan kiloan (1 Kg).", 32, 3);
        str += wrapTextHangingIndentRaw("3. Tdk menerima laundry dalaman.", 32, 3);
        str += wrapTextHangingIndentRaw("4. Cucian tdk diambil 1 bln bkn tgg jawab kami.", 32, 3);
    }
    str += fontNormal;
    str += "\n\n\n";

    return str;
};

export const actionSendWA = (tx, store) => {
    var custName = resolvePelangganName(tx, store);
    var cust = (store.appData.pelanggan || []).find(function (p) { return p && (p['Nama Pelanggan'] === tx['Nama Pelanggan'] || p.ID === tx['ID Pelanggan']); });
    if (!cust) cust = { 'Nama Pelanggan': custName, 'No Telpon': tx['No Telpon'] || '' };
    var phone = cust['No Telpon'] || '';
    if (!phone) { alert("Nomor HP Pelanggan tidak ada!"); return; }

    phone = phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

    var txt = '';
    var currentStatus = tx['Status'] || 'Proses';
    var currentPmb = tx['Pembayaran'] || 'Belum Lunas';

    var totalHarga = Number(tx['Total Harga'] || 0);
    var sisaBayar = Number(tx['Sisa Bayar'] !== undefined ? tx['Sisa Bayar'] : totalHarga);
    if (currentPmb === 'Lunas' || currentPmb === 'Potong Kuota') sisaBayar = 0;

    var dp = Number(tx['DP'] || 0);
    var noNota = tx['No Nota'] || tx['ID'];
    var tglMasuk = tx['Waktu Masuk'] ? String(tx['Waktu Masuk']).split(' ')[0] : '-';

    if (currentStatus === 'Selesai') {
        txt = 'Hai Kak ' + custName.toUpperCase() + ' laundry anda sudah selesai,\n';
        txt += 'siap untuk diambil\n';
        txt += 'silahkan datang kelaundry kami. Terimakasi\n\n';
        txt += '-------------------------------------\n';
        txt += 'NO. Nota     : ' + noNota + '\n';
        txt += 'Status Bayar : ' + currentPmb + '\n';
        txt += 'Sisa tagihan : Rp. ' + sisaBayar.toLocaleString('id-ID') + '\n';

    } else {
        var items = [];
        var diskonTx = 0;
        var subtotalTx = totalHarga;
        var kgTerpakai = parseFloat(tx['Kg Terpakai']) || 0;

        try {
            var parsed = JSON.parse(tx['Detail Layanan JSON'] || '{}');
            items = Array.isArray(parsed) ? parsed : (parsed.items || []);
            diskonTx = parsed.diskon || 0;
            subtotalTx = parsed.subtotal || totalHarga;
        } catch (e) { }

        txt = 'Halo Kak *' + custName + '* 👋\n\n';
        txt += 'Terima kasih telah mempercayakan cuciannya di *' + appSettings.nama + '* 🙏\n\n';

        txt += '📄 *DETAIL TRANSAKSI*\n';
        txt += 'No Nota: *' + noNota + '*\n';
        txt += 'Tgl Masuk: *' + tglMasuk + '*\n\n';

        txt += '🧺 *RINCIAN LAYANAN*\n';

        var allSameDate = true; var firstDate = items.length > 0 ? (items[0].estimasiSelesai ? String(items[0].estimasiSelesai).split(' - ')[0].split(' ')[0] : '') : '';
        for (var i = 1; i < items.length; i++) { var currEst = items[i].estimasiSelesai ? String(items[i].estimasiSelesai).split(' - ')[0].split(' ')[0] : ''; if (currEst !== firstDate) { allSameDate = false; break; } }

        if (allSameDate && firstDate) {
            txt += 'Estimasi Selesai: *' + firstDate + '*\n\n';
        }

        if (items.length > 0) {
            items.forEach(function (item) {
                var itemEst = item.estimasiSelesai ? String(item.estimasiSelesai).split(' - ')[0].split(' ')[0] : '';
                var estStr = (!allSameDate && itemEst) ? '\n  Selesai: _' + itemEst + '_' : '';

                if (currentPmb === 'Potong Kuota' && item.satuan === 'Kg') {
                    txt += '- ' + item.nama + ' (' + item.qty + ' ' + item.satuan + ')' + estStr + '\n\n';
                } else {
                    txt += '- ' + item.nama + ' (' + item.qty + ' ' + item.satuan + ' x ' + Number(item.subtotal / item.qty).toLocaleString('id-ID') + ') = Rp ' + Number(item.subtotal).toLocaleString('id-ID') + estStr + '\n\n';
                }
            });
        } else {
            txt += '- ' + (tx['Layanan'] || '').replace(/\+/g, '\n\n- ') + '\n\n';
        }

        txt += '======================\n';
        if (currentPmb !== 'Potong Kuota' || totalHarga > 0) {
            if (items.length > 0) txt += 'Subtotal: Rp ' + Number(subtotalTx).toLocaleString('id-ID') + '\n';
            if (diskonTx > 0) txt += 'Diskon: - Rp ' + diskonTx.toLocaleString('id-ID') + '\n';
            txt += '*Total Harga: Rp ' + totalHarga.toLocaleString('id-ID') + '*\n';
        } else {
            txt += '*Pemotongan Kuota Member: ' + kgTerpakai + ' Kg*\n';
        }
        txt += '======================\n\n';

        txt += '💰 *STATUS PEMBAYARAN*\n';
        txt += 'Status: *' + currentPmb + '*\n';
        if (currentPmb === 'DP') {
            txt += 'DP: Rp ' + dp.toLocaleString('id-ID') + '\n';
            txt += 'Sisa Tagihan: *Rp ' + sisaBayar.toLocaleString('id-ID') + '*\n';
        } else if (currentPmb === 'Belum Lunas' && totalHarga > 0) {
            txt += 'Sisa Tagihan: *Rp ' + sisaBayar.toLocaleString('id-ID') + '*\n';
        }

        txt += '\n⚙️ *Status Cucian:* _' + currentStatus + '_\n\n';
        txt += '_Kami akan mengabari kakak kembali jika cucian sudah selesai. Terima kasih!_ ✨';
    }

    var url = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(txt);
    window.open(url, '_blank');
};

export const actionPrintReceipt = async (tx, store) => {
    if (!tx) { alert("Data struk tidak ditemukan"); return; }
    if (Capacitor.isNativePlatform()) {
        try {
            if (!store.connectedPrinter || !store.connectedPrinter.address) {
                alert("Printer tidak valid atau koneksi kadaluarsa. Silakan HAPUS printer lama di menu Pengaturan/Atas lalu KONEKSIKAN ULANG printer Anda.");
                return;
            }
            var strRaw = generateRawTextReceipt(tx, store);
            await BluetoothSerial.write({ 
                address: store.connectedPrinter.address, 
                value: strRaw 
            });
            alert("Nota berhasil dicetak!");
            return;
        } catch (e) {
            console.error("Capacitor Bluetooth Error:", e);
            alert("Gagal mencetak: " + (e.message || 'Printer disconnect'));
            return;
        }
    }

    var isWebBluetoothSupported = (navigator.bluetooth && window.isSecureContext);

    if (isWebBluetoothSupported) {
        try {
            var btDevice = window.zettConnectedPrinter;
            if (!btDevice) {
                btDevice = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
                });
                window.zettConnectedPrinter = btDevice;
            }

            var server;
            try {
                server = await btDevice.gatt.connect();
            } catch (connErr) {
                console.log("Auto-reconnect gagal, meminta ulang device...", connErr);
                btDevice = await navigator.bluetooth.requestDevice({
                    acceptAllDevices: true,
                    optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
                });
                window.zettConnectedPrinter = btDevice;
                server = await btDevice.gatt.connect();
            }

            var service = null; var characteristic = null;
            var serviceUuids = ['000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'];
            var charUuids = ['00002af1-0000-1000-8000-00805f9b34fb', 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'];

            for (var i = 0; i < serviceUuids.length; i++) { try { service = await server.getPrimaryService(serviceUuids[i]); if (service) break; } catch (e) { } }
            if (!service) throw new Error("Service Bluetooth Printer tidak cocok.");

            for (var j = 0; j < charUuids.length; j++) { try { characteristic = await service.getCharacteristic(charUuids[j]); if (characteristic) break; } catch (e) { } }
            if (!characteristic) throw new Error("Karakteristik Bluetooth Printer tidak cocok.");

            var str = generateRawTextReceipt(tx, store);
            var encoder = new TextEncoder();
            var bytes = encoder.encode(str);

            var chunkSize = 20;
            for (var k = 0; k < bytes.length; k += chunkSize) {
                await characteristic.writeValue(bytes.slice(k, k + chunkSize));
            }

            alert("Nota berhasil dicetak langsung ke Mesin!");
            setTimeout(function () { btDevice.gatt.disconnect(); }, 2000);
            return;
        } catch (e) {
            console.error("Web Bluetooth Error:", e);
            window.zettConnectedPrinter = null;
            if (e.name !== 'NotFoundError' && e.name !== 'NotSupportedError') {
                alert("Gagal Terhubung: " + e.message);
            }
        }
    }

    // Fallback to system print
    const printArea = document.getElementById('print-area-hidden') || (function () {
        let div = document.createElement('div');
        div.id = 'print-area-hidden';
        div.className = 'print-area'; // Should have media query logic for print
        document.body.appendChild(div);

        let style = document.createElement('style');
        style.innerHTML = `
            @media print {
                body * { visibility: hidden; }
                #print-area-hidden, #print-area-hidden * { visibility: visible; }
                #print-area-hidden { position: absolute; left: 0; top: 0; width: 58mm; padding: 0; margin: 0; }
            }
        `;
        document.head.appendChild(style);
        return div;
    })();

    printArea.innerHTML = generateReceiptHTML(tx, store);
    setTimeout(function () {
        window.print();
    }, 800);
};

export const actionShareJPG = async (tx, store) => {
    try {
        const div = document.createElement('div');
        div.innerHTML = generateReceiptHTML(tx, store);
        div.style.position = 'absolute';
        div.style.left = '-9999px';
        div.style.top = '-9999px';
        div.style.width = '58mm';
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        document.body.appendChild(div);

        const canvas = await html2canvas(div, { scale: 2 });
        document.body.removeChild(div);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const fileName = `Nota-${tx['No Nota'] || tx.ID}.jpg`;

        if (Capacitor.isNativePlatform()) {
            const base64Data = dataUrl.split(',')[1];
            const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache
            });
            await Share.share({
                title: 'Share Nota JPG',
                text: `Nota transaksi ${tx['No Nota'] || tx.ID}`,
                url: savedFile.uri,
                dialogTitle: 'Bagikan Nota'
            });
        } else {
            const link = document.createElement('a');
            link.download = fileName;
            link.href = dataUrl;
            link.click();
        }
    } catch (e) {
        console.error(e);
        alert('Gagal membagikan JPG: ' + e.message);
    }
};

export const actionSharePDF = async (tx, store) => {
    try {
        const div = document.createElement('div');
        div.innerHTML = generateReceiptHTML(tx, store);
        div.style.position = 'absolute';
        div.style.left = '-9999px';
        div.style.top = '-9999px';
        div.style.width = '58mm';
        div.style.backgroundColor = 'white';
        div.style.padding = '10px';
        document.body.appendChild(div);

        const canvas = await html2canvas(div, { scale: 2 });
        document.body.removeChild(div);

        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [58, canvas.height * (58 / canvas.width)]
        });
        pdf.addImage(imgData, 'JPEG', 0, 0, 58, canvas.height * (58 / canvas.width));
        
        const fileName = `Nota-${tx['No Nota'] || tx.ID}.pdf`;

        if (Capacitor.isNativePlatform()) {
            const base64Data = pdf.output('datauristring').split(',')[1];
            const savedFile = await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache
            });
            await Share.share({
                title: 'Share Nota PDF',
                text: `Nota transaksi ${tx['No Nota'] || tx.ID}`,
                url: savedFile.uri,
                dialogTitle: 'Bagikan Nota'
            });
        } else {
            pdf.save(fileName);
        }
    } catch (e) {
        console.error(e);
        alert('Gagal membagikan PDF: ' + e.message);
    }
};
