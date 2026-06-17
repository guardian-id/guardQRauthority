// GANTI DENGAN URL HTTP TRIGGER DARI POWER AUTOMATE KEDUA ANDA
const POWER_AUTOMATE_VERIFY_URL = "URL_HTTP_POST_FLOW_VERIFIKASI_ANDA_DI_SINI";

document.addEventListener("DOMContentLoaded", () => {
    // Elemen DOM Kontrol Halaman
    const authSection = document.getElementById("auth-section");
    const qrSection = document.getElementById("qr-section");
    const authInputs = document.querySelectorAll(".auth-input");
    const btnVerify = document.getElementById("btnVerify");
    
    // Elemen DOM QR & Timer
    const qrcodeElement = document.getElementById("qrcode");
    const qrcodeContainer = document.getElementById("qrcode-container");
    const countdownElement = document.getElementById("countdown");
    const timerBox = document.querySelector(".timer-box");
    const statusMsg = document.getElementById("statusMsg");

    // Fokus otomatis & Navigasi Antar Kotak Input (6 Kotak)
    authInputs.forEach((input, index) => {
        input.addEventListener("input", (e) => {
            // Hanya izinkan angka
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            // Lompat otomatis ke kanan jika kotak sudah terisi
            if (e.target.value.length === 1 && index < authInputs.length - 1) {
                authInputs[index + 1].focus();
            }
        });

        input.addEventListener("keydown", (e) => {
            // Mundur otomatis ke kiri jika menekan Backspace saat kolom kosong
            if (e.key === "Backspace" && !e.target.value && index > 0) {
                authInputs[index - 1].focus();
            }
        });
    });

    // Event saat tombol verifikasi diklik oleh user
    btnVerify.addEventListener("click", async () => {
        let userCodeInput = "";
        authInputs.forEach(input => userCodeInput += input.value);

        if (userCodeInput.length !== 6) {
            showStatusMessage("Silakan isi 6 digit kode verifikasi dengan lengkap!");
            return;
        }

        // Kunci UI saat pemrosesan request ke Power Automate
        btnVerify.disabled = true;
        btnVerify.innerText = "Memverifikasi...";
        statusMsg.style.display = "none";

        // Susun payload JSON untuk dikirimkan ke Power Automate
        const payload = {
            inputCode: userCodeInput
        };

        try {
            const response = await fetch(POWER_AUTOMATE_VERIFY_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            // JIKA POWER AUTOMATE MERESPON STATUS 200 (KODE COCOK)
            if (response.ok) {
                const data = await response.json(); 
                
                // Memastikan data PIN dikirim balik oleh Power Automate
                if (data.pin) {
                    authSection.style.display = "none";
                    qrSection.style.display = "block";

                    // Jalankan pembentukan QR Code dan aktifkan Timer 5 Menit
                    startQrAndTimer(data.pin, userCodeInput);
                } else {
                    throw new Error("Respon server salah (PIN tidak ditemukan).");
                }

            } else {
                // JIKA POWER AUTOMATE MERESPON STATUS 400 (TEKS MENTAH ERROR)
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

    // Fungsi Logika Utama Pembuat QR & Countdown Timer
    function startQrAndTimer(realPin, verifiedCode) {
        // Ikat start time di localStorage menggunakan basis kode unik agar tidak reset saat refresh
        const storageKeyStartTime = `qr_start_time_${verifiedCode}`;
        let startTime = localStorage.getItem(storageKeyStartTime);

        if (!startTime) {
            startTime = new Date().getTime().toString();
            localStorage.setItem(storageKeyStartTime, startTime);
        }

        const duration = 5 * 60 * 1000; // 5 Menit (300.000 ms)
        const endTime = parseInt(startTime) + duration;

        // Render QR Code langsung di layar menggunakan data PIN asli dari server
        qrcodeElement.innerHTML = ""; // Bersihkan QR lama jika ada
        new QRCode(qrcodeElement, {
            text: realPin,
            width: 150,
            height: 150,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        // Loop interval perhitungan mundur per detik
        const timerInterval = setInterval(() => {
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

            // --- KONDISI KETIKA WAKTU COUNTDOWN 5 MENIT HABIS ---
            if (distance < 0) {
                clearInterval(timerInterval);
                
                // 1. Hapus memori waktu lama di localStorage agar tidak bug di request berikutnya
                localStorage.removeItem(storageKeyStartTime);
                
                // 2. Kosongkan kembali seluruh 6 kotak input di halaman depan
                authInputs.forEach(input => input.value = "");
                
                // 3. Reset status tombol verifikasi ke kondisi awal
                btnVerify.disabled = false;
                btnVerify.innerText = "Buka QR Code";
                
                // 4. Tukar halaman: Sembunyikan QR, munculkan kembali form input kode
                qrSection.style.display = "none";
                authSection.style.display = "block";
                
                // 5. Bersihkan sisa-sisa elemen visual QR & warna timer
                countdownElement.innerText = "05:00";
                qrcodeElement.innerHTML = ""; 
                timerBox.classList.remove("timer-expired");

                // 6. Tampilkan pesan peringatan merah di halaman utama input
                showStatusMessage("Waktu 5 menit habis! Sesi QR Code Anda telah kedaluwarsa, silakan masukkan kode kembali.");
            }
        }, 1000);
    }

    // Menampilkan pesan status/error di layar
    function showStatusMessage(message) {
        statusMsg.innerText = message;
        statusMsg.style.display = "block";
    }
});