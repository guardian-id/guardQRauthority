// GANTI DENGAN URL HTTP TRIGGER DARI POWER AUTOMATE KEDUA ANDA
const POWER_AUTOMATE_VERIFY_URL = "https://default9ec0d6c58a25418fb3841c77c55584.c2.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/01a09216cd654387bdff550c9dea3dfb/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=YGW3DRKHlVHqxSlocw6tvDinaRmugAIywt_EHnicG-c";

// Set durasi countdown menjadi 30 detik
const COUNTDOWN_DURATION = 30 * 1000; 

document.addEventListener("DOMContentLoaded", () => {
    // Elemen DOM Kontrol Halaman
    const authSection = document.getElementById("auth-section");
    const qrSection = document.getElementById("qr-section");
    const authInputs = document.querySelectorAll(".auth-input");
    const btnVerify = document.getElementById("btnVerify");
    
    // Elemen DOM QR & Timer
    const qrcodeElement = document.getElementById("qrcode");
    const countdownElement = document.getElementById("countdown");
    const timerBox = document.querySelector(".timer-box");
    const statusMsg = document.getElementById("statusMsg");

    let timerInterval = null; 

    // Fokus otomatis & Navigasi Antar Kotak Input (6 Kotak)
    authInputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            if (e.target.value.length === 1 && index < authInputs.length - 1) {
                authInputs[index + 1].focus();
            }
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !e.target.value && index > 0) {
                authInputs[index - 1].focus();
            }
        });
    });

    // Cek sesi aktif di localStorage saat pertama kali dimuat
    checkActiveSession();

    // Event saat tombol verifikasi diklik
    btnVerify.addEventListener("click", async () => {
        let userCodeInput = "";
        authInputs.forEach(input => userCodeInput += input.value);

        if (userCodeInput.length !== 6) {
            showStatusMessage("Silakan isi 6 digit kode verifikasi dengan lengkap!");
            return;
        }

        btnVerify.disabled = true;
        btnVerify.innerText = "Memverifikasi...";
        statusMsg.style.display = "none";

        const payload = { inputCode: userCodeInput };

        try {
            const response = await fetch(POWER_AUTOMATE_VERIFY_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json(); 
                console.log("Data diterima dari Server:", data);

                let extractedPin = null;

                // Logika Adaptif Membaca Response JSON
                if (data && data.pin) {
                    extractedPin = data.pin;
                } else if (data && data.body && data.body.pin) {
                    extractedPin = data.body.pin;
                }

                if (extractedPin) {
                    localStorage.setItem("active_pin", extractedPin);
                    localStorage.setItem("verified_code", userCodeInput);

                    authSection.style.display = "none";
                    qrSection.style.display = "block";

                    startQrAndTimer(extractedPin, userCodeInput);
                } else {
                    throw new Error("Format JSON tidak sesuai. Data: " + JSON.stringify(data));
                }
            } else {
                const errorText = await response.text();
                throw new Error(errorText || "Kode verifikasi salah atau sudah kedaluwarsa!");
            }

        } catch (error) {
            console.error("Verification Error:", error);
            showStatusMessage(error.message);
            btnVerify.disabled = false;
            btnVerify.innerText = "Tampilkan QR";
        }
    });

    function checkActiveSession() {
        const verifiedCode = localStorage.getItem("verified_code");
        const activePin = localStorage.getItem("active_pin");
        const startTime = localStorage.getItem(`qr_start_time_${verifiedCode}`);

        if (verifiedCode && activePin && startTime) {
            const endTime = parseInt(startTime) + COUNTDOWN_DURATION;
            const now = new Date().getTime();

            if (endTime - now > 0) {
                authSection.style.display = "none";
                qrSection.style.display = "block";
                startQrAndTimer(activePin, verifiedCode);
            } else {
                clearAllSessionStorage(verifiedCode);
            }
        }
    }

    // Fungsi Utama Pembuat Barcode, QR, dan Timer
    function startQrAndTimer(realPin, verifiedCode) {
        if (timerInterval) clearInterval(timerInterval);

        const storageKeyStartTime = `qr_start_time_${verifiedCode}`;
        let startTime = localStorage.getItem(storageKeyStartTime);

        if (!startTime) {
            startTime = new Date().getTime().toString();
            localStorage.setItem(storageKeyStartTime, startTime);
        }

        const endTime = parseInt(startTime) + COUNTDOWN_DURATION;

        // Pemisahan String PIN
        let pinForQR = "";
        let pinForBarcode = "";

        if (realPin && realPin.includes('|')) {
            const splitParts = realPin.split('|');
            pinForQR = splitParts[0].trim();       
            pinForBarcode = splitParts[1].trim();  
        } else {
            console.warn("Karakter '|' tidak ditemukan. Data asli:", realPin);
            pinForQR = realPin;
            pinForBarcode = "00000000"; 
        }

        // --- GENERATE BARCODE (MENGGUNAKAN CANVAS) ---
        const barcodeCanvas = document.getElementById("barcode");
        if (barcodeCanvas && typeof JsBarcode !== "undefined") {
            try {
                JsBarcode(barcodeCanvas, pinForBarcode, {
                    format: "CODE128",
                    width: 2.5,
                    height: 75,
                    displayValue: true, 
                    fontSize: 14,
                    margin: 10,
                    background: "#ffffff",
                    lineColor: "#000000"
                });
                console.log("Barcode berhasil di-render.");
            } catch (barcodeError) {
                console.error("Gagal menjalankan JsBarcode:", barcodeError);
            }
        } else {
            console.error("Canvas objek tidak ditemukan atau library JsBarcode pincang.");
        }

        // --- GENERATE QR CODE ---
        qrcodeElement.innerHTML = ""; 
        new QRCode(qrcodeElement, {
            text: pinForQR,
            width: 220,
            height: 220,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        // Loop Countdown per Detik
        timerInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;

            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;
            const formattedSeconds = seconds < 10 ? "0" + seconds : seconds;

            countdownElement.innerText = `${formattedMinutes}:${formattedSeconds}`;

            if (distance < 10000) {
                timerBox.classList.add("timer-expired");
            }

            // Kondisi Sesi Habis
            if (distance < 0) {
                clearInterval(timerInterval);
                clearAllSessionStorage(verifiedCode);
                
                authInputs.forEach(input => input.value = "");
                btnVerify.disabled = false;
                btnVerify.innerText = "Tampilkan QR";
                
                qrSection.style.display = "none";
                authSection.style.display = "block";
                
                countdownElement.innerText = "00:30";
                qrcodeElement.innerHTML = ""; 
                
                // Hapus isi canvas barcode agar kembali bersih
                if (barcodeCanvas) {
                    const ctx = barcodeCanvas.getContext('2d');
                    ctx.clearRect(0, 0, barcodeCanvas.width, barcodeCanvas.height);
                }
                
                timerBox.classList.remove("timer-expired");
                showStatusMessage("Waktu 30 detik habis! Sesi Akses Anda telah kedaluwarsa, silakan masukkan kode kembali.");
            }
        }, 1000);
    }

    function clearAllSessionStorage(verifiedCode) {
        localStorage.removeItem(`qr_start_time_${verifiedCode}`);
        localStorage.removeItem("active_pin");
        localStorage.removeItem("verified_code");
    }

    function showStatusMessage(message) {
        statusMsg.innerText = message;
        statusMsg.style.display = "block";
    }
});
