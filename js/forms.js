// ==================== FORMS MANAGEMENT ====================
let editingFormId = null;
let currentQuestions = [];
let dragSrcIndex = null;
let formLogoData = null;
let currentStatusFilter = 'all';

// -------- RENDER FORMS LIST --------
function renderForms() {
  const forms = DB.getForms();
  const grid = document.getElementById('forms-grid');
  const search = (document.getElementById('forms-search')?.value || '').toLowerCase();

  let filtered = forms.filter(f => {
    const matchSearch = !search || f.title.toLowerCase().includes(search) || (f.description || '').toLowerCase().includes(search);
    const matchStatus = currentStatusFilter === 'all' || (currentStatusFilter === 'active' ? f.active : !f.active);
    return matchSearch && matchStatus;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon"><i class="fas fa-file-circle-plus"></i></div>
        <h3>${search ? 'لا توجد نتائج' : 'لا توجد نماذج'}</h3>
        <p>${search ? 'جرّب بحثاً مختلفاً' : 'ابدأ بإنشاء نموذجك الأول الآن'}</p>
        ${!search ? `<button class="btn btn-primary" onclick="showSection('create-form')"><i class="fas fa-plus"></i> إنشاء نموذج</button>` : ''}
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(form => {
    const responses = DB.getResponsesByForm(form.id).length;
    const logoHtml = form.logo
      ? `<img src="${form.logo}" alt="logo">`
      : `<i class="fas fa-file-alt"></i>`;
    const typeLabel = form.type === 'quiz' ? 'اختبار' : 'استبيان';
    const typeIcon = form.type === 'quiz' ? 'fa-graduation-cap' : 'fa-poll';
    const statusClass = form.active ? 'status-active' : 'status-inactive';
    const statusLabel = form.active ? 'نشط' : 'معطّل';
    const statusIcon = form.active ? 'fa-circle-check' : 'fa-circle-xmark';
    const qCount = (form.questions || []).length;

    return `
      <div class="form-card" id="fcard-${form.id}">
        <div class="form-card-header">
          <div class="form-card-logo">${logoHtml}</div>
          <div class="form-card-info">
            <div class="form-card-title">${form.title}</div>
            <div class="form-card-desc">${form.description || 'لا يوجد وصف'}</div>
          </div>
        </div>
        <div class="form-card-body">
          <div class="form-meta-row">
            <span class="meta-tag type"><i class="fas ${typeIcon}"></i> ${typeLabel}</span>
            <span class="meta-tag count" onclick="editForm('${form.id}')" style="cursor:pointer" title="تعديل الأسئلة">
              <i class="fas fa-question-circle"></i> ${qCount} سؤال
            </span>
            <span class="meta-tag count"><i class="fas fa-users"></i> ${responses} إجابة</span>
            <span class="meta-tag ${statusClass}"><i class="fas ${statusIcon}"></i> ${statusLabel}</span>
          </div>
          <div class="form-card-actions">
            <button class="icon-btn" title="معاينة النموذج" onclick="previewForm('${form.id}')"><i class="fas fa-eye"></i></button>
            <button class="icon-btn" title="نسخ الرابط" onclick="copyFormLink('${form.id}')"><i class="fas fa-link"></i></button>
            <button class="icon-btn" title="مشاركة رابط الإكسيل" onclick="copySheetLink('${form.id}')"><i class="fas fa-file-excel" style="color: #27ae60"></i></button>
            <button class="icon-btn" title="تكرار النموذج" onclick="copyFullForm('${form.id}')"><i class="fas fa-copy"></i></button>
            <button class="icon-btn" title="عرض الإجابات" onclick="viewFormResponses('${form.id}')"><i class="fas fa-poll"></i></button>
            <button class="icon-btn" title="تعديل" onclick="editForm('${form.id}')"><i class="fas fa-edit"></i></button>
            <button class="icon-btn" title="${form.active ? 'تعطيل' : 'تفعيل'}" onclick="toggleFormStatus('${form.id}')">
              <i class="fas ${form.active ? 'fa-toggle-on' : 'fa-toggle-off'}" style="color:${form.active ? 'var(--success)' : ''}"></i>
            </button>
            <button class="icon-btn danger" title="حذف" onclick="deleteForm('${form.id}')"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function filterForms() { renderForms(); }
function filterByStatus(status, btn) {
  currentStatusFilter = status;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderForms();
}

// -------- CLONE FORM --------
function copyFullForm(id) {
  const form = DB.getFormById(id);
  if (!form) return;

  const newForm = JSON.parse(JSON.stringify(form));
  newForm.id = DB.generateId();
  newForm.title = newForm.title + ' (نسخة)';
  newForm.slug = DB.generateSlug(newForm.title);
  newForm.createdAt = newForm.updatedAt = new Date().toISOString();
  
  if (newForm.questions) {
    newForm.questions.forEach(q => {
      q.id = DB.generateId();
      if (q.options) {
        q.options.forEach(opt => opt.id = DB.generateId());
      }
    });
  }

  DB.addForm(newForm);
  showToast('تم نسخ النموذج بنجاح', 'success');
  renderForms();
  updateBadgeCounts();
  renderOverview();
  if (typeof pushToCloudAuto === 'function') pushToCloudAuto();
}

// -------- SAVE FORM --------
function saveForm() {
  const title = document.getElementById('form-title').value.trim();
  if (!title) { showToast('يرجى إدخال عنوان النموذج', 'error'); return; }
  if (currentQuestions.length === 0) { showToast('أضف سؤالاً واحداً على الأقل', 'error'); return; }

  const formData = {
    title,
    description: document.getElementById('form-description').value.trim(),
    type: document.getElementById('form-type').value,
    displayMode: document.getElementById('form-display-mode').value,
    active: document.getElementById('form-active').checked,
    showScore: document.getElementById('form-show-score')?.checked ?? true,
    showPdfDownload: document.getElementById('form-show-pdf').checked,
    webhookUrl: document.getElementById('form-webhook').value.trim(),
    sheetUrl: document.getElementById('form-sheet-url').value.trim(),
    logo: formLogoData,
    questions: currentQuestions,
    updatedAt: new Date().toISOString()
  };

  if (editingFormId) {
    DB.updateForm(editingFormId, formData);
    showToast('تم تحديث النموذج بنجاح', 'success');
  } else {
    const newForm = {
      id: DB.generateId(),
      slug: DB.generateSlug(title),
      createdBy: Auth.currentUser.id,
      createdAt: new Date().toISOString(),
      ...formData
    };
    DB.addForm(newForm);
    showToast('تم إنشاء النموذج بنجاح!', 'success');
  }
  
  if (typeof pushToCloudAuto === 'function') pushToCloudAuto();

  editingFormId = null;
  currentQuestions = [];
  formLogoData = null;
  updateBadgeCounts();
  showSection('forms');
}

// -------- EDIT FORM --------
function editForm(id) {
  const form = DB.getFormById(id);
  if (!form) return;
  editingFormId = id;
  currentQuestions = JSON.parse(JSON.stringify(form.questions || []));
  formLogoData = form.logo;

  document.getElementById('form-editor-title').textContent = 'تعديل النموذج';
  document.getElementById('form-title').value = form.title;
  document.getElementById('form-description').value = form.description || '';
  document.getElementById('form-type').value = form.type || 'survey';
  document.getElementById('form-display-mode').value = form.displayMode || 'one-by-one';
  document.getElementById('form-active').checked = form.active !== false;
  document.getElementById('form-show-score').checked = form.showScore !== false;
  document.getElementById('form-show-pdf').checked = form.showPdfDownload !== false;
  document.getElementById('form-webhook').value = form.webhookUrl || '';
  document.getElementById('form-sheet-url').value = form.sheetUrl || '';

  const preview = document.getElementById('form-logo-preview');
  if (form.logo) preview.innerHTML = `<img src="${form.logo}" alt="logo">`;
  else preview.innerHTML = '<i class="fas fa-image"></i><span>إضافة شعار</span>';

  renderQuestions();
  showSection('create-form');
}

function deleteForm(id) {
  openModal('حذف النموذج', '<p style="color:var(--text-muted)">هل أنت متأكد من حذف هذا النموذج؟ سيتم حذف جميع الإجابات المرتبطة به.</p>',
    `<button class="btn btn-ghost" onclick="closeModal()">إلغاء</button>
     <button class="btn btn-danger" onclick="confirmDeleteForm('${id}')"><i class="fas fa-trash"></i> حذف</button>`
  );
}

function confirmDeleteForm(id) {
  DB.deleteForm(id);
  closeModal();
  showToast('تم حذف النموذج', 'success');
  renderForms();
  updateBadgeCounts();
  renderOverview();
  if (typeof pushToCloudAuto === 'function') pushToCloudAuto();
}

function toggleFormStatus(id) {
  const form = DB.getFormById(id);
  if (!form) return;
  DB.updateForm(id, { active: !form.active });
  showToast(form.active ? 'تم تعطيل النموذج' : 'تم تفعيل النموذج', 'success');
  renderForms();
  renderOverview();
  if (typeof pushToCloudAuto === 'function') pushToCloudAuto();
}

function previewForm(id) {
  const form = DB.getFormById(id);
  if (!form) return;
  if (!form.active) { showToast('النموذج غير نشط حالياً', 'warning'); return; }
  loadFormViewer(form);
  showPage('form-viewer');
}

function copyFormLink(id) {
  const form = DB.getFormById(id);
  if (!form) return;
  const link = `${window.location.origin}${window.location.pathname}?form=${form.slug}`;
  
  const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      return new Promise((res, rej) => {
        document.execCommand('copy') ? res() : rej();
        textArea.remove();
      });
    }
  };

  copyToClipboard(link)
    .then(() => showToast('تم نسخ الرابط بنجاح!', 'success'))
    .catch(() => {
      openModal('رابط النموذج', `
        <div class="form-group">
          <label>لم نتمكن من النسخ تلقائياً، يرجى نسخه يدوياً:</label>
          <input type="text" class="form-control" value="${link}" readonly onclick="this.select()">
        </div>`,
        '<button class="btn btn-primary" onclick="closeModal()">موافق</button>'
      );
    });
}

function copySheetLink(id) {
  const form = DB.getFormById(id);
  if (!form) return;
  if (!form.sheetUrl) {
    showToast('الرجاء إضافة رابط الإكسيل في إعدادات النموذج أولاً', 'warning');
    return;
  }
  
  const link = form.sheetUrl;
  
  const copyToClipboard = (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      return new Promise((res, rej) => {
        document.execCommand('copy') ? res() : rej();
        textArea.remove();
      });
    }
  };

  copyToClipboard(link)
    .then(() => showToast('تم نسخ رابط الإكسيل بنجاح!', 'success'))
    .catch(() => {
      openModal('رابط الإكسيل', `
        <div class="form-group">
          <label>لم نتمكن من النسخ تلقائياً، يرجى نسخه يدوياً:</label>
          <input type="text" class="form-control" value="${link}" readonly onclick="this.select()">
        </div>`,
        '<button class="btn btn-primary" onclick="closeModal()">موافق</button>'
      );
    });
}

function viewFormResponses(formId) {
  document.getElementById('response-form-filter').value = formId;
  loadResponsesByForm();
  showSection('responses');
}

// -------- QUESTIONS --------
function addQuestion(type) {
  const q = {
    id: DB.generateId(),
    type,
    text: '',
    required: false,
    points: type !== 'short-answer' && type !== 'paragraph' && type !== 'file-upload' ? 10 : 0,
    options: [],
    isCollapsed: false
  };

  if (type === 'multiple-choice') {
    q.options = [
      { id: DB.generateId(), text: 'الخيار الأول', correct: false },
      { id: DB.generateId(), text: 'الخيار الثاني', correct: false }
    ];
  } else if (type === 'true-false') {
    q.options = [
      { id: DB.generateId(), text: 'صح', correct: false },
      { id: DB.generateId(), text: 'خطأ', correct: false }
    ];
  }

  currentQuestions.push(q);
  renderQuestions();
  setTimeout(() => {
    const cards = document.querySelectorAll('.question-card');
    cards[cards.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function renderQuestions() {
  const container = document.getElementById('questions-container');
  if (currentQuestions.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = currentQuestions.map((q, idx) => buildQuestionCard(q, idx)).join('');
  initDragDrop();
}

function buildQuestionCard(q, idx) {
  const typeNames = {
    'multiple-choice': 'اختيار متعدد',
    'true-false': 'صح أو خطأ',
    'short-answer': 'إجابة قصيرة',
    'paragraph': 'فقرة',
    'file-upload': 'رفع صورة',
    'file-upload-general': 'رفع ملف'
  };
  const typeIcons = {
    'multiple-choice': 'fa-list-ul',
    'true-false': 'fa-check-double',
    'short-answer': 'fa-minus',
    'paragraph': 'fa-align-right',
    'file-upload': 'fa-upload',
    'file-upload-general': 'fa-file-arrow-up'
  };

  const typeOptions = Object.entries(typeNames).map(([val, label]) =>
    `<option value="${val}" ${q.type === val ? 'selected' : ''}>${label}</option>`
  ).join('');

  const formType = document.getElementById('form-type')?.value || 'survey';
  const showPoints = formType === 'quiz' && (q.type === 'multiple-choice' || q.type === 'true-false');

  let optionsHtml = '';
  if (q.type === 'multiple-choice' || q.type === 'true-false') {
    const isTF = q.type === 'true-false';
    optionsHtml = `
      <div class="q-options-list">
        ${q.options.map((opt, oi) => `
          <div class="q-option-item">
            <div class="option-radio"></div>
            <input type="text" class="option-input" value="${opt.text}" ${isTF ? 'readonly' : ''}
              oninput="updateOption('${q.id}', '${opt.id}', 'text', this.value)" placeholder="خيار...">
            <button class="option-correct-btn ${opt.correct ? 'correct' : ''}" title="تعيين كإجابة صحيحة"
              onclick="setCorrectOption('${q.id}', '${opt.id}')">
              <i class="fas fa-check"></i>
            </button>
            ${!isTF ? `<button class="delete-option-btn" onclick="deleteOption('${q.id}','${opt.id}')"><i class="fas fa-times"></i></button>` : ''}
          </div>
        `).join('')}
        ${!isTF ? `<button class="add-option-btn" onclick="addOption('${q.id}')"><i class="fas fa-plus"></i> إضافة خيار</button>` : ''}
      </div>`;
  } else if (q.type === 'short-answer') {
    optionsHtml = `<input type="text" class="form-control" placeholder="(حقل الإجابة القصيرة - للمعاينة فقط)" disabled style="opacity:.5">`;
  } else if (q.type === 'paragraph') {
    optionsHtml = `<textarea class="form-control" rows="3" placeholder="(حقل الفقرة - للمعاينة فقط)" disabled style="opacity:.5"></textarea>`;
  } else if (q.type === 'file-upload') {
    optionsHtml = `<div class="vq-file-upload" style="pointer-events:none;opacity:.5"><i class="fas fa-image"></i><p>أداة لرفع الصور فقط</p></div>`;
  } else if (q.type === 'file-upload-general') {
    optionsHtml = `<div class="vq-file-upload" style="pointer-events:none;opacity:.5"><i class="fas fa-file-arrow-up"></i><p>أداة لرفع هافة الملفات (PDF, Word...)</p></div>`;
  }

  const isCollapsed = q.isCollapsed === true;

  return `
    <div class="question-card editor-card ${isCollapsed ? 'collapsed' : ''}" id="qcard-${q.id}" draggable="true" data-qidx="${idx}">
      <div class="question-drag-handle" ondragstart="dragStart(event,${idx})" ondragover="dragOver(event)" ondrop="dropQuestion(event,${idx})">
        <div style="display:flex;align-items:center;gap:.5rem">
          <i class="fas fa-grip-vertical drag-icon"></i>
          <select class="form-control" style="width:auto;padding:.2rem .5rem;font-size:.75rem;height:28px"
            onchange="changeQuestionType('${q.id}', this.value)">
            ${typeOptions}
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:.5rem">
          ${showPoints ? `<input type="number" class="form-control" style="width:70px;padding:.3rem .5rem;font-size:.8rem;height:28px" value="${q.points}" min="0" oninput="updateQ('${q.id}','points',+this.value)" title="النقاط">` : ''}
          <button class="icon-btn" title="${isCollapsed ? 'تعديل السؤال' : 'إغلاق التعديل'}" onclick="toggleQuestionCollapse('${q.id}')">
            <i class="fas ${isCollapsed ? 'fa-edit' : 'fa-chevron-up'}"></i>
          </button>
          <button class="icon-btn" title="تكرار السؤال" onclick="duplicateQuestion('${q.id}')"><i class="fas fa-clone"></i></button>
          <button class="icon-btn danger" onclick="deleteQuestion('${q.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </div>
      <div class="question-card-body">
        <div class="q-header-row">
          <div class="q-number">${idx + 1}</div>
          <div class="q-inputs">
            <div class="q-text-view" onclick="toggleQuestionCollapse('${q.id}')">
              ${q.text || '<span style="color:var(--text-muted)">سؤال بدون نص... انقر للتعديل</span>'}
            </div>
            <div class="q-edit-fields">
              <input type="text" class="form-control" value="${q.text}" placeholder="نص السؤال..."
                oninput="updateQ('${q.id}','text',this.value)">
              ${optionsHtml}
            </div>
          </div>
        </div>
        <div class="question-actions q-edit-fields">
          <label class="q-required-toggle">
            <input type="checkbox" ${q.required ? 'checked' : ''} onchange="updateQ('${q.id}','required',this.checked)">
            <span>إلزامي</span>
          </label>
        </div>
      </div>
    </div>`;
}

function toggleQuestionCollapse(qId) {
  const q = currentQuestions.find(q => q.id === qId);
  if (q) {
    q.isCollapsed = !q.isCollapsed;
    renderQuestions();
  }
}

function updateQ(qId, field, value) {
  const q = currentQuestions.find(q => q.id === qId);
  if (q) q[field] = value;
}

function updateOption(qId, optId, field, value) {
  const q = currentQuestions.find(q => q.id === qId);
  if (!q) return;
  const opt = q.options.find(o => o.id === optId);
  if (opt) opt[field] = value;
}

function setCorrectOption(qId, optId) {
  const q = currentQuestions.find(q => q.id === qId);
  if (!q) return;
  q.options.forEach(o => o.correct = o.id === optId);
  renderQuestions();
}

function addOption(qId) {
  const q = currentQuestions.find(q => q.id === qId);
  if (!q) return;
  q.options.push({ id: DB.generateId(), text: 'خيار جديد', correct: false });
  renderQuestions();
}

function deleteOption(qId, optId) {
  const q = currentQuestions.find(q => q.id === qId);
  if (!q || q.options.length <= 2) { showToast('يجب أن يكون هناك خياران على الأقل', 'warning'); return; }
  q.options = q.options.filter(o => o.id !== optId);
  renderQuestions();
}

function deleteQuestion(qId) {
  currentQuestions = currentQuestions.filter(q => q.id !== qId);
  renderQuestions();
}

function duplicateQuestion(qId) {
  const q = currentQuestions.find(q => q.id === qId);
  if (!q) return;
  const copy = JSON.parse(JSON.stringify(q));
  copy.id = DB.generateId();
  if (copy.options) copy.options.forEach(o => o.id = DB.generateId());
  
  const idx = currentQuestions.findIndex(q => q.id === qId);
  currentQuestions.splice(idx + 1, 0, copy);
  renderQuestions();
  showToast('تم تكرار السؤال بنجاح', 'success');
}

function changeQuestionType(qId, newType) {
  const q = currentQuestions.find(q => q.id === qId);
  if (!q || q.type === newType) return;
  
  q.type = newType;
  // Initialize options if switching to a multiple-choice type and none exist
  if ((newType === 'multiple-choice' || newType === 'true-false') && (!q.options || q.options.length === 0)) {
    if (newType === 'multiple-choice') {
      q.options = [
        { id: DB.generateId(), text: 'الخيار الأول', correct: false },
        { id: DB.generateId(), text: 'الخيار الثاني', correct: false }
      ];
    } else {
      q.options = [
        { id: DB.generateId(), text: 'صح', correct: false },
        { id: DB.generateId(), text: 'خطأ', correct: false }
      ];
    }
  }
  
  renderQuestions();
  showToast('تم تغيير نوع السؤال', 'info');
}

// -------- DRAG & DROP --------
function initDragDrop() {
  document.querySelectorAll('.question-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragSrcIndex = +card.dataset.qidx;
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', e => e.preventDefault());
    card.addEventListener('drop', e => {
      e.preventDefault();
      const targetIdx = +card.dataset.qidx;
      if (dragSrcIndex === null || dragSrcIndex === targetIdx) return;
      const moved = currentQuestions.splice(dragSrcIndex, 1)[0];
      currentQuestions.splice(targetIdx, 0, moved);
      dragSrcIndex = null;
      renderQuestions();
    });
  });
}

function dragStart(e, idx) { dragSrcIndex = idx; }
function dragOver(e) { e.preventDefault(); }
function dropQuestion(e, targetIdx) {
  e.preventDefault();
  if (dragSrcIndex === null || dragSrcIndex === targetIdx) return;
  const moved = currentQuestions.splice(dragSrcIndex, 1)[0];
  currentQuestions.splice(targetIdx, 0, moved);
  dragSrcIndex = null;
  renderQuestions();
}

// -------- LOGO --------
function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    formLogoData = e.target.result;
    document.getElementById('form-logo-preview').innerHTML = `<img src="${formLogoData}" alt="logo">`;
  };
  reader.readAsDataURL(file);
}

// -------- INIT NEW FORM --------
function initNewForm() {
  editingFormId = null;
  currentQuestions = [];
  formLogoData = null;
  document.getElementById('form-editor-title').textContent = 'إنشاء نموذج جديد';
  document.getElementById('form-title').value = '';
  document.getElementById('form-description').value = '';
  document.getElementById('form-type').value = 'survey';
  document.getElementById('form-display-mode').value = 'one-by-one';
  document.getElementById('form-active').checked = true;
  document.getElementById('form-show-score').checked = true;
  document.getElementById('form-show-pdf').checked = true;
  document.getElementById('form-webhook').value = '';
  document.getElementById('form-sheet-url').value = '';
  document.getElementById('form-logo-preview').innerHTML = '<i class="fas fa-image"></i><span>إضافة شعار</span>';
  renderQuestions();
}

// -------- RESPONSES --------
function renderResponses(formId = 'all') {
  const searchInput = document.getElementById('responses-search');
  const search = (searchInput?.value || '').toLowerCase();
  
  let allResponses = formId === 'all' ? DB.getResponses() : DB.getResponsesByForm(formId);
  
  // Filter by search
  if (search) {
    allResponses = allResponses.filter(r => 
      (r.respondentName || '').toLowerCase().includes(search) || 
      (r.respondentPhone || '').toLowerCase().includes(search)
    );
  }

  const tbody = document.getElementById('responses-tbody');

  // Populate filter dropdown
  const select = document.getElementById('response-form-filter');
  const forms = DB.getForms();
  if (select.options.length <= 1) {
    select.innerHTML = '<option value="all">جميع النماذج</option>' +
      forms.map(f => `<option value="${f.id}">${f.title}</option>`).join('');
  }
  select.value = formId;

  if (allResponses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-table"><i class="fas fa-inbox"></i><p>لا توجد إجابات بعد</p></td></tr>`;
    return;
  }

  tbody.innerHTML = allResponses.map((r, idx) => {
    const form = DB.getFormById(r.formId);
    const date = new Date(r.submittedAt).toLocaleString('ar-SA');
    let scoreBadge = '-';
    if (r.totalPoints > 0) {
      const pct = Math.round((r.score / r.totalPoints) * 100);
      const cls = pct >= 70 ? 'score-high' : pct >= 50 ? 'score-mid' : 'score-low';
      scoreBadge = `<span class="score-badge ${cls}">${r.score}/${r.totalPoints} (${pct}%)</span>`;
    }
    return `
      <tr>
        <td>${idx + 1}</td>
        <td>
          <strong>${r.respondentName || 'مجهول'}</strong>
          <div style="font-size:.75rem;color:var(--text-muted)">${r.respondentPhone || '-'}</div>
        </td>
        <td>${form?.title || 'نموذج محذوف'}</td>
        <td>${scoreBadge}</td>
        <td style="color:var(--text-muted);font-size:.8rem">${date}</td>
        <td>
          <button class="icon-btn" title="عرض التفاصيل" onclick="viewResponseDetail('${r.id}')"><i class="fas fa-eye"></i></button>
          <button class="icon-btn" title="تحميل PDF" onclick="downloadAdminPdf('${r.id}')"><i class="fas fa-file-pdf" style="color:var(--danger)"></i></button>
        </td>
      </tr>`;
  }).join('');
}

function loadResponsesByForm() {
  const formId = document.getElementById('response-form-filter').value;
  renderResponses(formId);
}

function viewResponseDetail(respId) {
  const resp = DB.getResponses().find(r => r.id === respId);
  if (!resp) return;
  const form = DB.getFormById(resp.formId);
  if (!form) return;

  let html = `<div style="display:flex;flex-direction:column;gap:1rem">`;
  html += `<div style="display:flex;justify-content:space-between;color:var(--text-muted);font-size:.85rem">
    <span><i class="fas fa-user"></i> ${resp.respondentName || 'مجهول'} (${resp.respondentPhone || '-'})</span>
    <span><i class="fas fa-clock"></i> ${new Date(resp.submittedAt).toLocaleString('ar-SA')}</span>
  </div>`;

  form.questions.forEach((q, idx) => {
    const ans = resp.answers[q.id];
    let ansText = '';
    if (q.type === 'multiple-choice' || q.type === 'true-false') {
      const opt = q.options.find(o => o.id === ans);
      ansText = opt ? opt.text : 'لم يجب';
    } else if (typeof ans === 'string' && (ans.startsWith('data:') || ans.startsWith('http'))) {
      const isImg = ans.startsWith('data:image') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(ans) || ans.includes('googlesyndication') || ans.includes('googleusercontent');
      const isPdf = ans.includes('.pdf') || (ans.startsWith('data:application/pdf'));
      
      if (isImg) {
        ansText = `<div style="margin-top:10px;"><img src="${ans}" style="max-height: 150px; border-radius: 8px; border: 1px solid var(--primary); cursor: pointer;" onclick="window.open('${ans}', '_blank')"></div>`;
      } else {
        const icon = isPdf ? 'fa-file-pdf' : 'fa-file-lines';
        const color = isPdf ? 'var(--danger)' : 'var(--primary)';
        ansText = `<div style="margin-top:10px;">
                    <a href="${ans}" target="_blank" style="display:inline-flex;align-items:center;gap:10px;padding:8px 15px;background:var(--dark-2);border-radius:8px;text-decoration:none;color:var(--text);border:1px solid #444">
                      <i class="fas ${icon}" style="color:${color};font-size:1.2rem"></i>
                      <span>فتح المرفق</span>
                    </a>
                   </div>`;
      }
    } else {
      ansText = ans || 'لم يجب';
    }
    
    html += `
      <div style="background:var(--dark-3);border-radius:.75rem;padding:1rem">
        <div style="font-size:.75rem;color:var(--primary);font-weight:700;margin-bottom:.25rem">سؤال ${idx + 1}</div>
        <div style="font-weight:600;margin-bottom:.5rem">${q.text}</div>
        <div style="color:var(--text-muted);font-size:.9rem"><i class="fas fa-reply" style="color:var(--success)"></i> ${ansText}</div>
      </div>`;
  });

  if (resp.totalPoints > 0) {
    const pct = Math.round((resp.score / resp.totalPoints) * 100);
    html += `<div style="background:rgba(108,99,255,.1);border:1px solid rgba(108,99,255,.3);border-radius:.75rem;padding:1rem;text-align:center">
      <div style="font-size:1.5rem;font-weight:800;color:var(--primary)">${resp.score}/${resp.totalPoints}</div>
      <div style="color:var(--text-muted);font-size:.85rem">النتيجة الإجمالية (${pct}%)</div>
    </div>`;
  }
  html += `</div>`;

  openModal('تفاصيل الإجابة', html, `
    <button class="btn btn-primary" onclick="downloadAdminPdf('${respId}')"><i class="fas fa-file-pdf"></i> تحميل PDF</button>
    <button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>
  `);
}

// -------- EXPORT --------
function exportToCSV() {
  const filterId = document.getElementById('response-form-filter')?.value || 'all';
  let responses = DB.getResponses();
  let headers = ['#', 'الاسم', 'رقم الهاتف', 'النموذج', 'الإجابات', 'النتيجة', 'التاريخ'];
  
  if (filterId !== 'all') {
    const form = DB.getFormById(filterId);
    if (form) {
      responses = responses.filter(r => r.formId === filterId);
      headers = ['#', 'الاسم', 'رقم الهاتف', ...form.questions.map(q => q.text), 'النتيجة', 'التاريخ'];
    }
  }

  const rows = [headers];

  responses.forEach((r, i) => {
    const form = DB.getFormById(r.formId);
    const date = new Date(r.submittedAt).toLocaleString('ar-SA');
    const score = r.totalPoints > 0 ? `${r.score}/${r.totalPoints}` : '-';
    
    if (filterId !== 'all' && form) {
      const qAnswers = form.questions.map(q => {
        const ans = r.answers[q.id];
        if (q.type === 'multiple-choice' || q.type === 'true-false') {
          return q.options.find(o => o.id === ans)?.text || '-';
        }
        return ans || '-';
      });
      rows.push([i + 1, r.respondentName || 'مجهول', r.respondentPhone || '-', ...qAnswers, score, date]);
    } else {
      const allAnswers = Object.values(r.answers).join(' | ');
      rows.push([i + 1, r.respondentName || 'مجهول', r.respondentPhone || '-', form?.title || '-', allAnswers, score, date]);
    }
  });

  const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `responses_${filterId}.csv`; a.click();
  showToast('تم تصدير CSV بنجاح', 'success');
}

async function exportToExcel() {
  if (typeof ExcelJS === 'undefined') { 
    showToast('جاري تحميل مكتبة إكسيل المتطورة...', 'info'); 
    return;
  }
  
  const filterId = document.getElementById('response-form-filter')?.value || 'all';
  let responses = DB.getResponses();
  let form = null;
  let headers = ['#', 'الاسم', 'رقم الهاتف', 'النموذج', 'النتيجة', 'التاريخ'];
  let sheetName = 'Responses';

  if (filterId !== 'all') {
    form = DB.getFormById(filterId);
    if (form) {
      responses = responses.filter(r => r.formId === filterId);
      headers = ['#', 'الاسم', 'رقم الهاتف', ...form.questions.map(q => q.text), 'النتيجة', 'التاريخ'];
      sheetName = form.title.replace(/[\\\/\?\*\[\]\:]/g, "").substring(0, 30) || 'Responses';
    }
  }

  showToast('جاري معالجة الصور والتصدير... قد يستغرق ذلك لحظات', 'info');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Styling Headers
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6C63FF' } };
  headerRow.alignment = { horizontal: 'center' };

  // Helper to fetch and add image
  const addImageToExcel = async (url, rowIdx, colIdx) => {
    try {
      let imageBase64 = '';
      if (url.startsWith('data:image')) {
        imageBase64 = url;
      } else if (url.includes('drive.google.com')) {
        // Convert Drive Link to Thumbnail link
        const fileId = url.match(/[-\w]{25,}/);
        if (fileId) {
          const thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=s200`; // Small thumbnail
          // Note: Browser might block this during fetch if no CORS, but let's try
          const resp = await fetch(thumbUrl);
          const blob = await resp.blob();
          imageBase64 = await new Promise(r => {
            const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob);
          });
        }
      }

      if (imageBase64) {
        const imageId = workbook.addImage({
          base64: imageBase64,
          extension: 'png',
        });
        worksheet.addImage(imageId, {
          tl: { col: colIdx - 1, row: rowIdx - 1 },
          ext: { width: 50, height: 50 },
          editAs: 'oneCell'
        });
        return true;
      }
    } catch (e) {
      console.error("Failed to fetch image for excel", e);
    }
    return false;
  };

  const rowsData = [];
  for (let i = 0; i < responses.length; i++) {
    const r = responses[i];
    const date = new Date(r.submittedAt).toLocaleString('ar-SA');
    const score = r.totalPoints > 0 ? `${r.score}/${r.totalPoints}` : '-';
    
    let currentRow = [i + 1, r.respondentName || 'مجهول', r.respondentPhone || '-'];
    
    if (filterId !== 'all' && form) {
      const qAnswers = form.questions.map(q => {
        let ans = r.answers[q.id];
        if (q.type === 'multiple-choice' || q.type === 'true-false') {
          return q.options.find(o => o.id === ans)?.text || '-';
        }
        return ans || '-';
      });
      currentRow = [...currentRow, ...qAnswers, score, date];
    } else {
      currentRow = [...currentRow, form?.title || '-', score, date];
    }
    
    const excelRow = worksheet.addRow(currentRow);
    excelRow.height = 45; // Height for thumbnails
    
    // Check for images in answers
    if (filterId !== 'all' && form) {
      for (let qIdx = 0; qIdx < form.questions.length; qIdx++) {
        const q = form.questions[qIdx];
        const ans = r.answers[q.id];
        if (typeof ans === 'string' && (ans.startsWith('data:image') || ans.startsWith('http'))) {
          const colIdx = 4 + qIdx; // Column index (1-based)
          const cell = excelRow.getCell(colIdx);
          
          // Try to add thumbnail
          await addImageToExcel(ans, excelRow.number, colIdx);
          
          // Set Hyperlink correctly for ExcelJS
          if (ans.startsWith('http')) {
            cell.value = {
              text: 'اضغط لفتح الصورة الأصلية',
              hyperlink: ans,
              tooltip: 'فتح في جوجل درايف'
            };
            cell.font = { underline: true, color: { argb: 'FF0563C1' }, size: 9 };
          } else {
            cell.value = "صورة محلية (مضمنة)";
            cell.font = { italic: true, color: { argb: 'FF777777' }, size: 8 };
          }
          cell.alignment = { vertical: 'bottom', horizontal: 'center' };
        }
      }
    }
  }

  // Auto-size columns
  worksheet.columns.forEach(column => {
    column.width = 20;
    column.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `responses_${sheetName}.xlsx`;
  a.click();
  
  showToast('تم تصدير الإكسيل مع الصور بنجاح', 'success');
}

function downloadAllResponsesPdf() {
  const formId = document.getElementById('response-form-filter')?.value || 'all';
  const searchInput = document.getElementById('responses-search');
  const search = (searchInput?.value || '').toLowerCase();
  
  let responses = formId === 'all' ? DB.getResponses() : DB.getResponsesByForm(formId);
  
  if (search) {
    responses = responses.filter(r => 
      (r.respondentName || '').toLowerCase().includes(search) || (r.respondentPhone || '').toLowerCase().includes(search)
    );
  }

  if (responses.length === 0) {
    showToast('لا توجد إجابات لتصديرها', 'error');
    return;
  }

  showToast('جاري تحضير نافذة الطباعة المجمعة...', 'info');

  // Create a printable window
  const printWindow = window.open('', '_blank');
  
  let html = `
    <html dir="rtl" lang="ar">
    <head>
      <title>تقرير الاستجابات المجمع</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Cairo', sans-serif; padding: 20px; color: #333; line-height: 1.6; }
        .page { page-break-after: always; border-bottom: 2px solid #6C63FF; padding-bottom: 30px; margin-bottom: 30px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
        .form-title { color: #6C63FF; margin: 0; font-size: 24px; }
        .participant-info { font-size: 16px; font-weight: bold; margin: 10px 0; }
        .q-row { background: #f9f9f9; padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid #eee; }
        .question { font-weight: bold; color: #555; margin-bottom: 5px; }
        .answer { color: #0563C1; padding-right: 15px; }
        .score-box { font-size: 20px; font-weight: 900; color: #27ae60; text-align: left; }
        @media print {
          body { padding: 0; }
          .page { border-bottom: none; }
        }
      </style>
    </head>
    <body onload="window.print(); window.close();">
      <div style="text-align:center; margin-bottom:40px; border-bottom: 5px solid #6C63FF; padding:20px">
        <h1 style="margin:0">تقرير الاستجابات الشامل</h1>
        <p>عدد المشاركين في هذا التقرير: ${responses.length}</p>
      </div>
  `;

  responses.forEach((r, idx) => {
    const form = DB.getFormById(r.formId);
    if (!form) return;

    html += `
      <div class="page">
        <div class="header">
          <div>
            <h2 class="form-title">${form.title}</h2>
            <div class="participant-info">المشارك: ${r.respondentName}</div>
            <div style="font-size:13px; color:#666">الهاتف: ${r.respondentPhone || '-'}</div>
          </div>
          <div class="score-box">
             ${form.type === 'quiz' ? r.score + ' / ' + r.totalPoints : 'تم التسليم'}
             <div style="font-size:12px; color:#999; font-weight:normal">${new Date(r.submittedAt).toLocaleString('ar-SA')}</div>
          </div>
        </div>
        <div class="questions-list">
          ${form.questions.map((q, qIdx) => {
            const ans = r.answers[q.id];
            let ansText = ans || '-';
            let isCorrect = true;
            let correctText = '';
            const hasCorrectOption = q.options && q.options.some(o => o.correct);
            const isQuizQuestion = q.points > 0 || hasCorrectOption;

            if (q.type === 'multiple-choice' || q.type === 'true-false') {
              const selected = q.options.find(o => o.id === ans);
              ansText = selected ? selected.text : '-';
              
              if (isQuizQuestion) {
                const correctOption = q.options.find(o => o.correct);
                isCorrect = selected ? selected.correct : false;
                correctText = correctOption ? correctOption.text : '-';
              }
            }

            const status = isQuizQuestion ? (isCorrect ? '<span style="color:#27ae60"> [✓ صح]</span>' : '<span style="color:#e74c3c"> [✗ خطأ]</span>') : '';
            const modelAnswer = (!isCorrect && isQuizQuestion) ? `<div style="color:#27ae60; font-size:13px; margin-top:5px">💡 الإجابة الصحيحة: ${correctText}</div>` : '';

            return `
              <div class="q-row">
                <div class="question">س${qIdx+1}: ${q.text} ${status}</div>
                <div class="answer">◀ ${ansText}</div>
                ${modelAnswer}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  });

  html += `</body></html>`;
  
  printWindow.document.write(html);
  printWindow.document.close();
}
