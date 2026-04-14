// ==================== ANALYTICS ====================
let charts = [];

function renderAnalytics() {
  const forms = DB.getForms();
  const responses = DB.getResponses();
  const container = document.getElementById('analytics-content');
  const filterSelect = document.getElementById('analytics-form-filter');

  // Populate Filter
  if (filterSelect && filterSelect.options.length <= 1) {
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="all">نظرة عامة على جميع النماذج</option>' + 
      forms.map(f => `<option value="${f.id}" ${currentVal === f.id ? 'selected' : ''}>${f.title}</option>`).join('');
  }

  const selectedFormId = filterSelect?.value || 'all';

  // Clear existing charts
  charts.forEach(c => c.destroy());
  charts = [];

  if (responses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"><i class="fas fa-chart-pie"></i></div>
        <h3>لا توجد بيانات كافية</h3>
        <p>ابدأ بمشاركة النماذج للحصول على تحليلات تفصيلية</p>
      </div>`;
    return;
  }

  if (selectedFormId === 'all') {
    renderGlobalAnalytics(forms, responses, container);
  } else {
    renderDetailedFormAnalytics(selectedFormId, responses, container);
  }
}

function renderGlobalAnalytics(forms, responses, container) {
  // Aggregate data
  const formStats = forms.map(f => {
    const fResponses = responses.filter(r => r.formId === f.id);
    return { title: f.title, count: fResponses.length };
  }).filter(s => s.count > 0).sort((a,b) => b.count - a.count);

  container.innerHTML = `
    <div class="analytics-grid">
      <div class="analytics-card" style="text-align:center">
        <div style="font-size:2.5rem;font-weight:800;color:var(--primary)">${responses.length}</div>
        <div style="color:var(--text-muted);font-size:.85rem">إجمالي المشاركات</div>
      </div>
      <div class="analytics-card" style="text-align:center">
        <div style="font-size:2.5rem;font-weight:800;color:var(--secondary)">${forms.length}</div>
        <div style="color:var(--text-muted);font-size:.85rem">إجمالي النماذج</div>
      </div>
      <div class="analytics-card full">
        <h3>توزيع الإجابات حسب النماذج</h3>
        <div style="height:350px">
          <canvas id="global-responses-chart"></canvas>
        </div>
      </div>
    </div>
  `;

  // Create Global Chart
  const ctx = document.getElementById('global-responses-chart').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: formStats.map(s => s.title),
      datasets: [{
        label: 'عدد المشاركات',
        data: formStats.map(s => s.count),
        backgroundColor: 'rgba(108, 99, 255, 0.6)',
        borderColor: '#6C63FF',
        borderWidth: 1,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
  charts.push(chart);
}

function renderDetailedFormAnalytics(formId, allResponses, container) {
  const form = DB.getFormById(formId);
  const responses = allResponses.filter(r => r.formId === formId);

  if (!form || responses.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>لا توجد إجابات لهذا النموذج</h3></div>';
    return;
  }

  // Summary Metrics
  let avgScore = 0;
  if (form.questions.some(q => q.points > 0)) {
    const totalPossible = responses.length * responses[0].totalPoints;
    const totalEarned = responses.reduce((s, r) => s + r.score, 0);
    avgScore = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
  }

  container.innerHTML = `
    <div class="analytics-grid">
      <div class="analytics-card" style="text-align:center">
        <div style="font-size:2.5rem;font-weight:800;color:var(--primary)">${responses.length}</div>
        <div style="color:var(--text-muted);font-size:.85rem">عدد المشاركين</div>
      </div>
      <div class="analytics-card" style="text-align:center">
        <div style="font-size:2.5rem;font-weight:800;color:var(--success)">${avgScore}%</div>
        <div style="color:var(--text-muted);font-size:.85rem">متوسط النتيجة</div>
      </div>
      
      <div style="grid-column:1/-1; margin-top:1rem">
        <h3 style="margin-bottom:1.5rem"><i class="fas fa-list-check"></i> تحليل الأسئلة</h3>
        <div id="questions-analytics-list" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(400px, 1fr)); gap:1.5rem">
          <!-- Question charts populated here -->
        </div>
      </div>
    </div>
  `;

  const qListContainer = document.getElementById('questions-analytics-list');
  
  form.questions.forEach((q, qIdx) => {
    const qAnswers = responses.map(r => r.answers[q.id]).filter(a => a !== undefined && a !== '');
    
    const card = document.createElement('div');
    card.className = 'analytics-card';
    card.innerHTML = `
      <div style="font-weight:700;margin-bottom:1rem;color:var(--primary)">س ${qIdx+1}: ${q.text}</div>
      <div style="height:250px">
        <canvas id="q-chart-${q.id}"></canvas>
      </div>
    `;
    qListContainer.appendChild(card);

    if (q.type === 'multiple-choice' || q.type === 'true-false') {
      const counts = {};
      let totalQResponses = 0;
      q.options.forEach(opt => counts[opt.id] = 0);
      qAnswers.forEach(ans => { 
        if(counts[ans] !== undefined) {
          counts[ans]++; 
          totalQResponses++;
        }
      });

      const chartCtx = document.getElementById(`q-chart-${q.id}`).getContext('2d');
      const chart = new Chart(chartCtx, {
        type: q.options.length > 4 ? 'bar' : 'pie',
        data: {
          labels: q.options.map(o => {
            const count = counts[o.id];
            const pct = totalQResponses > 0 ? Math.round((count / totalQResponses) * 100) : 0;
            return `${o.text} (${pct}%)`;
          }),
          datasets: [{
            data: q.options.map(o => counts[o.id]),
            backgroundColor: [
              'rgba(108, 99, 255, 0.7)',
              'rgba(240, 147, 251, 0.7)',
              'rgba(79, 172, 254, 0.7)',
              'rgba(67, 233, 123, 0.7)',
              'rgba(254, 225, 64, 0.7)',
              'rgba(245, 87, 108, 0.7)'
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { 
              display: true,
              position: 'bottom',
              labels: { 
                color: '#8888aa', 
                font: { family: 'Tajawal', size: 11 },
                padding: 15
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  return ` ${label}: ${value} إجابة`;
                }
              }
            }
          }
        }
      });
      charts.push(chart);

    } else {
      // For text/file inputs, show a count vs empty
      const chartCtx = document.getElementById(`q-chart-${q.id}`).getContext('2d');
      const chart = new Chart(chartCtx, {
        type: 'doughnut',
        data: {
          labels: ['تمت الإجابة', 'تخطى'],
          datasets: [{
            data: [qAnswers.length, responses.length - qAnswers.length],
            backgroundColor: ['rgba(67, 233, 123, 0.7)', 'rgba(255,255,255,0.05)']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { position: 'bottom', labels: { color: '#8888aa' } }
          }
        }
      });
      charts.push(chart);
    }
  });
}
async function downloadAnalyticsPdf() {
  const container = document.getElementById('analytics-content');
  const filterSelect = document.getElementById('analytics-form-filter');
  const formTitle = filterSelect.options[filterSelect.selectedIndex].text;

  if (!container || container.querySelector('.empty-state')) {
    showToast('لا توجد بيانات لتصديرها', 'error');
    return;
  }

  showToast('جاري إعداد تقرير PDF... يرجى الانتظار', 'info');

  const opt = {
    margin: [10, 10, 10, 10],
    filename: `تقرير_تحليلات_${formTitle.replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2, 
      useCORS: true,
      letterRendering: true
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: 'avoid-all', before: '.analytics-card' }
  };

  // Temporary styling for PDF export to ensure it looks good
  const originalStyle = container.getAttribute('style');
  container.style.background = '#fff';
  container.style.color = '#000';
  container.querySelectorAll('.analytics-card').forEach(c => {
    c.style.background = '#f9f9f9';
    c.style.color = '#333';
    c.style.borderColor = '#eee';
    c.style.boxShadow = 'none';
  });

  try {
    await html2pdf().set(opt).from(container).save();
    showToast('تم تحميل التقرير بنجاح', 'success');
  } catch (err) {
    console.error(err);
    showToast('فشل تصدير التقرير لمخططات', 'error');
  } finally {
    // Restore original styles
    container.setAttribute('style', originalStyle || '');
    container.querySelectorAll('.analytics-card').forEach(c => {
      c.style.background = '';
      c.style.color = '';
      c.style.borderColor = '';
      c.style.boxShadow = '';
    });
  }
}
