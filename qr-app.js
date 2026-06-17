// GANTI DENGAN URL HTTP TRIGGER DARI POWER AUTOMATE KEDUA ANDA
const POWER_AUTOMATE_VERIFY_URL = "https://default9ec0d6c58a25418fb3841c77c55584.c2.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/01a09216cd654387bdff550c9dea3dfb/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=YGW3DRKHlVHqxSlocw6tvDinaRmugAIywt_EHnicG-c";

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

    let timerInterval = null; // Menyimpan referensi interval global agar bisa di-clear dengan aman

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

    // Cek apakah ada sesi aktif di localStorage saat halaman pertama kali dimuat (antisipasi refresh)
    checkActiveSession();

    // Event saat tombol verifikasi diklik oleh user
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
                
                if (data.pin) {
                    // Simpan pin dan kode terverifikasi ke localStorage agar tahan refresh
                    localStorage.setItem("active_pin", data.pin);
                    localStorage.setItem("verified_code", userCodeInput);

                    // Pindah Halaman & Jalankan Timer
                    authSection.style.display = "none";
                    qrSection.style.display = "block";

                    startQrAndTimer(data.pin, userCodeInput);
                } else {
                    throw new Error("Respon server salah (PIN tidak ditemukan).");
                }
            } else {
                const errorText = await response.text();
                throw new Error(errorText || "Kode verifikasi salah atau sudah kedaluwarsa!");
            }

        } catch (error) {
            console.error("Verification Error:", error);
            showStatusMessage(error.message);
            btnVerify.disabled = false;
            btnVerify.innerText = "Buka QR Code";
        }
    });

    // Fungsi memeriksa apakah user masih dalam masa sisa 5 menit saat page di-refresh
    function checkActiveSession() {
        const verifiedCode = localStorage.getItem("verified_code");
        const activePin = localStorage.getItem("active_pin");
        const startTime = localStorage.getItem(`qr_start_time_${verifiedCode}`);

        if (verifiedCode && activePin && startTime) {
            const duration = 5 * 60 * 1000;
            const endTime = parseInt(startTime) + duration;
            const now = new Date().getTime();

            if (endTime - now > 0) {
                // Sesi masih valid, langsung lempar ke halaman QR
                authSection.style.display = "none";
                qrSection.style.display = "block";
                startQrAndTimer(activePin, verifiedCode);
            } else {
                // Sesi sudah mati saat ditinggal offline/refresh, bersihkan storage
                clearAllSessionStorage(verifiedCode);
            }
        }
    }

    // Fungsi Logika Utama Pembuat QR & Countdown Timer
    function startQrAndTimer(realPin, verifiedCode) {
        // Bersihkan interval lama jika ada untuk mencegah memory leak / double timer
        if (timerInterval) clearInterval(timerInterval);

        const storageKeyStartTime = `qr_start_time_${verifiedCode}`;
        let startTime = localStorage.getItem(storageKeyStartTime);

        if (!startTime) {
            startTime = new Date().getTime().toString();
            localStorage.setItem(storageKeyStartTime, startTime);
        }

        const duration = 5 * 60 * 1000; 
        const endTime = parseInt(startTime) + duration;

        // Render QR Code
        qrcodeElement.innerHTML = ""; 
        new QRCode(qrcodeElement, {
            text: realPin,
            width: 220,
            height: 220,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        // Loop interval per detik
        timerInterval = setInterval(() => {
            const now = new Date().getTime();
            const distance = endTime - now;

            const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((distance % (1000 * 60)) / 1000);

            const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;
            const formattedSeconds = seconds < 10 ? "0" + seconds : seconds;

            countdownElement.innerText = `${formattedMinutes}:${formattedSeconds}`;

            // Jika waktu tinggal kurang dari 1 menit, ubah warna timer jadi merah
            if (distance < 60000) {
                timerBox.classList.add("timer-expired");
            }

            // --- KONDISI KETIKA WAKTU COUNTDOWN HABIS ---
            if (distance < 0) {
                clearInterval(timerInterval);
                
                // 1. Bersihkan semua data session di localStorage
                clearAllSessionStorage(verifiedCode);
                
                // 2. Reset Form UI Kembali ke Awal
                authInputs.forEach(input => input.value = "");
                btnVerify.disabled = false;
                btnVerify.innerText = "Buka QR Code";
                
                // 3. Tukar Halaman
                qrSection.style.display = "none";
                authSection.style.display = "block";
                
                // 4. Bersihkan Sisa Visual
                countdownElement.innerText = "05:00";
                qrcodeElement.innerHTML = ""; 
                timerBox.classList.remove("timer-expired");

                // 5. Tampilkan Pesan Error
                showStatusMessage("Waktu 5 menit habis! Sesi QR Code Anda telah kedaluwarsa, silakan masukkan kode kembali.");
            }
        }, 1000);
    }

    // Helper untuk membersihkan seluruh object localStorage terkait session ini
    function clearAllSessionStorage(verifiedCode) {
        localStorage.removeItem(`qr_start_time_${verifiedCode}`);
        localStorage.removeItem("active_pin");
        localStorage.removeItem("verified_code");
    }

    // Menampilkan pesan status/error di layar
    function showStatusMessage(message) {
        statusMsg.innerText = message;
        statusMsg.style.display = "block";
    }
});
