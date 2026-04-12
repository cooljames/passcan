// ===== App State =====
const AppState = {
  currentImageData: null,
  currentParsedData: null,
  history: [],
  isProcessing: false,
};

// ===== DOM Elements =====
const UI = {
  // Navigation
  steps: document.querySelectorAll('.step'),
  connectors: document.querySelectorAll('.step-connector'),
  
  // Panels
  inputPanel: document.getElementById('inputPanel'),
  resultPanel: document.getElementById('resultPanel'),
  
  // States
  emptyState: document.getElementById('emptyState'),
  processingState: document.getElementById('processingState'),
  resultState: document.getElementById('resultState'),
  exportSuccess: document.getElementById('exportSuccess'),
  
  // Inputs
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  cameraBtn: document.getElementById('cameraBtn'),
  cameraInput: document.getElementById('cameraInput'),
  
  // Preview
  previewContainer: document.getElementById('previewContainer'),
  previewImage: document.getElementById('previewImage'),
  previewClose: document.getElementById('previewClose'),
  
  // Processing
  progressRing: document.getElementById('progressRing'),
  progressText: document.getElementById('progressText'),
  processingLabel: document.getElementById('processingLabel'),
  
  // Result Displays
  resCountryCode: document.getElementById('resCountryCode'),
  passportPhoto: document.getElementById('passportPhoto'),
  resName: document.getElementById('resName'),
  resNationality: document.getElementById('resNationality'),
  resPassportNo: document.getElementById('resPassportNo'),
  resSex: document.getElementById('resSex'),
  resDOB: document.getElementById('resDOB'),
  resExpiry: document.getElementById('resExpiry'),
  resMRZ: document.getElementById('resMRZ'),
  resultTime: document.getElementById('resultTime'),
  
  // Edit Fields
  editName: document.getElementById('editName'),
  editPassportNo: document.getElementById('editPassportNo'),
  editNationality: document.getElementById('editNationality'),
  editSex: document.getElementById('editSex'),
  editDOB: document.getElementById('editDOB'),
  editExpiry: document.getElementById('editExpiry'),
  
  // Action Buttons
  exportBtn: document.getElementById('exportBtn'),
  resetBtn: document.getElementById('resetBtn'),
  exportResetBtn: document.getElementById('exportResetBtn'),
  
  // Sidebar
  historyBtn: document.getElementById('historyBtn'),
  historyCount: document.getElementById('historyCount'),
  historySidebar: document.getElementById('historySidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  sidebarClose: document.getElementById('sidebarClose'),
  historyList: document.getElementById('historyList'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  exportAllFromSidebar: document.getElementById('exportAllFromSidebar'),
  
  // Toast
  toastContainer: document.getElementById('toastContainer'),
};

// Apps Script Web App URL
const APPS_SCRIPT_URL = 'https://script.google.com/a/macros/jbnu.ac.kr/s/AKfycbxw9rKOkgG5X0DErwF78fe1ulmtVNREUsOPJ1OGnOrRF9iY3PAUhse-jXfJzPyx9Fzxhg/exec';

// ===== Initialization =====
function init() {
  bindEvents();
  loadHistory();
}

function bindEvents() {
  // File Input
  UI.dropZone.addEventListener('click', () => UI.fileInput.click());
  UI.fileInput.addEventListener('change', (e) => handleFileSelection(e.target.files));
  
  // Camera Input
  UI.cameraBtn.addEventListener('click', () => UI.cameraInput.click());
  UI.cameraInput.addEventListener('change', (e) => handleFileSelection(e.target.files));
  
  // Drag & Drop
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
  
  UI.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    UI.dropZone.classList.add('dragover');
  });
  
  UI.dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    UI.dropZone.classList.remove('dragover');
  });
  
  UI.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    UI.dropZone.classList.remove('dragover');
    handleFileSelection(e.dataTransfer.files);
  });
  
  // Paste Event
  document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || window.clipboardData).items;
    for (let item of items) {
      if (item.type.indexOf('image') !== -1) {
        handleFileSelection([item.getAsFile()]);
        return;
      }
    }
  });
  
  // Buttons
  UI.previewClose.addEventListener('click', resetInput);
  UI.resetBtn.addEventListener('click', resetApp);
  UI.exportResetBtn.addEventListener('click', resetApp);
  UI.exportBtn.addEventListener('click', exportToGoogleSheets);
  
  // Sidebar
  UI.historyBtn.addEventListener('click', toggleSidebar);
  UI.sidebarClose.addEventListener('click', toggleSidebar);
  UI.sidebarOverlay.addEventListener('click', toggleSidebar);
  UI.clearHistoryBtn.addEventListener('click', clearHistory);
  UI.exportAllFromSidebar.addEventListener('click', exportAllHistory);
}

// ===== Core Logic =====

async function handleFileSelection(files) {
  if (!files || files.length === 0) return;
  const file = files[0];
  if (!file.type.startsWith('image/')) {
    showToast('이미지 파일만 선택 가능합니다.', 'error');
    return;
  }
  
  try {
    // 1. Show Preview
    updateStep(2);
    const imageUrl = URL.createObjectURL(file);
    AppState.currentImageData = imageUrl;
    UI.previewImage.src = imageUrl;
    UI.previewContainer.classList.add('visible');
    
    // 2. Start Processing
    showProcessingState();
    
    // 3. Compress Image for OCR
    updateProgress(10, '이미지 최적화 중...');
    const compressedImage = await compressImage(file);
    
    // 4. Run OCR
    updateProgress(30, 'OCR 엔진 초기화 및 문자 인식 중...');
    const ocrText = await recognizeText(compressedImage);
    
    // 5. Parse MRZ
    updateProgress(90, 'MRZ 데이터 분석 중...');
    const parseResult = MRZParser.parse(ocrText);
    
    if (parseResult.success) {
      updateProgress(100, '분석 완료!');
      setTimeout(() => {
        showResultState(parseResult.data);
      }, 500);
    } else {
      showToast(parseResult.error, 'error');
      resetUIState();
    }
    
  } catch (err) {
    console.error(err);
    showToast(`오류가 발생했습니다: ${err.message}`, 'error');
    resetUIState();
  }
}

// ===== OCR & Processing =====

async function compressImage(file, maxWidth = 1500) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Improve contrast somewhat before OCR
        ctx.filter = 'contrast(1.2) grayscale(1)';
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function recognizeText(imageData) {
  try {
    // Use Tesseract.js (already loaded via CDN)
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          const progress = 30 + (m.progress * 60); // Math: 30% to 90%
          updateProgress(progress, '여권 정보 스캔 중...');
        }
      }
    });
    
    // To improve MRZ accuracy, we can configure whitelist, but MRZ can have P, <, numbers, letters
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
    });
    
    const { data: { text } } = await worker.recognize(imageData);
    await worker.terminate();
    
    console.log("OCR Result:\n" + text);
    return text;
  } catch (err) {
    throw new Error('OCR 처리 중 오류가 발생했습니다. ' + err.message);
  }
}

// ===== UI Flow =====

function updateStep(stepNum) {
  UI.steps.forEach((step, idx) => {
    const currentStep = idx + 1;
    if (currentStep < stepNum) {
      step.classList.remove('active');
      step.classList.add('completed');
    } else if (currentStep === stepNum) {
      step.classList.add('active');
      step.classList.remove('completed');
    } else {
      step.classList.remove('active', 'completed');
    }
  });
  
  UI.connectors.forEach((conn, idx) => {
    if (idx + 1 < stepNum) {
      conn.classList.add('active');
    } else {
      conn.classList.remove('active');
    }
  });
}

function showProcessingState() {
  UI.emptyState.classList.add('hidden');
  UI.resultState.classList.add('hidden');
  UI.exportSuccess.classList.add('hidden');
  UI.processingState.classList.remove('hidden');
  updateProgress(0, '준비 중...');
}

function updateProgress(percent, text) {
  percent = Math.min(100, Math.max(0, percent));
  UI.progressText.textContent = `${Math.round(percent)}%`;
  UI.processingLabel.textContent = text;
  
  // Update ring stroke offset
  const circumference = 339.292; // 2 * pi * 54
  const offset = circumference - (percent / 100) * circumference;
  UI.progressRing.style.strokeDashoffset = offset;
}

function showResultState(data) {
  AppState.currentParsedData = data;
  updateStep(3);
  
  UI.processingState.classList.add('hidden');
  UI.resultState.classList.remove('hidden');
  
  // Set current time
  const now = new Date();
  UI.resultTime.textContent = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
  
  // Populate Card Displays
  UI.resCountryCode.textContent = data.issuingCountry || '---';
  UI.resName.textContent = data.fullName || '—';
  UI.resNationality.textContent = data.nationalityName || '—';
  UI.resPassportNo.textContent = data.passportNo || '—';
  UI.resSex.textContent = data.sexDisplay || '—';
  UI.resDOB.textContent = data.dateOfBirthFormatted || '—';
  UI.resExpiry.textContent = data.dateOfExpiryFormatted || '—';
  UI.resMRZ.textContent = `${data.mrzLine1}\n${data.mrzLine2}`;
  
  // Add warning styling for invalid fields
  if (!data.validation.passportNoValid) UI.resPassportNo.style.color = 'var(--error)';
  else UI.resPassportNo.style.color = '';
  
  if (!data.validation.dobValid) UI.resDOB.style.color = 'var(--error)';
  else UI.resDOB.style.color = '';
  
  if (!data.validation.expiryValid) UI.resExpiry.style.color = 'var(--error)';
  else UI.resExpiry.style.color = '';
  
  // Populate Edit Fields
  UI.editName.value = data.fullName || '';
  UI.editPassportNo.value = data.passportNo || '';
  UI.editNationality.value = data.nationality || '';
  UI.editSex.value = data.sex === 'M' ? 'M' : data.sex === 'F' ? 'F' : '';
  UI.editDOB.value = data.dateOfBirth || '';
  UI.editExpiry.value = data.dateOfExpiry || '';
  
  showToast('여권 스캔이 완료되었습니다.', 'success');
}

function resetInput() {
  UI.fileInput.value = '';
  UI.cameraInput.value = '';
  UI.previewContainer.classList.remove('visible');
  UI.previewImage.src = '';
  AppState.currentImageData = null;
  resetApp();
}

function resetApp() {
  updateStep(1);
  AppState.currentParsedData = null;
  UI.fileInput.value = '';
  UI.cameraInput.value = '';
  UI.previewContainer.classList.remove('visible');
  UI.previewImage.src = '';
  resetUIState();
}

function resetUIState() {
  UI.processingState.classList.add('hidden');
  UI.resultState.classList.add('hidden');
  UI.exportSuccess.classList.add('hidden');
  UI.emptyState.classList.remove('hidden');
}

// ===== Export =====

async function exportToGoogleSheets() {
  // Get latest data from edit fields
  const exportData = {
    name: UI.editName.value.trim(),
    passport_num: UI.editPassportNo.value.trim(),
    nationality: UI.editNationality.value.trim(),
    sex: UI.editSex.value,
    dob: UI.editDOB.value,
    expiry: UI.editExpiry.value,
    scanned_at: new Date().toISOString()
  };
  
  if (!exportData.name || !exportData.passport_num) {
    showToast('성명과 여권번호는 필수입니다.', 'error');
    return;
  }
  
  UI.exportBtn.classList.add('loading');
  UI.exportBtn.textContent = '내보내는 중...';
  
  try {
    // Determine method: The GAS might be expecting a GET with params or POST
    // We send POST 'no-cors' by default as typical for Google Apps Script Web Apps when accessed from outside.
    // NOTE: With 'no-cors', we cannot read the response body. We assume success if request completes.
    
    // Prepare params for a POST payload or GET
    const searchParams = new URLSearchParams(exportData);
    const urlWithParams = `${APPS_SCRIPT_URL}?action=savePassport&${searchParams.toString()}`;
    
    // If the GAS is expecting POST
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: searchParams.toString()
    });
    
    // We assume successful if no network error
    addToHistory(exportData);
    
    // Update Flow
    updateStep(4);
    UI.resultState.classList.add('hidden');
    UI.exportSuccess.classList.remove('hidden');
    
  } catch (err) {
    console.error('Export Error:', err);
    showToast('내보내기 실패. 네트워크 연결을 확인하세요.', 'error');
  } finally {
    UI.exportBtn.classList.remove('loading');
    UI.exportBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="3" y1="15" x2="21" y2="15"/>
        <line x1="9" y1="3" x2="9" y2="21"/>
      </svg>
      Google 스프레드시트로 내보내기
    `;
  }
}

// ===== History System =====

function loadHistory() {
  const saved = localStorage.getItem('passScan_history');
  if (saved) {
    try {
      AppState.history = JSON.parse(saved);
      renderHistory();
    } catch (e) {
      console.error('Failed to parse history', e);
    }
  }
}

function saveHistory() {
  localStorage.setItem('passScan_history', JSON.stringify(AppState.history));
  renderHistory();
}

function addToHistory(data) {
  // Insert at top
  AppState.history.unshift({
    id: Date.now().toString(),
    ...data
  });
  // Keep max 50 items
  if (AppState.history.length > 50) {
    AppState.history.pop();
  }
  saveHistory();
}

function clearHistory() {
  if (confirm('모든 스캔 기록을 삭제하시겠습니까?')) {
    AppState.history = [];
    saveHistory();
  }
}

function deleteHistoryItem(id) {
  AppState.history = AppState.history.filter(item => item.id !== id);
  saveHistory();
}

function renderHistory() {
  const count = AppState.history.length;
  UI.historyCount.textContent = count > 99 ? '99+' : count;
  
  if (count === 0) {
    UI.historyList.innerHTML = `
      <div class="empty-history">
        <p>아직 스캔 기록이 없습니다</p>
      </div>
    `;
    return;
  }
  
  UI.historyList.innerHTML = '';
  
  AppState.history.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    
    const date = new Date(item.scanned_at);
    const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    el.innerHTML = `
      <div class="history-item-icon">📄</div>
      <div class="history-item-info">
        <div class="history-item-name">${item.name}</div>
        <div class="history-item-meta">
          <span>${item.passport_num}</span>
          <span>•</span>
          <span>${dateStr}</span>
        </div>
      </div>
      <button class="history-item-delete" title="삭제" data-id="${item.id}">✕</button>
    `;
    
    // Make delete button work
    el.querySelector('.history-item-delete').addEventListener('click', (e) => {
      e.stopPropagation(); // prevent clicking the whole item
      deleteHistoryItem(item.id);
    });
    
    UI.historyList.appendChild(el);
  });
}

async function exportAllHistory() {
  if (AppState.history.length === 0) {
    showToast('내보낼 기록이 없습니다.', 'info');
    return;
  }
  
  // As 'no-cors' fetch cannot batch effectively without server support, 
  // you might want to create a CSV and download it locally for users, OR trigger multiple POSTs.
  // For demo: Download CSV locally
  
  let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; // With BOM for Excel
  csvContent += "Name,Passport No,Nationality,Sex,DOB,Expiry,Scanned At\n";
  
  AppState.history.forEach(row => {
    const date = new Date(row.scanned_at).toLocaleString();
    const line = `"${row.name}","${row.passport_num}","${row.nationality}","${row.sex}","${row.dob}","${row.expiry}","${date}"`;
    csvContent += line + "\n";
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `passScan_export_${new Date().getTime()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('전체 기록이 CSV 파일로 다운로드되었습니다.', 'success');
  toggleSidebar();
}

function toggleSidebar() {
  UI.historySidebar.classList.toggle('hidden');
  UI.sidebarOverlay.classList.toggle('hidden');
}

// ===== Toast Notification =====

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';
  
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${message}</div>
  `;
  
  UI.toastContainer.appendChild(toast);
  
  // Remove after animation (3.4s)
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3500);
}

// Start App
document.addEventListener('DOMContentLoaded', init);
