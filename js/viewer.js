// ==================== FORM VIEWER (User Side) ====================
let viewerForm = null;
let viewerAnswers = {};
let currentQuestionIndex = 0;
let viewerMode = 'one-by-one';
let uploadedFiles = {};

function loadFormViewer(form) {
  viewerForm = form;
  viewerAnswers = {};
  uploadedFiles = {};
  currentQuestionIndex = 0;
  viewerMode = form.displayMode || 'one-by-one';

  // Set header info
  document.getElementById('viewer-form-title').textContent = form.title;
  document.getElementById('viewer-form-desc').textContent = form.description || '';

  // Logo
  const logoEl = document.getElementById('form-logo-display');
  if (form.logo) {
    logoEl.innerHTML = `<img src="${form.logo}" alt="logo" style="width:80px;height:80px;object-fit:cover;border-radius:16px">`;
    logoEl.style.display = 'block';
  } else {
    logoEl.style.display = 'none';
  }

  renderViewerQuestions();
  updateProgress();

  const nav = document.getElementById('viewer-nav');
  const submitBtn = document.getElementById('submit-btn');

  if (viewerMode === 'all-at-once') {
    // Show all questions, hide nav
    document.querySelectorAll('.viewer-question').forEach(q => q.classList.add('all-visible'));
    nav.style.display = 'none';
    submitBtn.style.display = 'block';
    document.getElementById('progress-container')?.remove();
  } else {
    nav.style.display = 'flex';
    showQuestion(0);
  }
}

function renderViewerQuestions() {
  const container = document.getElementById('viewer-questions-container');
  const questions = viewerForm.questions || [];

  // Add name input first
  container.innerHTML = `
    <div class="viewer-question visible viewer-name-input" id="vq-name">
      <div class="vq-label"><i class="fas fa-user"></i> معلومات المشارك <span class="vq-required">*</span></div>
      <div class="vq-text">ما اسمك الكريم؟</div>
      <input type="text" class="vq-input" id="respondent-name" placeholder="أدخل اسمك..." oninput="viewerAnswers['_name'] = this.value" style="margin-bottom:1.5rem">
      <div class="vq-text">رقم الهاتف التواصل</div>
      <input type="tel" class="vq-input" id="respondent-phone" placeholder="أدخل رقم الهاتف..." oninput="viewerAnswers['_phone'] = this.value">
    </div>
    ${questions.map((q, idx) => buildViewerQuestion(q, idx)).join('')}
  `;

  buildNavDots(questions.length + 1);
}

function buildViewerQuestion(q, idx) {
  let inputHtml = '';

  if (q.type === 'multiple-choice' || q.type === 'true-false') {
    inputHtml = `<div class="vq-options">
      ${q.options.map(opt => `
        <div class="vq-option" id="opt-${opt.id}" onclick="selectOption('${q.id}', '${opt.id}')">
          <div class="vq-option-radio"></div>
          <span class="vq-option-text">${opt.text}</span>
        </div>`).join('')}
    </div>`;
  } else if (q.type === 'short-answer') {
    inputHtml = `<input type="text" class="vq-input" placeholder="اكتب إجابتك هنا..."
      oninput="viewerAnswers['${q.id}'] = this.value" id="inp-${q.id}">`;
  } else if (q.type === 'paragraph') {
    inputHtml = `<textarea class="vq-input" rows="5" placeholder="اكتب إجابتك هنا..."
      oninput="viewerAnswers['${q.id}'] = this.value" id="inp-${q.id}"></textarea>`;
  } else if (q.type === 'file-upload') {
    inputHtml = `
      <div class="vq-file-upload" onclick="document.getElementById('file-${q.id}').click()">
        <i class="fas fa-cloud-upload-alt"></i>
        <p>انقر لرفع صورة أو اسحبها هنا</p>
        <p style="font-size:.75rem;margin-top:.25rem">الرجاء رفع صورة (PNG, JPG)</p>
        <div id="file-name-${q.id}" style="margin-top:.75rem;font-size:.85rem;color:var(--primary)"></div>
      </div>
      <input type="file" id="file-${q.id}" accept="image/*" hidden onchange="handleFileUpload('${q.id}', this)">`;
  }

  const reqSpan = q.required ? `<span class="vq-required">*</span>` : '';
  return `
    <div class="viewer-question" id="vq-${q.id}" data-qid="${q.id}" data-idx="${idx + 1}">
      <div class="vq-label"><i class="fas fa-circle-dot"></i> سؤال ${idx + 1} ${reqSpan}</div>
      <div class="vq-text">${q.text || 'سؤال بدون نص'}</div>
      ${inputHtml}
    </div>`;
}

function selectOption(qId, optId) {
  viewerAnswers[qId] = optId;
  // Update UI
  const question = viewerForm.questions.find(q => q.id === qId);
  if (!question) return;
  question.options.forEach(opt => {
    const el = document.getElementById(`opt-${opt.id}`);
    if (el) el.classList.toggle('selected', opt.id === optId);
  });
}

function handleFileUpload(qId, input) {
  const file = input.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('عذراً، يرجى رفع ملفات صور فقط', 'error');
    return;
  }

  showToast('جاري معالجة الصورة...', 'info');
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 600; 
      const MAX_HEIGHT = 600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
      } else {
        if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6); 
      
      viewerAnswers[qId] = dataUrl;
      const previewEl = document.getElementById(`file-name-${qId}`);
      if (previewEl) {
        previewEl.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;justify-content:center;margin-top:10px;">
            <img src="${dataUrl}" style="max-height: 80px; border-radius: 8px; border: 1px solid var(--primary);">
            <span style="font-size:0.8rem;color:var(--success);font-weight:bold"><i class="fas fa-check"></i> تم إرفاق الصورة</span>
          </div>
        `;
      }
    };
    img.src = e.target.result;
  }
  reader.readAsDataURL(file);
}

function handleGeneralFileUpload(qId, input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    showToast('عذراً، الحد الأقصى للملف هو 10 ميجابايت', 'error');
    return;
  }

  showToast('جاري معالج الملف...', 'info');
  const reader = new FileReader();
  reader.onload = function(e) {
    const base64 = e.target.result;
    viewerAnswers[qId] = {
      name: file.name,
      type: file.type,
      data: base64
    };
    
    // Store just the base64 or a special object if we want to handle it in Sheets
    // For now, let's keep it consistent with images if it's meant for the same backend
    viewerAnswers[qId] = base64; 

    const previewEl = document.getElementById(`file-name-${qId}`);
    if (previewEl) {
      const icon = file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-lines';
      previewEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;justify-content:center;margin-top:10px; color:var(--primary)">
          <i class="fas ${icon} fa-2x"></i>
          <div style="text-align:right">
            <div style="font-weight:bold; font-size:0.85rem">${file.name}</div>
            <span style="font-size:0.7rem;color:var(--success)"><i class="fas fa-check"></i> جاهز للرفع</span>
          </div>
        </div>
      `;
    }
  }
  reader.readAsDataURL(file);
}

// -------- NAVIGATION --------
function showQuestion(idx) {
  const allQs = document.querySelectorAll('.viewer-question');
  allQs.forEach(q => q.classList.remove('visible'));

  if (allQs[idx]) allQs[idx].classList.add('visible');

  currentQuestionIndex = idx;
  updateProgress();
  updateNavButtons();
  updateNavDots();
}

function nextQuestion() {
  const allQs = document.querySelectorAll('.viewer-question');
  if (currentQuestionIndex < allQs.length - 1) {
    showQuestion(currentQuestionIndex + 1);
  }
}

function prevQuestion() {
  if (currentQuestionIndex > 0) {
    showQuestion(currentQuestionIndex - 1);
  }
}

function updateProgress() {
  if (!viewerForm) return;
  const total = (viewerForm.questions?.length || 0) + 1; // +1 for name
  const current = currentQuestionIndex + 1;
  const pct = Math.round((current / total) * 100);

  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  const pctEl = document.getElementById('progress-percent');

  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = `سؤال ${current} من ${total}`;
  if (pctEl) pctEl.textContent = pct + '%';
}

function updateNavButtons() {
  const allQs = document.querySelectorAll('.viewer-question');
  const total = allQs.length;
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  const submitBtn = document.getElementById('submit-btn');

  if (prevBtn) prevBtn.style.opacity = currentQuestionIndex === 0 ? '0.3' : '1';
  if (prevBtn) prevBtn.disabled = currentQuestionIndex === 0;

  const isLast = currentQuestionIndex === total - 1;
  if (nextBtn) nextBtn.style.display = isLast ? 'none' : 'flex';
  if (submitBtn) submitBtn.style.display = isLast ? 'block' : 'none';
}

function buildNavDots(total) {
  const dotsContainer = document.getElementById('nav-dots');
  if (!dotsContainer) return;
  dotsContainer.innerHTML = Array.from({ length: total }, (_, i) =>
    `<div class="nav-dot ${i === 0 ? 'active' : ''}" onclick="showQuestion(${i})"></div>`
  ).join('');
}

function updateNavDots() {
  document.querySelectorAll('.nav-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === currentQuestionIndex);
  });
}

// -------- SUBMIT --------
function submitForm() {
  if (!viewerForm) return;

  const name = document.getElementById('respondent-name')?.value?.trim();
  const phone = document.getElementById('respondent-phone')?.value?.trim();
  
  if (!name) { showToast('يرجى إدخال اسمك أولاً', 'error'); showQuestion(0); return; }
  if (!phone) { showToast('يرجى إدخال رقم الهاتف', 'error'); showQuestion(0); return; }

  // Validate required
  for (const q of viewerForm.questions) {
    if (q.required && !viewerAnswers[q.id]) {
      showToast(`يرجى الإجابة على السؤال: "${q.text}"`, 'error');
      const qEl = document.getElementById(`vq-${q.id}`);
      if (qEl) {
        const idx = +qEl.dataset.idx;
        showQuestion(idx);
      }
      return;
    }
  }

  // Calculate score
  let score = 0, totalPoints = 0;
  viewerForm.questions.forEach(q => {
    totalPoints += (q.points || 0);
    if ((q.type === 'multiple-choice' || q.type === 'true-false') && q.points > 0) {
      const selectedOptId = viewerAnswers[q.id];
      const selectedOpt = q.options.find(o => o.id === selectedOptId);
      if (selectedOpt?.correct) score += q.points;
    }
  });

  // Anti-duplicate check (same name + same form in last 10 min)
  const recentResponses = DB.getResponsesByForm(viewerForm.id);
  const tenMinAgo = Date.now() - 600000;
  const duplicate = recentResponses.find(r =>
    r.respondentName === name && new Date(r.submittedAt).getTime() > tenMinAgo
  );
  if (duplicate) {
    showToast('لقد قدمت إجابة مؤخراً. يرجى الانتظار قبل الإرسال مرة أخرى.', 'warning');
    return;
  }

  const response = {
    id: DB.generateId(),
    formId: viewerForm.id,
    respondentName: name,
    respondentPhone: phone,
    answers: { ...viewerAnswers },
    score,
    totalPoints,
    submittedAt: new Date().toISOString()
  };

  DB.addResponse(response);
  const targetWebhook = viewerForm.webhookUrl || (typeof MASTER_SYNC_URL !== 'undefined' ? MASTER_SYNC_URL : null);
  if (targetWebhook) {
    sendToGoogleSheets(response, viewerForm, targetWebhook);
  }
  if (typeof pushToCloudAuto === 'function') pushToCloudAuto();
  showResultPage(response, viewerForm);
}

function sendToGoogleSheets(response, form, targetWebhook) {
  // Prepare data for Google Sheets
  const sheetData = {
    respondentName: response.respondentName,
    respondentPhone: response.respondentPhone,
    formTitle: form.title,
    scoreText: response.totalPoints > 0 ? `${response.score}/${response.totalPoints}` : '-',
    submittedAt: new Date(response.submittedAt).toLocaleString('ar-SA'),
    details: {}
  };

  // Add question-answer pairs
  form.questions.forEach(q => {
    let ans = response.answers[q.id];
    if (q.type === 'multiple-choice' || q.type === 'true-false') {
      ans = q.options.find(o => o.id === ans)?.text || '-';
    }
    sheetData.details[q.text] = ans || '-';
  });

  // Flat version for simpler sheet scripts
  const flatData = {
    'الاسم': sheetData.respondentName,
    'الهاتف': sheetData.respondentPhone,
    'النموذج': sheetData.formTitle,
    'النتيجة': sheetData.scoreText,
    'التاريخ': sheetData.submittedAt,
    ...sheetData.details
  };

  const payload = {
    type: 'individual_response',
    flatData: flatData,
    rawResponse: response
  };

  fetch(targetWebhook, {
    method: 'POST',
    mode: 'no-cors', 
    cache: 'no-cache',
    body: JSON.stringify(payload)
  }).catch(e => console.error('Error sending to Google Sheets:', e));
}

function showResultPage(response, form) {
  showPage('result-page');

  const isQuiz = form.type === 'quiz';
  const totalPoints = response.totalPoints || 0;
  const pct = totalPoints > 0 ? Math.round((response.score / totalPoints) * 100) : 0;

  const titleEl = document.getElementById('result-title');
  const msgEl = document.getElementById('result-message');
  const scoreEl = document.getElementById('result-score-value');
  const detailsEl = document.getElementById('result-details');
  const circleEl = document.getElementById('result-progress-circle');

  // Logic: Only show score if it's a quiz AND showScore setting is NOT explicitly false
  const showScore = isQuiz && (form.showScore !== false);
  
  titleEl.textContent = showScore
    ? (pct >= 70 ? 'أحسنت! نتيجة ممتازة 🎉' : pct >= 50 ? 'جيد! يمكنك التحسين 💪' : 'حاول مرة أخرى 📚')
    : 'شكراً لمشاركتك! 🎉';

  msgEl.textContent = showScore
    ? `حصلت على ${response.score} من ${response.totalPoints} نقطة`
    : 'تم إرسال إجاباتك بنجاح';

  scoreEl.textContent = showScore ? pct + '%' : '✓';

  // Animate circle
  if (showScore) {
    const circumference = 283;
    const offset = circumference - (pct / 100) * circumference;
    setTimeout(() => {
      if (circleEl) {
        circleEl.style.strokeDashoffset = offset;
        circleEl.style.stroke = pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
      }
    }, 300);
  } else {
    if (circleEl) { 
      circleEl.style.strokeDashoffset = 0; 
      circleEl.style.stroke = 'var(--primary)';
    }
  }

  const date = new Date(response.submittedAt).toLocaleString('ar-SA');
  detailsEl.innerHTML = `
    <div class="result-detail-row">
      <span class="result-detail-label">الاسم</span>
      <span class="result-detail-value">${response.respondentName}</span>
    </div>
    <div class="result-detail-row">
      <span class="result-detail-label">رقم الهاتف</span>
      <span class="result-detail-value">${response.respondentPhone || '-'}</span>
    </div>
    <div class="result-detail-row">
      <span class="result-detail-label">النموذج</span>
      <span class="result-detail-value">${form.title}</span>
    </div>
    ${showScore ? `<div class="result-detail-row">
      <span class="result-detail-label">النتيجة</span>
      <span class="result-detail-value" style="color:${pct >= 70 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)'}">${response.score}/${totalPoints}</span>
    </div>` : ''}
    <div class="result-detail-row">
      <span class="result-detail-label">وقت الإرسال</span>
      <span class="result-detail-value">${date}</span>
    </div>
  `;

  // Show PDF download button if enabled
  const pdfBtn = document.getElementById('pdf-download-container');
  if (form.showPdfDownload !== false) { // Default to true if undefined
    pdfBtn.style.display = 'block';
    window.currentSubmission = { response, form };
  } else {
    pdfBtn.style.display = 'none';
  }

  // Reload responses table if admin dashboard is open
  if (Auth.isAdmin()) {
    updateBadgeCounts();
    renderResponses();
    renderOverview();
  }
}

async function generateAndDownloadPdf(response, form) {
  if (!response || !form) {
    showToast('لم يتم العثور على بيانات الإجابة', 'error');
    return;
  }

  const template = document.getElementById('pdf-template');
  template.style.display = 'block';
  
  // Fill data
  document.getElementById('pdf-form-title').textContent = form.title;
  document.getElementById('pdf-participant-info').textContent = `${response.respondentName} • ${response.respondentPhone || ''}`;
  
  const scoreText = form.type === 'quiz' ? `${response.score} / ${response.totalPoints}` : 'تم التسليم بنجاح';
  document.getElementById('pdf-score-text').textContent = scoreText;

  const logoEl = document.getElementById('pdf-logo');
  logoEl.innerHTML = form.logo ? `<img src="${form.logo}" style="max-height: 80px;">` : '<h2 style="color:var(--primary)">FormFlow</h2>';

  const questionsList = document.getElementById('pdf-questions-list');
  questionsList.innerHTML = '';

  form.questions.forEach((q, i) => {
    const ans = response.answers[q.id];
    let ansText = ans || '-';
    let isCorrect = true;
    let correctText = '';

    if (q.type === 'multiple-choice' || q.type === 'true-false') {
      const selected = q.options.find(o => o.id === ans);
      ansText = selected ? selected.text : '-';
      const correct = q.options.find(o => o.correct);
      isCorrect = selected ? selected.correct : false;
      correctText = correct ? correct.text : '-';
    }

    let ansHtml = '';
    if (q.type === 'file-upload' && ans && (ans.startsWith('data:image') || ans.startsWith('http'))) {
      ansHtml = `<div style="text-align: center; margin-top: 10px;"><img src="${ans}" style="max-width: 250px; max-height: 250px; border-radius: 8px; border: 1px solid #ddd;"></div>`;
      ansText = '';
    } else {
      ansHtml = `<span style="font-weight: 500">${ansText}</span>`;
    }

    const item = document.createElement('div');
    item.style.marginBottom = '20px';
    item.style.padding = '15px';
    item.style.border = '1px solid #eee';
    item.style.borderRadius = '8px';
    item.style.textAlign = 'right';
    item.style.direction = 'rtl';
    
    let statusHtml = '';
    // Check if it's a quiz question (has points or is multiple choice with a correct answer)
    const hasCorrectAnswer = q.options && q.options.some(o => o.correct);
    const hasPoints = q.points > 0;

    if (hasPoints || hasCorrectAnswer) {
      statusHtml = isCorrect 
        ? `<span style="color: #27ae60; font-weight: bold; margin-right: 15px;">✓ إجابة صحيحة</span>`
        : `<span style="color: #e74c3c; font-weight: bold; margin-right: 15px;">✗ إجابة خاطئة</span>`;
    }

    item.innerHTML = `
      <div style="margin-bottom: 10px; font-weight: 700;">س ${i+1}: ${q.text} ${statusHtml}</div>
      <div style="background: #fdfdfd; padding: 8px; border-radius: 4px; border: 1px dashed #ddd;">
        <span style="color: #7f8c8d;">إجابتك:</span> ${ansHtml}
      </div>
      ${(!isCorrect && (hasPoints || hasCorrectAnswer)) ? `
      <div style="color: #27ae60; margin-top: 8px; font-size: 0.95rem; font-weight: 600;">
         💡 الإجابة الصحيحة: ${correctText}
      </div>` : ''}
    `;
    questionsList.appendChild(item);
  });

  const opt = {
    margin: [10, 10],
    filename: `تقرير_${response.respondentName}_${form.title}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    showToast('جاري إنشاء ملف PDF...', 'info');
    await html2pdf().set(opt).from(template).save();
    showToast('تم تحميل الملف بنجاح', 'success');
  } catch (err) {
    console.error(err);
    showToast('فشل إنشاء ملف PDF', 'error');
  } finally {
    template.style.display = 'none';
  }
}

async function downloadResponsePdf() {
  const { response, form } = window.currentSubmission || {};
  if (!response || !form) return;
  await generateAndDownloadPdf(response, form);
}

async function downloadAdminPdf(respId) {
  const resp = DB.getResponses().find(r => r.id === respId);
  if (!resp) return;
  const form = DB.getFormById(resp.formId);
  if (!form) return;
  await generateAndDownloadPdf(resp, form);
}

function retakeForm() {
  if (!viewerForm) { showPage('login-page'); return; }
  viewerAnswers = {};
  uploadedFiles = {};
  currentQuestionIndex = 0;

  // Reset inputs
  document.querySelectorAll('.vq-option').forEach(o => o.classList.remove('selected'));
  document.querySelectorAll('.vq-input').forEach(i => i.value = '');
  document.getElementById('respondent-name').value = '';
  document.getElementById('respondent-phone').value = '';

  if (viewerMode === 'one-by-one') showQuestion(0);
  showPage('form-viewer');
}
