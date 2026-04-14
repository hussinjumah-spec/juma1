// ==================== AUTH ====================
const Auth = {
  currentUser: null,

  init() {
    const session = DB.getSession();
    if (session && session.userId) {
      const user = DB.getUserById(session.userId);
      if (user) {
        this.currentUser = user;
        return true;
      }
    }
    return false;
  },

  login(input, password) {
    // Try by name first, if not then by email
    const user = DB.getUserByName(input.trim()) || DB.getUserByEmail(input.trim().toLowerCase());
    if (!user) return { success: false, message: 'الاسم أو البريد غير مسجل' };
    if (user.password !== password) return { success: false, message: 'كلمة المرور غير صحيحة' };
    this.currentUser = user;
    DB.setSession({ userId: user.id, loginAt: new Date().toISOString() });
    return { success: true, user };
  },

  register(name, email, password) {
    if (!name.trim()) return { success: false, message: 'الاسم مطلوب' };
    if (!email.trim()) return { success: false, message: 'البريد الإلكتروني مطلوب' };
    if (password.length < 6) return { success: false, message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' };
    if (DB.getUserByEmail(email.toLowerCase())) return { success: false, message: 'البريد الإلكتروني مسجل مسبقاً' };

    const user = {
      id: DB.generateId(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: 'user',
      createdAt: new Date().toISOString()
    };
    DB.addUser(user);
    this.currentUser = user;
    DB.setSession({ userId: user.id, loginAt: new Date().toISOString() });
    return { success: true, user };
  },

  logout() {
    this.currentUser = null;
    DB.clearSession();
  },

  isAdmin() {
    return this.currentUser?.role === 'admin';
  },

  isLoggedIn() {
    return !!this.currentUser;
  }
};

// ==================== AUTH HANDLERS ====================
function handleLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  if (!email || !password) { showToast('يرجى ملء جميع الحقول', 'error'); return; }

  const btn = document.querySelector('#login-form .btn-primary');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ التحقق...';
  btn.disabled = true;

  setTimeout(() => {
    const result = Auth.login(email, password);
    btn.innerHTML = '<span class="btn-text">تسجيل الدخول</span><i class="fas fa-arrow-left"></i>';
    btn.disabled = false;

    if (result.success) {
      showToast('مرحباً ' + result.user.name + '!', 'success');
      if (result.user.role === 'admin') {
        initDashboard();
        showPage('admin-dashboard');
      } else {
        showToast('حسابك ليس لديه صلاحية الوصول للوحة التحكم', 'warning');
      }
    } else {
      showToast(result.message, 'error');
    }
  }, 600);
}

function handleRegister() {
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;

  if (password !== confirm) { showToast('كلمتا المرور غير متطابقتين', 'error'); return; }

  const result = Auth.register(name, email, password);
  if (result.success) {
    showToast('تم إنشاء الحساب بنجاح!', 'success');
    switchAuthTab('login');
    document.getElementById('login-email').value = email;
  } else {
    showToast(result.message, 'error');
  }
}

function handleLogout() {
  Auth.logout();
  showToast('تم تسجيل الخروج بنجاح', 'success');
  showPage('login-page');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1));
  });
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
}

function fillDemo(type) {
  if (type === 'admin') {
    document.getElementById('login-email').value = 'admin@formflow.com';
    document.getElementById('login-password').value = 'admin123';
  } else {
    document.getElementById('login-email').value = 'user@formflow.com';
    document.getElementById('login-password').value = 'user123';
  }
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  const icon = input.nextElementSibling?.querySelector('i') || input.parentElement.querySelector('.input-toggle i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) { icon.className = 'fas fa-eye-slash'; }
  } else {
    input.type = 'password';
    if (icon) { icon.className = 'fas fa-eye'; }
  }
}

function saveProfile() {
  const name = document.getElementById('settings-name').value.trim();
  const email = document.getElementById('settings-email').value.trim();
  if (!name || !email) { showToast('يرجى ملء جميع الحقول', 'error'); return; }
  DB.updateUser(Auth.currentUser.id, { name, email });
  Auth.currentUser = { ...Auth.currentUser, name, email };
  updateUserUI();
  showToast('تم حفظ الملف الشخصي', 'success');
}

function changePassword() {
  const current = document.getElementById('current-password').value;
  const newPass = document.getElementById('new-password').value;
  const confirm = document.getElementById('confirm-new-password').value;
  if (current !== Auth.currentUser.password) { showToast('كلمة المرور الحالية غير صحيحة', 'error'); return; }
  if (newPass.length < 6) { showToast('كلمة المرور الجديدة قصيرة جداً', 'error'); return; }
  if (newPass !== confirm) { showToast('كلمتا المرور غير متطابقتين', 'error'); return; }
  DB.updateUser(Auth.currentUser.id, { password: newPass });
  Auth.currentUser.password = newPass;
  showToast('تم تغيير كلمة المرور بنجاح', 'success');
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-new-password').value = '';
}
