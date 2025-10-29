// script.js untuk MEKD (Model Estimasi Korupsi Daerah)
// - Format input otomatis (separator ribuan '.')
// - Parsing aman ke angka (mengatasi koma desimal)
// - Validasi agar tidak ada log(0)
// - Hasil: Estimasi Korupsi (Rp) dan Estimasi IPM (langsung, skala 0-100)
// - Grafik Chart.js dengan dua sumbu Y (korupsi = left, IPM = right)

let chart = null;

/* -------------------------
   Formatting & Parsing
   ------------------------- */

// Format input teks: sisakan hanya digit dan koma, tambahkan pemisah ribuan "."
function formatNumberInput(input) {
  // Simpan posisi kursor (tidak dipertahankan sempurna pada semua browser, tetapi cukup)
  let raw = input.value;
  // Hapus semua selain digit dan koma
  raw = raw.replace(/[^\d,]/g, "");
  // Pisah bagian desimal bila ada
  const parts = raw.split(",");
  // Tambahkan titik setiap 3 digit pada bagian integer
  let intPart = parts[0];
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  input.value = intPart + (parts[1] ? "," + parts[1] : "");
}

// Cari semua input type="text" yang kita pakai sebagai angka dan pasang listener
document.addEventListener("DOMContentLoaded", () => {
  // Seleksi input teks yang memang angka (nama-nama umum)
  const textIds = ["pad", "dau", "dak", "dbh", "belanja", "pendapatan", "penduduk", "asn", "pdrb"];
  textIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("input", () => formatNumberInput(el));
      // optional: prevent spaces
      el.addEventListener("blur", () => {
        // jika kosong, set ke kosong (hindari "0" palsu)
        if (el.value === "") return;
        // ensure formatted
        formatNumberInput(el);
      });
    }
  });
});

// Parse angka dari format "1.234,56" atau "1.234" -> Number
function parseNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).trim();
  if (cleaned === "") return 0;
  // Replace dot thousands, replace comma decimal to dot
  const dotRemoved = cleaned.replace(/\./g, "");
  const normalized = dotRemoved.replace(",", ".");
  const num = Number(normalized);
  return isNaN(num) ? 0 : num;
}

/* -------------------------
   Perhitungan & Validasi
   ------------------------- */

function hitung() {
  // Ambil input
  const pad = parseNumber(document.getElementById("pad")?.value) * 1_000_000; // juta -> rupiah
  const dau = parseNumber(document.getElementById("dau")?.value) * 1_000_000;
  const dak = parseNumber(document.getElementById("dak")?.value) * 1_000_000;
  const dbh = parseNumber(document.getElementById("dbh")?.value) * 1_000_000;
  const belanja = parseNumber(document.getElementById("belanja")?.value) * 1_000_000;
  const pendapatan = parseNumber(document.getElementById("pendapatan")?.value) * 1_000_000;
  const temuan = Number(document.getElementById("temuan")?.value) || 0;
  const penduduk = parseNumber(document.getElementById("penduduk")?.value) * 1_000_000; // juta jiwa -> jiwa
  const asn = parseNumber(document.getElementById("asn")?.value); // jumlah ASN (jiwa)
  const pdrb = parseNumber(document.getElementById("pdrb")?.value); // dalam rupiah (user masukkan full rupiah)
  const usia = Number(document.getElementById("usia")?.value) || 0;
  const jawa = Number(document.getElementById("jawa")?.value) || 0;
  const tipe = document.getElementById("tipe")?.value || "lainnya";

  // Cek keberadaan input penting: semua nilai yang masuk ke Math.log harus > 0
  const totalTransfer = dau + dak + dbh;
  const rasio = pendapatan === 0 ? null : belanja / pendapatan;

  // Validasi: pastikan nilai > 0 untuk argumen log()
  const neededPositives = {
    "Pendapatan Asli Daerah (PAD)": pad,
    "Total Transfer (DAU+DAK+DBH)": totalTransfer,
    "Total Belanja Daerah": belanja,
    "Total Pendapatan Daerah": pendapatan,
    "Jumlah Penduduk": penduduk,
    "Jumlah ASN": asn,
    "PDRB": pdrb
  };

  const missing = [];
  for (const [name, val] of Object.entries(neededPositives)) {
    if (!(val > 0)) missing.push(name);
  }

  if (missing.length > 0) {
    alert(
      "Mohon periksa input. Nilai berikut harus lebih dari 0 agar perhitungan tidak error:\n- " +
      missing.join("\n- ")
    );
    return;
  }

  if (!rasio || !(rasio > 0)) {
    alert("Rasio (Total Belanja / Total Pendapatan) harus lebih besar dari 0.");
    return;
  }

  const dummyKab = tipe === "kabupaten" ? 1 : 0;
  const dummyKota = tipe === "kota" ? 1 : 0;

  // --- Estimasi Korupsi (menggunakan ln dan anti-log exp) ---
  const estimasiKorupsiLn =
    21.872
    - 0.039 * Math.log(pad)
    - 0.013 * Math.log(totalTransfer)
    + 0.094 * Math.log(rasio)
    - 0.038 * temuan
    + 0.036 * Math.log(penduduk)
    + 0.4 * Math.log(asn)
    + 0.005 * Math.log(pdrb)
    - 0.02 * usia
    - 0.377 * jawa
    - 0.525 * dummyKab
    - 0.63 * dummyKota;

  const estimasiKorupsi = Math.exp(estimasiKorupsiLn);

  // --- Estimasi IPM (langsung, tanpa anti-log) ---
  const estimasiIpm =
    42.518
    + 0.155 * Math.log(pad)
    + 0.284 * Math.log(totalTransfer)
    + 2.803 * Math.log(rasio)
    - 0.052 * temuan
    - 0.55 * Math.log(estimasiKorupsi)
    + 0.333 * Math.log(penduduk)
    + 1.152 * Math.log(asn)
    + 0.027 * Math.log(pdrb)
    + 0.465 * usia
    + 0.027 * jawa
    + 0.435 * dummyKab
    + 9.678 * dummyKota;

  // Tampilkan hasil ke layar
  const hasilKorEl = document.getElementById("hasilKorupsi");
  const hasilIpmEl = document.getElementById("hasilIpm");

  if (hasilKorEl) {
    hasilKorEl.innerText = "Rp " + estimasiKorupsi.toLocaleString("id-ID", { maximumFractionDigits: 2 });
  }
  if (hasilIpmEl) {
    hasilIpmEl.innerText = estimasiIpm.toFixed(2) + " (Simulasi MEKD)";
  }

  // Tampilkan grafik dengan dua sumbu Y: korupsi (left), IPM (right, 0-100)
  tampilkanGrafikDualAxis(estimasiKorupsi, estimasiIpm);
}

/* -------------------------
   Grafik: Chart.js dual axis
   ------------------------- */

function tampilkanGrafikDualAxis(korupsi, ipm) {
  const ctx = document.getElementById("hasilChart");
  if (!ctx) return;
  const context = ctx.getContext("2d");

  // Data untuk chart: dua dataset, masing-masing pakai yAxisID berbeda
  const data = {
    labels: ["Estimasi Korupsi (Rp)", "Estimasi IPM (0–100)"],
    datasets: [
      {
        label: "Estimasi Korupsi (Rp)",
        data: [korupsi, null], // korupsi di posisi 0, kosong di 1
        backgroundColor: "#1e88e5",
        yAxisID: "yKor",
        borderRadius: 6
      },
      {
        label: "Estimasi IPM",
        data: [null, ipm], // ipm di posisi 1
        backgroundColor: "#43a047",
        yAxisID: "yIpm",
        borderRadius: 6
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      yKor: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        ticks: {
          callback: function (value) {
            // Format tick untuk korupsi: gunakan representasi Jt/M jika besar
            if (value >= 1_000_000_000) return (value / 1_000_000_000) + " M";
            if (value >= 1_000_000) return (value / 1_000_000) + " Jt";
            return value;
          }
        }
      },
      yIpm: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        min: 0,
        max: 100,
        grid: {
          drawOnChartArea: false // hilangkan garis grid y kedua agar tidak mengacaukan visual
        },
        ticks: {
          stepSize: 10
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const datasetLabel = context.dataset.label || "";
            const value = context.parsed.y;
            if (datasetLabel.includes("Korupsi")) {
              return datasetLabel + ": Rp " + (value ? value.toLocaleString("id-ID", { maximumFractionDigits: 2 }) : "0");
            } else {
              return datasetLabel + ": " + (value !== null && value !== undefined ? Number(value).toFixed(2) : "0");
            }
          }
        }
      }
    }
  };

  // Hapus chart lama jika ada, lalu buat baru (agar opsi axis diterapkan benar)
  if (chart) {
    chart.destroy();
    chart = null;
  }

  // Set fixed height untuk canvas supaya chart responsive terlihat baik
  ctx.style.height = "300px";
  chart = new Chart(context, {
    type: "bar",
    data: data,
    options: options
  });
}

/* -------------------------
   Utility: inisialisasi kecil
   ------------------------- */

// Jika ingin jalankan perhitungan otomatis pada Enter di form: tambahkan listener
document.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    const active = document.activeElement;
    // jangan submit form saat fokus di textarea/ select tertentu; kita trigger hitung hanya jika input di dalam form
    if (active && (active.tagName === "INPUT" || active.tagName === "SELECT")) {
      // mencegah submit form default jika ada form
      e.preventDefault();
      // jalankan hitung
      hitung();
    }
  }
});
