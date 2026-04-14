// ==================== DATABASE (localStorage) ====================
const DB = {
  PREFIX: 'formflow_',

  get(key) {
    try { return JSON.parse(localStorage.getItem(this.PREFIX + key)) || []; }
    catch { return []; }
  },

  set(key, data) {
    localStorage.setItem(this.PREFIX + key, JSON.stringify(data));
  },

  getObj(key) {
    try { return JSON.parse(localStorage.getItem(this.PREFIX + key)) || {}; }
    catch { return {}; }
  },

  setObj(key, data) {
    localStorage.setItem(this.PREFIX + key, JSON.stringify(data));
  },

  // ---- USERS ----
  getUsers()          { return this.get('users'); },
  saveUsers(u)        { this.set('users', u); },
  getUserById(id)     { return this.getUsers().find(u => u.id === id) || null; },
  getUserByEmail(em)  { return this.getUsers().find(u => u.email === em) || null; },
  getUserByName(name) { return this.getUsers().find(u => u.name === name) || null; },

  addUser(user) {
    const users = this.getUsers();
    users.push(user);
    this.saveUsers(users);
  },

  updateUser(id, data) {
    const users = this.getUsers().map(u => u.id === id ? { ...u, ...data } : u);
    this.saveUsers(users);
  },

  // ---- FORMS ----
  getForms()       { return this.get('forms'); },
  saveForms(f)     { this.set('forms', f); },
  getFormById(id)  { return this.getForms().find(f => f.id === id) || null; },
  getFormBySlug(s) { return this.getForms().find(f => f.slug === s) || null; },

  addForm(form) {
    const forms = this.getForms();
    forms.push(form);
    this.saveForms(forms);
    return form;
  },

  updateForm(id, data) {
    const forms = this.getForms().map(f => f.id === id ? { ...f, ...data, updatedAt: new Date().toISOString() } : f);
    this.saveForms(forms);
  },

  deleteForm(id) {
    this.saveForms(this.getForms().filter(f => f.id !== id));
    // delete responses too
    this.saveResponses(this.getResponses().filter(r => r.formId !== id));
  },

  // ---- RESPONSES ----
  getResponses()        { return this.get('responses'); },
  saveResponses(r)      { this.set('responses', r); },
  getResponsesByForm(id){ return this.getResponses().filter(r => r.formId === id); },

  addResponse(resp) {
    const responses = this.getResponses();
    responses.push(resp);
    this.saveResponses(responses);
    return resp;
  },

  // ---- SESSION ----
  getSession()     { return this.getObj('session'); },
  setSession(data) { this.setObj('session', data); },
  clearSession()   { localStorage.removeItem(this.PREFIX + 'session'); },

  // ---- UTILS ----
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  generateSlug(title) {
    const base = title.trim().replace(/\s+/g, '-').replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, '').toLowerCase();
    return base + '-' + Math.random().toString(36).substr(2, 5);
  },

  // ---- SEED DEFAULT ADMIN ----
  seed() {
    const users = this.getUsers();
    let admin = users.find(u => u.role === 'admin');
    
    if (!admin) {
      this.addUser({
        id: 'admin-001',
        name: 'المدير',
        email: 'admin',
        password: 'admin',
        role: 'admin',
        createdAt: new Date().toISOString()
      });
    } else {
      // Force password update for demo convenience
      if (admin.name === 'المدير' || admin.email === 'admin') {
        admin.password = 'admin';
        admin.name = 'المدير'; // ensure name is consistent
        this.saveUsers(users);
      }
    }

    if (this.getForms().length === 0) {
      const demoForm = {
        id: 'form-demo-001',
        slug: 'demo-استبيان-رضا',
        title: 'استبيان رضا العملاء',
        description: 'نود معرفة رأيك لتحسين خدماتنا',
        type: 'quiz',
        displayMode: 'one-by-one',
        active: true,
        logo: null,
        createdBy: 'admin-001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        questions: [
          {
            id: 'q1', type: 'multiple-choice', text: 'كيف تقيّم جودة الخدمة المقدمة؟',
            required: true, points: 10,
            options: [
              { id: 'o1', text: 'ممتازة', correct: true },
              { id: 'o2', text: 'جيدة جداً', correct: false },
              { id: 'o3', text: 'جيدة', correct: false },
              { id: 'o4', text: 'مقبولة', correct: false }
            ]
          },
          {
            id: 'q2', type: 'true-false', text: 'هل تنصح أصدقاءك باستخدام خدماتنا؟',
            required: true, points: 10,
            options: [
              { id: 'o1', text: 'صح', correct: true },
              { id: 'o2', text: 'خطأ', correct: false }
            ]
          },
          {
            id: 'q3', type: 'short-answer', text: 'ما اسمك الكريم؟',
            required: true, points: 0, options: []
          },
          {
            id: 'q4', type: 'paragraph', text: 'شاركنا ملاحظاتك واقتراحاتك لتحسين خدماتنا',
            required: false, points: 0, options: []
          }
        ]
      };
      this.addForm(demoForm);

      // demo responses
      const names = ['أحمد محمد', 'فاطمة علي', 'خالد عبدالله'];
      names.forEach((name, i) => {
        this.addResponse({
          id: this.generateId(),
          formId: 'form-demo-001',
          respondentName: name,
          answers: { q1: 'o1', q2: 'o1', q3: name, q4: 'خدمة رائعة' },
          score: 20, totalPoints: 20,
          submittedAt: new Date(Date.now() - i * 86400000).toISOString()
        });
      });
    }
  }
};

// Run seed on load
DB.seed();
