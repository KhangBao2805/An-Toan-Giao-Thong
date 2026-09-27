import { GoogleGenAI } from "@google/genai";

const TRAFFIC_SIGNS = [
  { id: "P102", name: "Biển cấm đi ngược chiều (P.102)", category: "cam", type: "Biển Cấm", badgeColor: "bg-red-100 text-red-700", meaning: "Báo cấm tất cả các loại xe (cơ giới và thô sơ) đi vào theo chiều đặt biển.", advice: "Hãy tiếp tục đi thẳng hoặc chọn tuyến đường song song khác phù hợp.", avoid: "Tuyệt đối không đi vào lối này để tránh va chạm trực diện nguy hiểm." },
  { id: "P123a", name: "Biển cấm rẽ trái (P.123a)", category: "cam", type: "Biển Cấm", badgeColor: "bg-red-100 text-red-700", meaning: "Báo cấm các loại xe rẽ trái tại nút giao.", advice: "Hãy đi thẳng qua nút giao rồi tìm điểm quay đầu hoặc rẽ ở ngã tư tiếp theo.", avoid: "Không cố tình bẻ lái rẽ trái tại đây." },
  { id: "W208", name: "Giao nhau với đường ưu tiên (W.208)", category: "nguyhiem", type: "Nguy Hiểm", badgeColor: "bg-amber-100 text-amber-700", meaning: "Báo trước bạn sắp giao cắt với đường ưu tiên.", advice: "Hãy giảm tốc độ, quan sát hai bên và nhường đường cho xe trên đường ưu tiên.", avoid: "Không lao nhanh qua ngã tư mà thiếu quan sát." },
  { id: "R301a", name: "Các hướng đi phải theo (R.301a)", category: "hieulenh", type: "Hiệu Lệnh", badgeColor: "bg-blue-100 text-blue-700", meaning: "Các xe chỉ được phép đi thẳng theo hướng mũi tên chỉ.", advice: "Tuân thủ đi thẳng theo đúng làn đường.", avoid: "Không rẽ trái hay rẽ phải tại nút giao có biển này." },
  { id: "V11", name: "Vạch kẻ đường nét liền trắng", category: "vachke", type: "Vạch Kẻ Đường", badgeColor: "bg-slate-100 text-slate-700", meaning: "Dùng để phân chia các làn xe cùng chiều.", advice: "Duy trì di chuyển đúng làn đường hiện tại.", avoid: "Tuyệt đối không đè vạch hoặc lấn sang làn bên cạnh." },
  { id: "V12", name: "Vạch kẻ đường nét đứt trắng", category: "vachke", type: "Vạch Kẻ Đường", badgeColor: "bg-slate-100 text-slate-700", meaning: "Phân chia các làn xe di chuyển cùng chiều.", advice: "Bạn có thể chuyển làn an toàn khi bật tín hiệu xi-nhan.", avoid: "Không chuyển làn đột ngột gây bất ngờ cho xe sau." }
];

const SCENARIOS = [
  { title: "Gặp vạch kẻ đường màu vàng nét liền đôi", desc: "Bạn đang lưu thông trên đường hai chiều và thấy hai đường vạch màu vàng song song chạy dọc giữa đường.", guide: "Vạch này dùng để phân chia hai chiều xe chạy ngược nhau. Bạn tuyệt đối không được lấn làn hay đè lên vạch này để vượt xe khác nhé!" },
  { title: "Đèn giao thông nhấp nháy vàng", desc: "Bạn tới ngã tư lúc đêm muộn và thấy đèn tín hiệu giao thông chỉ nhấp nháy màu vàng.", guide: "Tín hiệu này báo hiệu bạn được phép đi tiếp nhưng phải giảm tốc độ, chú ý quan sát cẩn thận xung quanh và nhường đường cho người đi bộ." },
  { title: "Biển cấm quay đầu xe (P.124a)", desc: "Bạn muốn quay lại đoạn đường vừa đi nhưng thấy biển tròn viền đỏ có hình mũi tên quay đầu gạch đỏ.", guide: "Bạn không được phép quay đầu tại đây. Hãy đi tiếp tới điểm quay đầu được cho phép hoặc vòng qua ngã tư tiếp theo." }
];

let stream = null;
let activeCategory = "all";

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

window.switchTab = function(tabName) {
  document.querySelectorAll(".tab-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".tab-button").forEach(el => el.classList.remove("active"));
  document.getElementById(`section-${tabName}`).classList.remove("hidden");
  document.getElementById(`tab-${tabName}`).classList.add("active");
  if (tabName !== "ai" && stream) stopCamera();
  if (window.lucide) lucide.createIcons();
};

window.toggleApiKeyModal = function() {
  document.getElementById("apiKeyModal").classList.toggle("hidden");
};

window.saveApiKey = function() {
  const key = document.getElementById("customApiKeyInput").value.trim();
  if (!key) { alert("Vui lòng dán API Key trước khi lưu."); return; }
  localStorage.setItem("GEMINI_API_KEY", key);
  checkSavedApiKey();
  window.toggleApiKeyModal();
  alert("Đã lưu API Key thành công!");
};

window.clearApiKey = function() {
  localStorage.removeItem("GEMINI_API_KEY");
  document.getElementById("customApiKeyInput").value = "";
  document.getElementById("apiKeyStatusText").innerText = "Cấu hình API Key";
};

function checkSavedApiKey() {
  const key = localStorage.getItem("GEMINI_API_KEY");
  document.getElementById("apiKeyStatusText").innerText = key ? "Đã kết nối API Key" : "Cấu hình API Key";
  if (key) document.getElementById("customApiKeyInput").value = key;
}

function showImagePreview(src) {
  const img = document.getElementById("imagePreview");
  img.src = src;
  img.classList.remove("hidden");
  document.getElementById("uploadPlaceholder").classList.add("hidden");
}

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) { alert("Vui lòng chọn file hình ảnh (JPG/PNG/WEBP)."); return; }
  stopCamera();
  const reader = new FileReader();
  reader.onload = evt => { showImagePreview(evt.target.result); analyzeImageWithAI(evt.target.result); };
  reader.readAsDataURL(file);
}

window.toggleCamera = async function() {
  const video = document.getElementById("webcam");
  const captureBtn = document.getElementById("captureBtn");
  const label = document.getElementById("cameraBtnText");
  if (stream) { stopCamera(); return; }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = stream;
    await video.play().catch(() => {});
    video.classList.remove("hidden");
    document.getElementById("uploadPlaceholder").classList.add("hidden");
    document.getElementById("imagePreview").classList.add("hidden");
    captureBtn.classList.remove("hidden");
    if (label) label.innerText = "Tắt Camera";
  } catch (err) {
    console.error(err);
    alert("Không thể kết nối Camera. Hãy kiểm tra quyền truy cập hoặc dùng HTTPS/localhost.");
  }
};

function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  const video = document.getElementById("webcam");
  if (video) { video.srcObject = null; video.classList.add("hidden"); }
  document.getElementById("captureBtn").classList.add("hidden");
  const label = document.getElementById("cameraBtnText");
  if (label) label.innerText = "Mở Camera";
}

window.captureAndAnalyze = function() {
  const video = document.getElementById("webcam");
  if (!video.videoWidth) { alert("Camera chưa sẵn sàng, vui lòng đợi giây lát."); return; }
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  stopCamera();
  showImagePreview(dataUrl);
  analyzeImageWithAI(dataUrl);
};

async function analyzeImageWithAI(base64Image) {
  const apiKey = localStorage.getItem("GEMINI_API_KEY");
  if (!apiKey) {
    alert("Vui lòng nhập Gemini API Key ở góc trên bên phải để sử dụng tính năng nhận diện AI nhé!");
    window.toggleApiKeyModal();
    return;
  }
  const loadingOverlay = document.getElementById("loadingOverlay");
  loadingOverlay.classList.remove("hidden");
  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = base64Image.split(",")[1];
    const mimeType = (base64Image.match(/data:(.*?);/) || [])[1] || "image/jpeg";
    const prompt = `Bạn là người hướng dẫn giao thông thân thiện tại Việt Nam. Phân tích ảnh và cho biết có biển báo, vạch kẻ đường hay đèn tín hiệu nào không. Chỉ trả về JSON thuần (không markdown): {"title":"Tên đối tượng","type":"Biển cấm / Nguy hiểm / Hiệu lệnh / Vạch kẻ / Đèn tín hiệu","meaning":"Ý nghĩa ngắn gọn","advice":"Lời khuyên nên làm gì (xưng Bạn-Mình)","avoid":"Điều cần tránh"}. Nếu không thấy gì rõ, trả về title "Không thể nhận diện chính xác".`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    const textResponse = response.text || "";
    const m = textResponse.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("AI không trả về JSON");
    renderAIResult(JSON.parse(m[0]));
  } catch (error) {
    console.error(error);
    let msg = "Hình ảnh có thể mờ hoặc API Key chưa chính xác.";
    const s = String(error?.message || "");
    if (s.includes("API key")) msg = "API Key không hợp lệ. Bạn kiểm tra lại cấu hình nhé!";
    renderAIResult({ title: "Không thể nhận diện chính xác", type: "Thông báo", meaning: msg, advice: "Bạn thử tải lại ảnh rõ nét hơn hoặc kiểm tra lại cấu hình API Key nhé!", avoid: "Tránh dùng ảnh quá tối hoặc không nhìn rõ biển báo." });
  } finally {
    loadingOverlay.classList.add("hidden");
  }
}

function renderAIResult(data) {
  const resultBox = document.getElementById("resultBox");
  resultBox.className = "flex-1 flex flex-col p-5 bg-white border border-emerald-200 rounded-xl space-y-4 shadow-sm text-left";
  resultBox.innerHTML = `
    <div class="flex items-center justify-between border-b pb-3 border-slate-100">
      <span class="bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full">${esc(data.type) || "Nhận diện"}</span>
      <span class="text-xs text-slate-400">Kết quả AI</span>
    </div>
    <h4 class="font-bold text-slate-800 text-lg">${esc(data.title)}</h4>
    <div class="space-y-3 text-sm">
      <div class="p-3 bg-slate-50 rounded-lg"><span class="font-semibold text-slate-700 block mb-1">Ý nghĩa:</span><p class="text-slate-600">${esc(data.meaning)}</p></div>
      <div class="p-3 bg-emerald-50 rounded-lg border border-emerald-100"><span class="font-semibold text-emerald-800 block mb-1">Lời khuyên cho bạn:</span><p class="text-emerald-700">${esc(data.advice)}</p></div>
      <div class="p-3 bg-rose-50 rounded-lg border border-rose-100"><span class="font-semibold text-rose-800 block mb-1">Điều cần tránh:</span><p class="text-rose-700">${esc(data.avoid)}</p></div>
    </div>`;
}

function applyFilters() {
  const query = document.getElementById("searchInput").value.toLowerCase().trim();
  renderSigns(TRAFFIC_SIGNS.filter(item =>
    (activeCategory === "all" || item.category === activeCategory) &&
    (!query || item.name.toLowerCase().includes(query) || item.meaning.toLowerCase().includes(query) || item.id.toLowerCase().includes(query))
  ));
}

function renderSigns(items) {
  const container = document.getElementById("signGrid");
  if (!items.length) { container.innerHTML = `<p class="col-span-full text-center text-sm text-slate-400 py-8">Không tìm thấy biển báo phù hợp. Thử từ khóa khác nhé!</p>`; return; }
  container.innerHTML = items.map(item => `
    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between hover:border-emerald-300 transition-all">
      <div>
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full ${esc(item.badgeColor)}">${esc(item.type)}</span>
          <span class="text-xs text-slate-400 font-mono">${esc(item.id)}</span>
        </div>
        <h4 class="font-bold text-slate-800 text-base mb-2">${esc(item.name)}</h4>
        <p class="text-xs text-slate-600 leading-relaxed mb-3">${esc(item.meaning)}</p>
      </div>
      <div class="pt-3 border-t border-slate-100 space-y-2 text-xs">
        <p class="text-emerald-700"><span class="font-semibold">Nên làm:</span> ${esc(item.advice)}</p>
        <p class="text-rose-600"><span class="font-semibold">Tránh:</span> ${esc(item.avoid)}</p>
      </div>
    </div>`).join("");
}

function renderScenarios() {
  document.getElementById("scenarioList").innerHTML = SCENARIOS.map(s => `
    <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-2">
      <h4 class="font-bold text-slate-800 text-base flex items-center gap-2"><i data-lucide="alert-circle" class="w-4 h-4 text-emerald-600"></i> ${esc(s.title)}</h4>
      <p class="text-xs text-slate-500">${esc(s.desc)}</p>
      <div class="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 leading-relaxed mt-2 border border-slate-100">
        <span class="font-semibold text-emerald-700 block mb-1">Hướng dẫn xử lý:</span>${esc(s.guide)}
      </div>
    </div>`).join("");
  if (window.lucide) lucide.createIcons();
}

window.filterSigns = applyFilters;
window.filterCategory = function(cat, btn) {
  activeCategory = cat;
  document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  applyFilters();
};

document.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) lucide.createIcons();
  renderSigns(TRAFFIC_SIGNS);
  renderScenarios();
  checkSavedApiKey();
  document.getElementById("fileInput").addEventListener("change", e => handleFile(e.target.files[0]));
  document.getElementById("searchInput").addEventListener("input", applyFilters);
  const dz = document.getElementById("dropZone");
  ["dragenter", "dragover"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove("dragover"); }));
  dz.addEventListener("drop", e => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) handleFile(f); });
  document.getElementById("apiKeyModal").addEventListener("click", e => { if (e.target.id === "apiKeyModal") window.toggleApiKeyModal(); });
});
