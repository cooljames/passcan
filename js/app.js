// ===== App State =====
window.addEventListener('unhandledrejection', function(e) {
  const msg = e.reason && e.reason.message ? e.reason.message : e.reason;
  alert('OCR 로딩/실행 오류: ' + msg + '\n인터넷 연결을 확인하거나 새로고침 후 다시 시도해주세요.');
});

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
  
  // Settings
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  settingsClose: document.getElementById('settingsClose'),
  geminiApiKey: document.getElementById('geminiApiKey'),
  geminiModel: document.getElementById('geminiModel'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  
  // Toast
  toastContainer: document.getElementById('toastContainer'),
};


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
  UI.exportBtn.addEventListener('click', exportToExcel);
  
  // Sidebar
  UI.historyBtn.addEventListener('click', toggleSidebar);
  UI.sidebarClose.addEventListener('click', toggleSidebar);
  UI.sidebarOverlay.addEventListener('click', toggleSidebar);
  UI.clearHistoryBtn.addEventListener('click', clearHistory);
  UI.exportAllFromSidebar.addEventListener('click', exportAllHistory);

  // Settings
  if (UI.settingsBtn) UI.settingsBtn.addEventListener('click', openSettings);
  if (UI.settingsClose) UI.settingsClose.addEventListener('click', closeSettings);
  if (UI.saveSettingsBtn) UI.saveSettingsBtn.addEventListener('click', saveSettings);
}

function openSettings() {
  const existingKey = localStorage.getItem('passScan_gemini_key') || '';
  const existingModel = localStorage.getItem('passScan_gemini_model') || 'auto';
  UI.geminiApiKey.value = existingKey;
  if(UI.geminiModel) UI.geminiModel.value = existingModel;
  UI.settingsModal.classList.remove('hidden');
}
function closeSettings() {
  UI.settingsModal.classList.add('hidden');
}
function saveSettings() {
  const val = UI.geminiApiKey.value.trim();
  const modelVal = UI.geminiModel ? UI.geminiModel.value : 'auto';
  localStorage.setItem('passScan_gemini_key', val);
  localStorage.setItem('passScan_gemini_model', modelVal);
  closeSettings();
  showToast('설정이 저장되었습니다.', 'success');
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
    
    // 3. Compress Image (downscale to save bandwidth while keeping details)
    updateProgress(10, '이미지 최적화 중...');
    const compressedImage = await compressImage(file, 2048);
    
    // 4. Run AI Analysis
    const parseResult = await analyzeWithGemini(compressedImage);
    
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

async function analyzeWithGemini(base64Data) {
  const apiKey = localStorage.getItem('passScan_gemini_key');
  if (!apiKey) {
    throw new Error('Gemini API 키가 설정되지 않았습니다. 우측 상단의 ⚙️ 설정에서 키를 등록해주세요.');
  }

  updateProgress(30, 'Gemini AI로 이미지 전송 중...');

  // Remove the data URL prefix
  const base64Image = base64Data.split(',')[1];

  const prompt = `
Extract information from this passport or ID card. Respond with a JSON object ONLY, containing exactly these keys:
{
  "documentType": (String, e.g. "PASSPORT", "ID CARD"),
  "issuingCountry": (String, 3-letter code e.g. "MYS", "KOR", "USA"),
  "surname": (String, surname or primary identifier),
  "givenNames": (String, given names. Leave empty string if not applicable),
  "fullName": (String, full name),
  "passportNo": (String, passport or ID number),
  "nationality": (String, 3-letter country code),
  "dateOfBirth": (String, YYYY-MM-DD format),
  "sex": (String, "M" for Male or "F" for Female),
  "dateOfExpiry": (String, YYYY-MM-DD format),
  "mrzLine1": (String, exact MRZ row 1, if visible),
  "mrzLine2": (String, exact MRZ row 2, if visible)
}
IMPORTANT: Provide valid JSON ONLY, without any markdown formatting wrappers like \`\`\`json.
  `;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.1,
    }
  };

  let response;
  let errorData;
  const selectedModel = localStorage.getItem('passScan_gemini_model') || 'auto';
  
  // Fallback models in case of high demand (503) or rate limits (429)
  let models = ['gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  if (selectedModel !== 'auto') {
    models = [selectedModel];
  }
  
  for (const model of models) {
    updateProgress(60, `AI 분석 중... (${model})`);
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        break; // Success
      }

      errorData = await response.json();
      // If server is overloaded (503) or rate limited (429), try the next model
      if (response.status === 503 || response.status === 429) {
        console.warn(`${model} is overloaded (${response.status}), trying next model...`);
        continue;
      }
      
      // Stop and throw on hard errors (like bad API key)
      throw new Error(`API 요청 실패 (${response.status}): ${errorData.error?.message || '알 수 없는 오류'}`);
    } catch (err) {
      if (model === models[models.length - 1]) {
        throw err; // Re-throw if all models failed
      }
      console.warn(`Error with ${model}:`, err);
    }
  }

  if (!response || !response.ok) {
    throw new Error(`모든 AI 모델 서버가 혼잡 상태입니다. 잠시 후 다시 시도해주세요.`);
  }

  const data = await response.json();
  const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textResponse) {
    throw new Error('의미 있는 응답을 받지 못했습니다.');
  }

  updateProgress(85, '데이터 파싱 중...');

  try {
    // Clean up markdown just in case
    const jsonString = textResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonString);
    
    return formatGeminiResult(parsed);
  } catch (e) {
    throw new Error('분석 결과를 파싱하는 도중 오류가 발생했습니다. (JSON 형식 오류)');
  }
}

function formatGeminiResult(g) {
  const formatDate = (dateStr) => {
    if (!dateStr || dateStr.length < 10) return '—';
    return dateStr.replace(/-/g, '.');
  };

  return {
    success: true,
    data: {
      type: g.documentType || 'PASSPORT',
      issuingCountry: g.issuingCountry || g.nationality || '',
      issuingCountryName: COUNTRY_MAP[g.issuingCountry] || g.issuingCountry || '',
      surname: g.surname || '',
      givenNames: g.givenNames || '',
      fullName: g.fullName || `${g.surname || ''} ${g.givenNames || ''}`.trim(),
      passportNo: g.passportNo || '',
      nationality: g.nationality || '',
      nationalityName: COUNTRY_MAP[g.nationality] || g.nationality || '',
      dateOfBirth: g.dateOfBirth,
      dateOfBirthFormatted: formatDate(g.dateOfBirth),
      sex: g.sex === 'M' ? 'M' : g.sex === 'F' ? 'F' : '—',
      sexDisplay: g.sex === 'M' ? '남 (M)' : g.sex === 'F' ? '여 (F)' : '—',
      dateOfExpiry: g.dateOfExpiry,
      dateOfExpiryFormatted: formatDate(g.dateOfExpiry),
      personalNo: '',
      mrzLine1: g.mrzLine1 || '—',
      mrzLine2: g.mrzLine2 || '—',
      validation: {
        passportNoValid: true,
        dobValid: true,
        expiryValid: true
      }
    }
  };
}

// Country code to name mapping (common ones)
const COUNTRY_MAP = {
  'KOR': '대한민국 (REPUBLIC OF KOREA)',
  'USA': 'UNITED STATES',
  'GBR': 'UNITED KINGDOM',
  'JPN': 'JAPAN',
  'CHN': 'CHINA',
  'DEU': 'GERMANY',
  'FRA': 'FRANCE',
  'CAN': 'CANADA',
  'AUS': 'AUSTRALIA',
  'IND': 'INDIA',
  'MYS': 'MALAYSIA',
  'SGP': 'SINGAPORE',
  'IDN': 'INDONESIA',
  'PHL': 'PHILIPPINES',
  'VNM': 'VIETNAM',
  'THA': 'THAILAND'
};


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

async function exportToExcel() {
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
  UI.exportBtn.textContent = '생성 중...';
  
  try {
    addToHistory(exportData);
    
    // Generate Excel file using SheetJS
    const formattedData = [{
      "성명 (Name)": exportData.name,
      "여권번호 (Passport No)": exportData.passport_num,
      "국적 (Nationality)": exportData.nationality,
      "성별 (Sex)": exportData.sex,
      "생년월일 (DOB)": exportData.dob,
      "만료일 (Expiry)": exportData.expiry,
      "스캔 일시 (Scanned At)": new Date(exportData.scanned_at).toLocaleString()
    }];
    
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "여권정보");
    
    // Trigger download
    XLSX.writeFile(wb, `Passport_${exportData.name || 'Data'}.xlsx`);
    
    // Update Flow
    updateStep(4);
    UI.resultState.classList.add('hidden');
    UI.exportSuccess.classList.remove('hidden');
    
  } catch (err) {
    console.error('Export Error:', err);
    showToast('Excel 내보내기 중 문제가 발생했습니다.', 'error');
  } finally {
    UI.exportBtn.classList.remove('loading');
    UI.exportBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Excel 파일(.xlsx) 다운로드
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
  
  try {
    const formattedData = AppState.history.map(row => ({
      "성명 (Name)": row.name,
      "여권번호 (Passport No)": row.passport_num,
      "국적 (Nationality)": row.nationality,
      "성별 (Sex)": row.sex,
      "생년월일 (DOB)": row.dob,
      "만료일 (Expiry)": row.expiry,
      "스캔 일시 (Scanned At)": new Date(row.scanned_at).toLocaleString()
    }));
    
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "여권전체기록");
    
    // Trigger download
    XLSX.writeFile(wb, `Passport_All_Records_${new Date().getTime()}.xlsx`);
    showToast('전체 기록이 Excel 파일로 다운로드되었습니다.', 'success');
    toggleSidebar();
    
  } catch (err) {
    console.error('Export All Error:', err);
    showToast('Excel 내보내기 중 문제가 발생했습니다.', 'error');
  }
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
