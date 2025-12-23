// NHMTAL Teacher PWA - Main Logic v7
let db;
const DB_NAME = 'NHMTAL_DB';
const DB_VERSION = 3;

// Global current state
let currentClassId = null;
let currentStudentId = null;

document.addEventListener('DOMContentLoaded', () => {
    console.log("NHMTAL App v7 Initializing...");

    try {
        initDB();
    } catch (e) {
        console.error("Critical DB Init Error:", e);
    }

    try {
        setupNavigation();
        setupProfileLogic();
        setupClassLogic();
        setupStudentLogic();
        setupPerformanceLogic();
        setupAlumniLogic();
        setupTransitionLogic();
        setupPDFLogic();
        setupPlansLogic();
        setupSettingsLogic();
    } catch (e) {
        console.error("Setup Error:", e);
    }

    // Check theme
    try {
        const savedTheme = localStorage.getItem('app-theme') || 'default';
        applyTheme(savedTheme);
    } catch (e) { console.warn("Theme load failed", e); }
});

function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error("Database error: " + event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('teachers')) {
            db.createObjectStore('teachers', { keyPath: 'id', autoIncrement: true });
        }

        if (!db.objectStoreNames.contains('classes')) {
            const classStore = db.createObjectStore('classes', { keyPath: 'id', autoIncrement: true });
            classStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('students')) {
            const studentStore = db.createObjectStore('students', { keyPath: 'id', autoIncrement: true });
            studentStore.createIndex('classId', 'classId', { unique: false });
            studentStore.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('plans')) {
            const planStore = db.createObjectStore('plans', { keyPath: 'id', autoIncrement: true });
            planStore.createIndex('type', 'type', { unique: false });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log("DB Initialized");
        checkFirstLaunch();
        renderClasses();
    };
}

// --- Navigation ---
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-target');
            const title = item.getAttribute('data-title');
            navigate(target, title);
        });
    });
}

function navigate(viewId, title) {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    // Show target
    const targetView = document.getElementById(viewId);
    if (targetView) {
        targetView.classList.add('active');
        if (title) document.getElementById('page-title').textContent = title;

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-target') === viewId) item.classList.add('active');
            else item.classList.remove('active');
        });

        // Scroll top
        document.getElementById('main-content').scrollTop = 0;
    }
}

// --- First Launch ---
function checkFirstLaunch() {
    const tx = db.transaction(['teachers'], 'readonly');
    const store = tx.objectStore('teachers');
    const req = store.get('teacher_profile');

    req.onsuccess = (e) => {
        if (!e.target.result) {
            showSetupMode();
        } else {
            loadTeacherProfile(e.target.result);
            showAppMode();
        }
    };
}

function showSetupMode() {
    document.getElementById('view-welcome').classList.add('active');
    document.querySelector('.bottom-nav').style.display = 'none';
    document.querySelector('.app-header').style.display = 'none';
}

function showAppMode() {
    document.getElementById('view-welcome').classList.remove('active');
    document.querySelector('.bottom-nav').style.display = 'flex';
    document.querySelector('.app-header').style.display = 'flex';
    navigate('view-profile', 'Profil');
}

// --- Teacher Profile Logic ---
function setupProfileLogic() {
    const form = document.getElementById('setup-form');
    const avatarOpts = document.querySelectorAll('.avatar-option');
    let selectedAvatar = 'avatar1.png';

    avatarOpts.forEach(opt => {
        opt.addEventListener('click', () => {
            avatarOpts.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedAvatar = opt.getAttribute('data-avatar');
        });
    });

    const photoUpload = document.getElementById('photo-upload');
    photoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const preview = document.getElementById('photo-preview');
                preview.src = ev.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveTeacherProfile();
    });

    document.getElementById('btn-edit-profile').addEventListener('click', () => {
        const tx = db.transaction(['teachers'], 'readonly');
        tx.objectStore('teachers').get('teacher_profile').onsuccess = (e) => {
            const t = e.target.result;
            if (t) {
                document.getElementById('setup-name').value = t.name;
                document.getElementById('setup-branch').value = t.branch;
                document.getElementById('setup-school').value = t.school;
                document.getElementById('setup-gender').value = t.gender;
                showSetupMode();
            }
        };
    });
}

function saveTeacherProfile() {
    const name = document.getElementById('setup-name').value;
    const branch = document.getElementById('setup-branch').value;
    const school = document.getElementById('setup-school').value;
    const gender = document.getElementById('setup-gender').value;
    const photoPreview = document.getElementById('photo-preview').src;

    // Determine avatar
    let avatar = '👨‍🏫';
    if (gender === 'female') avatar = '👩‍🏫';
    if (gender === 'none') avatar = '🧑‍🏫';

    const profileData = {
        id: 'teacher_profile',
        name,
        branch,
        school,
        gender,
        avatar,
        photo: photoPreview.startsWith('data:') ? photoPreview : null,
        updatedAt: new Date()
    };

    const tx = db.transaction(['teachers'], 'readwrite');
    tx.objectStore('teachers').put(profileData).onsuccess = () => {
        loadTeacherProfile(profileData);
        showAppMode();
    };
}

function loadTeacherProfile(t) {
    document.getElementById('disp-name').textContent = t.name;
    document.getElementById('disp-branch').textContent = t.branch;
    document.getElementById('disp-school').textContent = t.school || 'Belirtilmedi';
    document.getElementById('disp-gender').textContent = t.gender === 'male' ? 'Erkek' : (t.gender === 'female' ? 'Kadın' : 'Belirtilmedi');

    const avatarDisp = document.getElementById('profile-avatar-display');
    const imgDisp = document.getElementById('profile-img-display');

    if (t.photo) {
        imgDisp.src = t.photo;
        imgDisp.style.display = 'block';
        avatarDisp.style.display = 'none';
    } else {
        avatarDisp.textContent = t.avatar || '👨‍🏫';
        avatarDisp.style.display = 'block';
        imgDisp.style.display = 'none';
    }
}

// --- Class Logic ---
function setupClassLogic() {
    const btnAdd = document.getElementById('btn-add-class');
    const modal = document.getElementById('modal-class');
    const form = document.getElementById('form-class');

    btnAdd.addEventListener('click', () => {
        form.reset();
        document.getElementById('class-id').value = '';
        document.getElementById('modal-class-title').textContent = 'Yeni Sınıf Ekle';
        document.querySelectorAll('#level-selector .chip').forEach(c => c.classList.remove('selected'));
        modal.classList.add('active');
    });

    document.getElementById('btn-close-class-modal').addEventListener('click', () => modal.classList.remove('active'));

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveClass();
    });

    document.querySelectorAll('#level-selector .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#level-selector .chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            document.getElementById('class-level').value = chip.getAttribute('data-value');
        });
    });
}

function saveClass() {
    const id = document.getElementById('class-id').value;
    const name = document.getElementById('class-name').value;
    const level = document.getElementById('class-level').value;

    if (!level) {
        alert("Lütfen sınıf seviyesi seçin.");
        return;
    }

    const data = { name, level };
    if (id) data.id = Number(id);

    const tx = db.transaction(['classes'], 'readwrite');
    tx.objectStore('classes').put(data).onsuccess = () => {
        document.getElementById('modal-class').classList.remove('active');
        renderClasses();
    };
}

function renderClasses() {
    const list = document.getElementById('class-list');
    list.innerHTML = '';

    const tx = db.transaction(['classes'], 'readonly');
    tx.objectStore('classes').getAll().onsuccess = (e) => {
        const classes = e.target.result;
        if (classes.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>Henüz hiç sınıf eklenmedi.</p></div>';
            return;
        }

        classes.forEach(c => {
            const card = document.createElement('div');
            card.className = 'student-card';
            card.innerHTML = `
                <div class="student-list-avatar">🏫</div>
                <div class="student-info">
                    <h4>${c.name}</h4>
                    <p>${c.level}. Sınıf Seviyesi</p>
                </div>
            `;
            card.onclick = () => loadClassDetail(c.id);
            list.appendChild(card);
        });
    };
}

function loadClassDetail(classId) {
    currentClassId = classId;
    const tx = db.transaction(['classes'], 'readonly');
    tx.objectStore('classes').get(classId).onsuccess = (e) => {
        const c = e.target.result;
        document.getElementById('class-detail-title').textContent = c.name;
        navigate('view-class-detail');
        renderStudents(classId);
    };
}

// --- Student Logic ---
function setupStudentLogic() {
    const btnAdd = document.getElementById('btn-add-student');
    const modal = document.getElementById('modal-student');
    const form = document.getElementById('form-student');

    btnAdd.addEventListener('click', () => {
        form.reset();
        document.getElementById('student-id').value = '';
        document.getElementById('modal-student-title').textContent = 'Öğrenci Ekle';
        document.getElementById('student-class-id').value = currentClassId;
        document.getElementById('student-form-img').style.display = 'none';
        document.getElementById('student-form-avatar').style.display = 'block';
        document.querySelectorAll('#student-tags .chip').forEach(c => c.classList.remove('selected'));
        modal.classList.add('active');
    });

    document.getElementById('btn-close-student-modal').addEventListener('click', () => modal.classList.remove('active'));

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveStudent();
    });

    document.getElementById('student-photo-upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById('student-form-img').src = ev.target.result;
                document.getElementById('student-form-img').style.display = 'block';
                document.getElementById('student-form-avatar').style.display = 'none';
            };
            reader.readAsDataURL(file);
        }
    });

    document.querySelectorAll('#student-tags .chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
        });
    });

    document.getElementById('student-search').addEventListener('input', (e) => {
        const text = e.target.value.toLowerCase();
        document.querySelectorAll('#student-list .student-card').forEach(card => {
            const name = card.querySelector('h4').textContent.toLowerCase();
            card.style.display = name.includes(text) ? 'flex' : 'none';
        });
    });

    document.getElementById('btn-back-from-student').addEventListener('click', () => {
        if (currentClassId) loadClassDetail(currentClassId);
        else navigate('view-alumni', 'Mezunlar');
    });

    document.getElementById('btn-edit-student').addEventListener('click', () => {
        const tx = db.transaction(['students'], 'readonly');
        tx.objectStore('students').get(currentStudentId).onsuccess = (e) => {
            const s = e.target.result;
            document.getElementById('student-id').value = s.id;
            document.getElementById('student-name').value = s.name;
            document.getElementById('student-number').value = s.number;
            document.getElementById('student-mother-name').value = s.parents?.mother?.name || '';
            document.getElementById('student-mother-tel').value = s.parents?.mother?.tel || '';
            document.getElementById('student-father-name').value = s.parents?.father?.name || '';
            document.getElementById('student-father-tel').value = s.parents?.father?.tel || '';
            document.getElementById('student-notes').value = s.notes || '';

            if (s.photo) {
                document.getElementById('student-form-img').src = s.photo;
                document.getElementById('student-form-img').style.display = 'block';
                document.getElementById('student-form-avatar').style.display = 'none';
            }

            document.querySelectorAll('#student-tags .chip').forEach(chip => {
                if (s.tags && s.tags.includes(chip.getAttribute('data-value'))) chip.classList.add('selected');
                else chip.classList.remove('selected');
            });

            modal.classList.add('active');
        };
    });
}

function saveStudent() {
    const id = document.getElementById('student-id').value;
    const name = document.getElementById('student-name').value;
    const number = document.getElementById('student-number').value;
    const classId = Number(document.getElementById('student-class-id').value);
    const photo = document.getElementById('student-form-img').src;

    const selectedTags = Array.from(document.querySelectorAll('#student-tags .chip.selected')).map(c => c.getAttribute('data-value'));

    const data = {
        name, number, classId,
        tags: selectedTags,
        photo: photo.startsWith('data:') ? photo : null,
        parents: {
            mother: { name: document.getElementById('student-mother-name').value, tel: document.getElementById('student-mother-tel').value },
            father: { name: document.getElementById('student-father-name').value, tel: document.getElementById('student-father-tel').value }
        },
        notes: document.getElementById('student-notes').value,
        teacherNotes: [],
        exams: []
    };

    if (id) {
        data.id = Number(id);
        const txCheck = db.transaction(['students'], 'readonly');
        txCheck.objectStore('students').get(data.id).onsuccess = (e) => {
            const old = e.target.result;
            data.teacherNotes = old.teacherNotes || [];
            data.exams = old.exams || [];
            data.status = old.status;
            data.gradYear = old.gradYear;
            data.prevClass = old.prevClass;

            const txUpdate = db.transaction(['students'], 'readwrite');
            txUpdate.objectStore('students').put(data).onsuccess = () => {
                document.getElementById('modal-student').classList.remove('active');
                if (data.status === 'graduated') renderAlumni();
                else renderStudents(classId);
            };
        };
    } else {
        const tx = db.transaction(['students'], 'readwrite');
        tx.objectStore('students').add(data).onsuccess = () => {
            document.getElementById('modal-student').classList.remove('active');
            renderStudents(classId);
        };
    }
}

function renderStudents(classId) {
    const list = document.getElementById('student-list');
    list.innerHTML = '';

    const tx = db.transaction(['students'], 'readonly');
    const index = tx.objectStore('students').index('classId');
    index.getAll(classId).onsuccess = (e) => {
        const students = e.target.result;
        if (students.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>Bu sınıfta öğrenci yok.</p></div>';
            return;
        }

        students.forEach(s => {
            const card = document.createElement('div');
            card.className = 'student-card';
            let avatar = s.photo ? `<img src="${s.photo}" class="student-list-img">` : `<div class="student-list-avatar">🎓</div>`;
            card.innerHTML = `
                ${avatar}
                <div class="student-info">
                    <h4>${s.name}</h4>
                    <p>No: ${s.number}</p>
                </div>
            `;
            card.onclick = () => loadStudentProfile(s.id);
            list.appendChild(card);
        });
    };
}

function loadStudentProfile(studentId, readOnly = false) {
    currentStudentId = studentId;
    const tx = db.transaction(['students'], 'readonly');
    tx.objectStore('students').get(studentId).onsuccess = (e) => {
        const s = e.target.result;
        document.getElementById('std-profile-name').textContent = s.name;
        document.getElementById('std-profile-no').textContent = 'Öğrenci No: ' + s.number;

        const avatarDisp = document.getElementById('std-profile-avatar');
        const imgDisp = document.getElementById('std-profile-img');
        if (s.photo) {
            imgDisp.src = s.photo;
            imgDisp.style.display = 'block';
            avatarDisp.style.display = 'none';
        } else {
            avatarDisp.style.display = 'block';
            imgDisp.style.display = 'none';
        }

        // Tags
        const tagCont = document.getElementById('std-profile-tags');
        tagCont.innerHTML = '';
        if (s.tags) {
            s.tags.forEach(t => {
                const span = document.createElement('span');
                span.className = 'tag-badge';
                span.textContent = t;
                tagCont.appendChild(span);
            });
        }

        document.getElementById('std-mother-name').textContent = s.parents?.mother?.name || '-';
        document.getElementById('std-father-name').textContent = s.parents?.father?.name || '-';

        const mActions = document.getElementById('actions-mother');
        mActions.innerHTML = '';
        if (s.parents?.mother?.tel) {
            mActions.innerHTML = `<a href="tel:${s.parents.mother.tel}" class="btn-action call">📞</a> <a href="sms:${s.parents.mother.tel}" class="btn-action msg">💬</a>`;
        }

        const fActions = document.getElementById('actions-father');
        fActions.innerHTML = '';
        if (s.parents?.father?.tel) {
            fActions.innerHTML = `<a href="tel:${s.parents.father.tel}" class="btn-action call">📞</a> <a href="sms:${s.parents.father.tel}" class="btn-action msg">💬</a>`;
        }

        document.getElementById('std-general-notes').textContent = s.notes || 'Not yok.';

        renderNotes(s.teacherNotes, readOnly);
        renderExams(s.exams, readOnly);
        navigate('view-student-profile');

        // Toggle add buttons based on readOnly
        document.getElementById('btn-add-note').style.display = readOnly ? 'none' : 'flex';
        document.getElementById('btn-add-exam').style.display = readOnly ? 'none' : 'flex';
        document.getElementById('btn-edit-student').style.display = readOnly ? 'none' : 'block';
    };
}

// --- Performance (Notes/Exams) ---
function setupPerformanceLogic() {
    document.getElementById('btn-close-note-modal').onclick = () => document.getElementById('modal-note').classList.remove('active');
    document.getElementById('btn-close-exam-modal').onclick = () => document.getElementById('modal-exam').classList.remove('active');

    document.getElementById('btn-add-note').onclick = () => {
        document.getElementById('form-note').reset();
        document.getElementById('note-student-id').value = currentStudentId;
        document.getElementById('note-date').valueAsDate = new Date();
        document.getElementById('modal-note').classList.add('active');
    };

    document.getElementById('btn-add-exam').onclick = () => {
        document.getElementById('form-exam').reset();
        document.getElementById('exam-student-id').value = currentStudentId;
        document.getElementById('exam-date').valueAsDate = new Date();
        document.getElementById('modal-exam').classList.add('active');
    };

    document.getElementById('form-note').onsubmit = (e) => {
        e.preventDefault();
        saveNote();
    };

    document.getElementById('form-exam').onsubmit = (e) => {
        e.preventDefault();
        saveExam();
    };

    // Tab switching student profile
    document.querySelectorAll('#view-student-profile .tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#view-student-profile .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#view-student-profile .tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.getAttribute('data-tab')).classList.add('active');
        };
    });
}

function saveNote() {
    const sId = Number(document.getElementById('note-student-id').value);
    const text = document.getElementById('note-text').value;
    const date = document.getElementById('note-date').value;

    const tx = db.transaction(['students'], 'readwrite');
    const store = tx.objectStore('students');
    store.get(sId).onsuccess = (e) => {
        const s = e.target.result;
        if (!s.teacherNotes) s.teacherNotes = [];
        s.teacherNotes.unshift({ id: Date.now(), text, date });
        store.put(s).onsuccess = () => {
            document.getElementById('modal-note').classList.remove('active');
            renderNotes(s.teacherNotes);
        };
    };
}

function renderNotes(notes, readOnly) {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';
    if (!notes || notes.length === 0) {
        list.innerHTML = '<div class="empty-state-small">Not bulunmuyor.</div>';
        return;
    }
    notes.forEach(n => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-date">${new Date(n.date).toLocaleDateString('tr-TR')}</div>
            <div class="timeline-content">${n.text}</div>
        `;
        list.appendChild(item);
    });
}

function saveExam() {
    const sId = Number(document.getElementById('exam-student-id').value);
    const name = document.getElementById('exam-name').value;
    const date = document.getElementById('exam-date').value;
    const score = Number(document.getElementById('exam-score').value);

    const tx = db.transaction(['students'], 'readwrite');
    const store = tx.objectStore('students');
    store.get(sId).onsuccess = (e) => {
        const s = e.target.result;
        if (!s.exams) s.exams = [];
        s.exams.push({ id: Date.now(), name, date, score });
        store.put(s).onsuccess = () => {
            document.getElementById('modal-exam').classList.remove('active');
            renderExams(s.exams);
        };
    };
}

function renderExams(exams, readOnly) {
    const list = document.getElementById('exams-list');
    list.innerHTML = '';
    const avgVal = document.getElementById('exam-average');
    if (!exams || exams.length === 0) {
        list.innerHTML = '<div class="empty-state-small">Sınav bulunmuyor.</div>';
        avgVal.textContent = '-';
        return;
    }
    let sum = 0;
    exams.forEach(ex => {
        sum += ex.score;
        const item = document.createElement('div');
        item.className = 'exam-item';
        item.innerHTML = `
            <div class="exam-info"><h4>${ex.name}</h4><span>${new Date(ex.date).toLocaleDateString('tr-TR')}</span></div>
            <div class="exam-score">${ex.score}</div>
        `;
        list.appendChild(item);
    });
    avgVal.textContent = (sum / exams.length).toFixed(1);
}

// --- Alumni Logic ---
function setupAlumniLogic() {
    document.getElementById('alumni-search').oninput = filterAlumni;
    document.getElementById('alumni-year-filter').onchange = filterAlumni;
}

function renderAlumni() {
    const list = document.getElementById('alumni-list');
    list.innerHTML = '';
    const tx = db.transaction(['students'], 'readonly');
    tx.objectStore('students').getAll().onsuccess = (e) => {
        const students = e.target.result.filter(s => s.status === 'graduated');
        if (students.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>Henüz mezun öğrenci yok.</p></div>';
            return;
        }
        students.forEach(s => {
            const card = document.createElement('div');
            card.className = 'student-card alumni-card';
            card.setAttribute('data-name', s.name.toLowerCase());
            card.setAttribute('data-year', s.gradYear);
            card.innerHTML = `<div class="student-list-avatar">🎓</div><div class="student-info"><h4>${s.name}</h4><p>${s.gradYear} Mezunu</p></div>`;
            card.onclick = () => loadStudentProfile(s.id, true);
            list.appendChild(card);
        });
    };
}

function filterAlumni() {
    const txt = document.getElementById('alumni-search').value.toLowerCase();
    const yr = document.getElementById('alumni-year-filter').value;
    document.querySelectorAll('.alumni-card').forEach(c => {
        const matchTxt = c.getAttribute('data-name').includes(txt);
        const matchYr = yr === "" || c.getAttribute('data-year') === yr;
        c.style.display = (matchTxt && matchYr) ? 'flex' : 'none';
    });
}

// --- Transition / Education Year ---
function setupTransitionLogic() {
    document.getElementById('btn-year-transition').onclick = () => document.getElementById('modal-transition').classList.add('active');
    document.getElementById('btn-cancel-transition').onclick = () => document.getElementById('modal-transition').classList.remove('active');
    document.getElementById('btn-confirm-transition').onclick = performYearTransition;
}

function performYearTransition() {
    const tx = db.transaction(['classes', 'students'], 'readwrite');
    const cStore = tx.objectStore('classes');
    const sStore = tx.objectStore('students');
    const currentYear = new Date().getFullYear();

    cStore.getAll().onsuccess = (e) => {
        const classes = e.target.result;
        const gradIds = classes.filter(c => Number(c.level) >= 12).map(c => c.id);

        classes.forEach(c => {
            const lvl = Number(c.level);
            if (lvl >= 12) cStore.delete(c.id);
            else {
                c.level = (lvl + 1).toString();
                c.name = c.name.replace(lvl.toString(), c.level);
                cStore.put(c);
            }
        });

        sStore.getAll().onsuccess = (ev) => {
            const students = ev.target.result;
            students.forEach(s => {
                if (s.classId && gradIds.includes(s.classId)) {
                    s.status = 'graduated';
                    s.gradYear = currentYear;
                    s.prevClass = classes.find(c => c.id === s.classId)?.name || '';
                    s.classId = null;
                    sStore.put(s);
                }
            });
        };
    };

    tx.oncomplete = () => {
        alert("Eğitim yılı geçişi tamamlandı.");
        document.getElementById('modal-transition').classList.remove('active');
        renderClasses();
        renderAlumni();
    };
}

// --- Plans Logic ---
function setupPlansLogic() {
    document.getElementById('btn-dash-plans').onclick = () => navigate('view-plans', 'Planlarım');
    document.getElementById('btn-settings-plans').onclick = () => navigate('view-plans', 'Planlarım');
    document.getElementById('btn-add-plan').onclick = () => {
        document.getElementById('form-plan').reset();
        document.getElementById('plan-id').value = '';
        document.getElementById('modal-plan').classList.add('active');
    };
    document.getElementById('btn-close-plan-modal').onclick = () => document.getElementById('modal-plan').classList.remove('active');

    document.getElementById('form-plan').onsubmit = (e) => {
        e.preventDefault();
        savePlan();
    };

    // Tab switching plans
    document.querySelectorAll('#view-plans .tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#view-plans .tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderPlans();
        };
    });
}

function savePlan() {
    const title = document.getElementById('plan-title').value;
    const type = document.getElementById('plan-type').value;
    const fileInput = document.getElementById('plan-file');
    const file = fileInput.files[0];

    if (!file) {
        alert("Lütfen bir dosya seçin.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const plan = { title, type, fileData: e.target.result, fileName: file.name, createdAt: new Date() };
        const tx = db.transaction(['plans'], 'readwrite');
        tx.objectStore('plans').add(plan).onsuccess = () => {
            document.getElementById('modal-plan').classList.remove('active');
            renderPlans();
        };
    };
    reader.readAsDataURL(file);
}

function renderPlans() {
    const activeTab = document.querySelector('#view-plans .tab-btn.active').getAttribute('data-tab');
    const targetType = activeTab === 'plan-yearly' ? 'yearly' : 'weekly';
    const container = document.getElementById('plan-list-container');
    container.innerHTML = '';

    const tx = db.transaction(['plans'], 'readonly');
    tx.objectStore('plans').getAll().onsuccess = (e) => {
        const plans = e.target.result.filter(p => p.type === targetType);
        if (plans.length === 0) {
            container.innerHTML = '<div class="empty-state-small">Henüz plan eklenmedi.</div>';
            return;
        }
        plans.forEach(p => {
            const el = document.createElement('div');
            el.className = 'info-card';
            el.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div><strong>${p.title}</strong><br><small>${p.fileName}</small></div>
                    <button class="btn-secondary" style="padding: 5px 10px;">Aç</button>
                </div>
            `;
            el.querySelector('button').onclick = () => {
                const win = window.open();
                win.document.write(`<iframe src="${p.fileData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
            };
            container.appendChild(el);
        });
    };
}

// --- Settings ---
function setupSettingsLogic() {
    document.getElementById('btn-settings-profile').onclick = () => document.getElementById('btn-edit-profile').click();
    document.getElementById('btn-settings-theme').onclick = () => document.getElementById('modal-theme').classList.add('active');
    document.getElementById('btn-close-theme-modal').onclick = () => document.getElementById('modal-theme').classList.remove('active');
    document.getElementById('btn-settings-info').onclick = () => navigate('view-info', 'Hakkında');

    document.getElementById('btn-reset-data').onclick = () => {
        if (confirm("DİKKAT! Tüm verileriniz kalıcı olarak silinecektir. Emin misiniz?")) {
            resetAppData();
        }
    };

    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.onclick = () => {
            const theme = opt.getAttribute('data-theme');
            applyTheme(theme);
            localStorage.setItem('app-theme', theme);
            document.getElementById('modal-theme').classList.remove('active');
        };
    });
}

function applyTheme(theme) {
    document.body.classList.remove('theme-green', 'theme-dark');
    if (theme === 'green') document.body.classList.add('theme-green');
    if (theme === 'dark') document.body.classList.add('theme-dark');
}

function resetAppData() {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => {
        localStorage.clear();
        location.reload();
    };
}

// --- PDF Logic ---
function setupPDFLogic() {
    document.getElementById('btn-create-pdf').onclick = generatePDF;
}

function generatePDF() {
    const tx = db.transaction(['students', 'teachers', 'classes'], 'readonly');
    let teacher, student, className;

    tx.objectStore('teachers').get('teacher_profile').onsuccess = (e) => teacher = e.target.result;
    tx.objectStore('students').get(currentStudentId).onsuccess = (e) => {
        student = e.target.result;
        if (student.classId) {
            db.transaction(['classes'], 'readonly').objectStore('classes').get(student.classId).onsuccess = (ev) => {
                className = ev.target.result?.name;
                renderPrintView(teacher, student, className);
            };
        } else {
            className = student.prevClass;
            renderPrintView(teacher, student, className);
        }
    };
}

function renderPrintView(teacher, student, className) {
    const printArea = document.getElementById('print-area');
    const today = new Date().toLocaleDateString('tr-TR');

    let examsHtml = student.exams?.length ? `<table style="width:100%; border-collapse:collapse; margin-top:10px;">` + student.exams.map(e => `<tr style="border-bottom:1px solid #eee;"><td>${e.name}</td><td>${e.score}</td></tr>`).join('') + `</table>` : 'Sınav yok.';
    let notesHtml = student.teacherNotes?.length ? student.teacherNotes.map(n => `<div style="margin-top:10px; font-size:14px;"><strong>${n.date}:</strong> ${n.text}</div>`).join('') : 'Not yok.';

    printArea.innerHTML = `
        <div style="padding:40px; font-family:sans-serif;">
            <h1 style="text-align:center;">${teacher.school}</h1>
            <h2 style="text-align:center;">Öğrenci Gözlem Formu</h2>
            <hr>
            <p><strong>Öğretmen:</strong> ${teacher.name} (${teacher.branch})</p>
            <p><strong>Öğrenci:</strong> ${student.name} (${student.number})</p>
            <p><strong>Sınıf:</strong> ${className || '-'}</p>
            <h3>Sınav Notları</h3>${examsHtml}
            <h3>Öğretmen Notları</h3>${notesHtml}
            <footer style="margin-top:50px; text-align:right;"><p>${today}</p></footer>
        </div>
    `;
    window.print();
}

// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=7');
}
