// ==================== MAIN APP ====================
// اضف رابط المزامنة هنا ليعمل البرنامج تلقائيًا عند الجميع
const MASTER_SYNC_URL = "https://script.google.com/macros/s/AKfycbx0ZEqQMn2ICLO-y1-aKPDHXloASJ6E2yGuCPnWAMH6p_wWz_b042KH1aeg1O3ZxaZ-/exec"; 

// -------- PAGE NAVIGATION --------
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');
  window.scrollTo(0, 0);

  if (pageId === 'admin-dashboard') {
    if (!Auth.isLoggedIn()) { showPage('login-page'); return; }
    if (!Auth.isAdmin()) { showToast('ليس لديك صلاحية الوصول', 'error'); return; }
  }
}

// -------- SECTION NAVIGATION --------
function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById(`section-${sectionId}`);
  if (section) section.classList.add('active');

  const navItem = document.querySelector(`.nav-item[onclick*="'${sectionId}'"]`);
  if (navItem) navItem.classList.add('active');

  const titles = {
    overview: 'نظرة عامة', forms: 'النماذج', 'create-form': 'نموذج جديد',
    responses: 'الإجابات', analytics: 'التحليلات', settings: 'الإعدادات'
  };
  const bc = document.getElementById('breadcrumb');
  if (bc) bc.innerHTML = `<i class="fas fa-home"></i><span>${titles[sectionId] || sectionId}</span>`;

  if (sectionId === 'overview') renderOverview();
  else if (sectionId === 'forms') renderForms();
  else if (sectionId === 'responses') renderResponses();
  else if (sectionId === 'analytics') renderAnalytics();
  else if (sectionId === 'settings') loadSettings();
}

// -------- DASHBOARD INIT --------
function initDashboard() {
  updateUserUI();
  updateBadgeCounts();
  renderOverview();
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('section-overview')?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector('.nav-item[onclick*="overview"]')?.classList.add('active');
}

function updateUserUI() {
  const u = Auth.currentUser;
  if (!u) return;
  const initial = u.name?.charAt(0) || 'م';
  ['admin-avatar', 'topbar-avatar', 'settings-avatar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = initial;
  });
  ['admin-name', 'topbar-name'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = u.name;
  });
}

function updateBadgeCounts() {
  const forms = DB.getForms();
  const responses = DB.getResponses();
  const fCount = document.getElementById('forms-count');
  const rCount = document.getElementById('responses-count');
  if (fCount) fCount.textContent = forms.length;
  if (rCount) rCount.textContent = responses.length;
  document.getElementById('total-forms')?.setAttribute('data-count', forms.length);
  document.getElementById('total-responses')?.setAttribute('data-count', responses.length);
}

// -------- OVERVIEW --------
function renderOverview() {
  const forms = DB.getForms();
  const responses = DB.getResponses();
  animateCounter('total-forms', forms.length);
  animateCounter('total-responses', responses.length);
  animateCounter('active-forms', forms.filter(f => f.active).length);
  animateCounter('total-users', [...new Set(responses.map(r => r.respondentName))].length);

  const recentFormsEl = document.getElementById('recent-forms-list');
  const recentForms = [...forms].reverse().slice(0, 4);
  if (recentForms.length === 0) {
    recentFormsEl.innerHTML = `<div class="empty-state-small"><i class="fas fa-file-circle-plus"></i><p>لا توجد نماذج بعد</p></div>`;
  } else {
    recentFormsEl.innerHTML = recentForms.map(f => `
      <div class="recent-item" onclick="editForm('${f.id}');showSection('create-form')" style="cursor:pointer">
        <div class="recent-icon"><i class="fas fa-file-alt"></i></div>
        <div class="recent-info">
          <div class="recent-title">${f.title}</div>
          <div class="recent-meta">${(f.questions||[]).length} سؤال • ${DB.getResponsesByForm(f.id).length} إجابة</div>
        </div>
        <span class="recent-badge">${f.active ? 'نشط' : 'معطّل'}</span>
      </div>`).join('');
  }

  const recentRespEl = document.getElementById('recent-responses-list');
  const recentResp = [...responses].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 4);
  if (recentResp.length === 0) {
    recentRespEl.innerHTML = `<div class="empty-state-small"><i class="fas fa-comment-slash"></i><p>لا توجد إجابات بعد</p></div>`;
  } else {
    recentRespEl.innerHTML = recentResp.map(r => {
      const form = DB.getFormById(r.formId);
      const date = new Date(r.submittedAt).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `
        <div class="recent-item">
          <div class="recent-icon"><i class="fas fa-user-check"></i></div>
          <div class="recent-info">
            <div class="recent-title">${r.respondentName || 'مجهول'}</div>
            <div class="recent-meta">${form?.title || 'نموذج'} • ${date}</div>
          </div>
          ${r.totalPoints > 0 ? `<span class="recent-badge">${Math.round((r.score/r.totalPoints)*100)}%</span>` : ''}
        </div>`;
    }).join('');
  }
}

function animateCounter(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let start = null;
  const duration = 800;
  const step = (timestamp) => {
    if (!start) start = timestamp;
    const progress = Math.min((timestamp - start) / duration, 1);
    el.textContent = Math.floor(progress * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

// -------- SETTINGS --------
function loadSettings() {
  const u = Auth.currentUser;
  if (!u) return;
  document.getElementById('settings-name').value = u.name || '';
  document.getElementById('settings-email').value = u.email || '';
  const av = document.getElementById('settings-avatar');
  if (av) av.textContent = u.name?.charAt(0) || 'م';

  const theme = localStorage.getItem('formflow_theme') || 'dark';
  document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
  const activeBtn = document.querySelector(`.theme-option[onclick*="'${theme}'"]`);
  if (activeBtn) activeBtn.classList.add('active');

  // Load from localStorage or Fallback to MASTER_SYNC_URL
  const syncUrl = localStorage.getItem('formflow_sync_url') || MASTER_SYNC_URL || '';
  const autoSync = localStorage.getItem('formflow_auto_sync') !== 'false';
  const urlEl = document.getElementById('global-sync-url');
  const autoEl = document.getElementById('auto-sync');
  if (urlEl) urlEl.value = syncUrl;
  if (autoEl) autoEl.checked = autoSync;
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('formflow_theme', theme);
  document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
  const activeBtn = document.querySelector(`.theme-option[onclick*="'${theme}'"]`);
  if (activeBtn) activeBtn.classList.add('active');
  showToast(theme === 'dark' ? 'الوضع الداكن مفعّل' : 'الوضع الفاتح مفعّل', 'info');
}

// -------- CLOUD SYNC LOGIC --------
function saveSyncUrl() {
  const url = document.getElementById('global-sync-url').value.trim();
  const auto = document.getElementById('auto-sync').checked;
  localStorage.setItem('formflow_sync_url', url);
  localStorage.setItem('formflow_auto_sync', auto);
}

async function pushToCloudAuto() {
  if (!Auth.isAdmin()) return; // ONLY Admins can sync the whole DB!
  const url = localStorage.getItem('formflow_sync_url') || MASTER_SYNC_URL;
  const autoSync = localStorage.getItem('formflow_auto_sync') !== 'false';
  if (!url || !autoSync) return;

  try {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('formflow_') && !key.includes('sync_url') && key !== 'formflow_session') {
        data[key] = localStorage.getItem(key);
      }
    }
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
    console.log('Auto-push successful');
  } catch (e) { console.warn('Auto-push failed'); }
}

async function pushToCloud() {
  const url = document.getElementById('global-sync-url').value.trim() || MASTER_SYNC_URL;
  if (!url) { showToast('يرجى إدخال رابط المزامنة أولاً', 'error'); return; }
  localStorage.setItem('formflow_sync_url', url);
  localStorage.setItem('formflow_auto_sync', document.getElementById('auto-sync').checked);

  const btn = document.getElementById('btn-push-cloud');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الرفع...';
  btn.disabled = true;

  try {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('formflow_') && !key.includes('sync_url') && key !== 'formflow_session') {
        data[key] = localStorage.getItem(key);
      }
    }
    await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) });
    showToast('تم رفع البيانات للسحاب بنجاح!', 'success');
  } catch (err) {
    showToast('فشل الرفع للسحاب، تأكد من الرابط', 'error');
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
}

async function pullFromCloud() {
  const url = document.getElementById('global-sync-url').value.trim() || MASTER_SYNC_URL;
  if (!url) { showToast('يرجى إدخال رابط المزامنة أولاً', 'error'); return; }
  const btn = document.getElementById('btn-pull-cloud');
  const oldText = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري السحب...';
  btn.disabled = true;

  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      if (confirm('هل أنت متأكد من سحب البيانات؟ سيتم استبدال البيانات المحلية ببيانات السحاب.')) {
        for (const key in data) {
          if (key.startsWith('formflow_') && key !== 'formflow_session') localStorage.setItem(key, data[key]);
        }
        showToast('تمت المزامنة بنجاح! جاري التحديث...', 'success');
        setTimeout(() => location.reload(), 1000);
      }
    } else {
      showToast('لم يتم العثور على بيانات في السحاب', 'warning');
    }
  } catch (err) {
    showToast('فشل سحب البيانات، تأكد من الرابط', 'error');
  } finally {
    btn.innerHTML = oldText;
    btn.disabled = false;
  }
}

async function pullFromCloudAuto() {
  const url = localStorage.getItem('formflow_sync_url') || MASTER_SYNC_URL;
  if (!url) return;
  try {
    const resp = await fetch(url);
    const data = await resp.json();
    if (data && typeof data === 'object' && Object.keys(data).length > 0) {
      for (const key in data) {
        if (key.startsWith('formflow_') && key !== 'formflow_session') localStorage.setItem(key, data[key]);
      }
      console.log('Auto-sync successful');
    }
  } catch (e) {
    console.warn('Auto-sync failed');
  }
}

// -------- SIDEBAR & UI --------
function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('open');
}

function openModal(title, body, footer = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = body;
  document.getElementById('modal-footer').innerHTML = footer;
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

function showToast(message, type = 'info') {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icons[type]} toast-icon"></i><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideInToast .4s ease reverse';
    setTimeout(() => toast.remove(), 380);
  }, 3500);
}

function showNotifications() {
  openModal('الإشعارات', `
    <div style="display:flex;flex-direction:column;gap:.75rem">
      <div style="padding:1rem;background:var(--dark-3);border-radius:.75rem;display:flex;gap:.75rem;align-items:flex-start">
        <i class="fas fa-bell" style="color:var(--primary);margin-top:.15rem"></i>
        <div>
          <div style="font-weight:600;font-size:.9rem">مرحبلاً بك في FormFlow</div>
          <div style="font-size:.8rem;color:var(--text-muted)">ابدأ بإنشاء نموذجك الأول</div>
        </div>
      </div>
    </div>`,
    '<button class="btn btn-ghost" onclick="closeModal()">إغلاق</button>'
  );
}

function scrollToFeatures() {
  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
}

async function checkURLForm() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('form');
  if (!slug) return;

  let form = DB.getFormBySlug(slug);
  const syncUrl = MASTER_SYNC_URL || localStorage.getItem('formflow_sync_url');

  // If form not found and we have a sync URL, try to pull data first
  if (!form && syncUrl) {
    console.log('Form not found locally, attempting cloud pull...');
    await pullFromCloudAuto();
    form = DB.getFormBySlug(slug);
  }

  if (form && form.active) {
    loadFormViewer(form);
    showPage('form-viewer');
  } else {
    showToast('النموذج غير موجود أو غير نشط', 'error');
  }
}

const analyticsStyle = document.createElement('style');
analyticsStyle.textContent = `
  .bar-chart { display:flex; align-items:flex-end; gap:.75rem; height:200px; padding:.5rem 0; }
  .bar-item { flex:1; display:flex; flex-direction:column; align-items:center; gap:.4rem; height:100%; }
  .bar-fill { width:100%; border-radius:.4rem .4rem 0 0; min-height:4px; position:relative; display:flex; align-items:flex-start; justify-content:center; transition:height 1s ease; }
  .bar-value { font-size:.7rem; font-weight:700; color:#fff; margin-top:.25rem; }
  .bar-label { font-size:.75rem; color:var(--text-muted); white-space:nowrap; }
`;
document.head.appendChild(analyticsStyle);

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('formflow_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  const params = new URLSearchParams(window.location.search);
  const isFormLink = params.has('form');

  if (isFormLink) {
    checkURLForm();
  } else {
    if (Auth.init()) {
      if (Auth.isAdmin()) {
        initDashboard();
        showPage('admin-dashboard');
      } else {
        showPage('login-page');
      }
    } else {
      showPage('login-page');
    }
  }

  const autoSync = localStorage.getItem('formflow_auto_sync') !== 'false';
  if (autoSync) pullFromCloudAuto();

  const formActiveToggle = document.getElementById('form-active');
  if (formActiveToggle) {
    formActiveToggle.addEventListener('change', () => {
      document.getElementById('form-active-label').textContent = formActiveToggle.checked ? 'نشط' : 'معطّل';
    });
  }

  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    if (sidebar?.classList.contains('open') && !sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
});

// -------- DATA MANAGEMENT (BACKUP/RESTORE) --------
function exportDatabase() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('formflow_')) {
      data[key] = localStorage.getItem(key);
    }
  }
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `formflow_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('تم تصدير النسخة الاحتياطية بنجاح', 'success');
}

function importDatabase(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data || typeof data !== 'object') throw new Error();
      if (confirm('تنبيه: سيتم استبدال جميع البيانات الحالية بالبيانات المستوردة. هل تريد الاستمرار؟')) {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && key.startsWith('formflow_')) localStorage.removeItem(key);
        }
        for (const key in data) {
          localStorage.setItem(key, data[key]);
        }
        showToast('تم استيراد البيانات بنجاح! سيتم إعادة تحميل الصفحة...', 'success');
        setTimeout(() => location.reload(), 1500);
      }
    } catch (err) {
      showToast('خطأ في قراءة ملف النسخة الاحتياطية', 'error');
    }
  };
  reader.readAsText(file);
}
