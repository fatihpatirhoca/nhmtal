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
        setupExcelImportLogic();
        setupSettingsLogic();
    } catch (e) {
        console.error("Setup Error:", e);
    }

    // Check theme
    try {
        const savedTheme = localStorage.getItem('app-theme') || 'navy';
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

        // Reset Student Detail State
        if (viewId !== 'view-student-profile') {
            currentStudentId = null;
        }

        // Custom View Refresh
        if (viewId === 'view-plans') {
            renderPlans('yearly');
            renderPlans('weekly');
        }
        if (viewId === 'view-students') {
            renderAllStudents();
        }
        if (viewId === 'view-classes') {
            renderClasses();
        }
        if (viewId === 'view-alumni') {
            renderAlumni();
        }
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
        document.getElementById('modal-import-choice').classList.add('active');
    });

    document.getElementById('btn-close-import-choice').onclick = () => document.getElementById('modal-import-choice').classList.remove('active');

    document.getElementById('btn-choice-manual').onclick = () => {
        document.getElementById('modal-import-choice').classList.remove('active');
        form.reset();
        document.getElementById('class-id').value = '';
        document.getElementById('modal-class-title').textContent = 'Yeni Sınıf Ekle';
        document.getElementById('btn-delete-class').style.display = 'none';
        modal.classList.add('active');
    };

    document.getElementById('btn-choice-excel').onclick = () => {
        document.getElementById('modal-import-choice').classList.remove('active');
        openExcelImport();
    };

    document.getElementById('btn-close-class-modal').addEventListener('click', () => modal.classList.remove('active'));

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        saveClass();
    });

    document.getElementById('btn-delete-class').onclick = () => {
        const id = Number(document.getElementById('class-id').value);
        if (confirm("Bu sınıfı ve içindeki TÜM ÖĞRENCİLERİ silmek istediğinize emin misiniz?")) {
            deleteClass(id);
        }
    };
}

function saveClass() {
    const id = document.getElementById('class-id').value;
    const name = document.getElementById('class-name').value;

    // Auto-infer level (e.g., "9-A" -> 9, "Hazırlık" -> 0)
    let level = parseInt(name);
    if (isNaN(level)) level = 0;

    const data = { name, level };
    if (id) data.id = Number(id);

    const tx = db.transaction(['classes'], 'readwrite');
    tx.objectStore('classes').put(data).onsuccess = () => {
        document.getElementById('modal-class').classList.remove('active');
        renderClasses();
    };
}

function deleteClass(id) {
    const tx = db.transaction(['classes', 'students'], 'readwrite');
    tx.objectStore('classes').delete(id);
    // Also delete students in this class? Or move to alumni/unassigned?
    // User said "sil". Usually safe to just delete class. 
    // But let's be clean and delete students too or allow cascading.
    // Index-based deletion:
    const sStore = tx.objectStore('students');
    sStore.getAll().onsuccess = (e) => {
        const students = e.target.result.filter(s => s.classId === id);
        students.forEach(s => sStore.delete(s.id));
    };

    tx.oncomplete = () => {
        document.getElementById('modal-class').classList.remove('active');
        renderClasses();
    };
}

// --- Excel Import Logic ---
let pendingStudents = [];

function setupExcelImportLogic() {
    const fileInput = document.getElementById('excel-file-input');
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleExcelFile(file);
    };

    document.getElementById('btn-cancel-import').onclick = () => {
        document.getElementById('import-step-2').style.display = 'none';
        document.getElementById('import-step-1').style.display = 'block';
        pendingStudents = [];
    };

    document.getElementById('btn-confirm-import').onclick = processImport;
    document.getElementById('btn-finish-import').onclick = () => {
        document.getElementById('modal-excel-import').classList.remove('active');
        renderClasses();
        renderAllStudents();
    };
}

function openExcelImport() {
    document.getElementById('import-step-1').style.display = 'block';
    document.getElementById('import-step-2').style.display = 'none';
    document.getElementById('import-step-3').style.display = 'none';
    document.getElementById('excel-file-input').value = '';
    document.getElementById('modal-excel-import').classList.add('active');
}

function handleExcelFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            if (json.length < 2) throw new Error("Dosya boş görünüyor.");

            let detectedClassName = "";
            let colIndexNo = -1;
            let colIndexName = -1;
            let dataStartRow = -1;

            // 1. Scan for Class Name and Table Headers (Deep Search)
            for (let r = 0; r < Math.min(json.length, 30); r++) {
                const row = json[r];
                if (!row) continue;

                for (let c = 0; c < row.length; c++) {
                    const cellVal = String(row[c] || "").trim();

                    // Search for Class Name Tag
                    if (cellVal.includes("Sınıfı / Şubesi") || cellVal.includes("Sınıf/Şube")) {
                        // Scan the rest of the row for the first non-empty value
                        for (let scanCol = c; scanCol < row.length; scanCol++) {
                            let val = String(row[scanCol] || "").trim();
                            // Skip the label itself and empty/useless cells
                            if (val.includes("Sınıfı / Şubesi") || val.includes("Sınıf/Şube") || val === ":" || val === "-" || !val) continue;

                            // Found the actual name! Clean it up (remove leading colons etc)
                            detectedClassName = val.replace(/^[:\s-]+/, "").trim();
                            if (detectedClassName) break;
                        }
                    }

                    // Search for Table Headers
                    if (cellVal.includes("Okul Numarası") || cellVal.includes("Öğrenci No")) {
                        colIndexNo = c;
                        dataStartRow = r + 1;
                    }
                    if (cellVal.includes("Adı Soyadı") || cellVal.includes("Ad Soyad")) {
                        colIndexName = c;
                    }
                }
                if (colIndexNo !== -1 && colIndexName !== -1) break;
            }

            // Fallback for simple flat lists
            if (colIndexNo === -1) {
                const headers = json[0].map(h => String(h || '').toLowerCase().trim());
                colIndexNo = headers.findIndex(h => h.includes('no') || h.includes('numara'));
                colIndexName = headers.findIndex(h => h.includes('ad') || h.includes('isim'));
                dataStartRow = 1;
            }

            if (colIndexNo === -1 || colIndexName === -1) {
                throw new Error("Sütunlar bulunamadı. Dosyada 'Okul Numarası' ve 'Adı Soyadı' başlıklarının olduğundan emin olun.");
            }

            // 2. Data Extraction
            pendingStudents = [];
            for (let i = dataStartRow; i < json.length; i++) {
                const row = json[i];
                if (!row) continue;

                const rawNo = String(row[colIndexNo] || "").trim();
                const rawName = String(row[colIndexName] || "").trim();

                // Stop conditions for e-Okul footer or empty rows
                if (!rawNo || isNaN(parseInt(rawNo)) || rawName.includes("Toplam Öğrenci")) continue;

                let sClassName = detectedClassName;
                if (!sClassName) {
                    // Try to find class column in row
                    const headers = json[0].map(h => String(h || '').toLowerCase().trim());
                    const sinifColIdx = headers.findIndex(h => h.includes('sınıf') || h.includes('şube'));
                    if (sinifColIdx !== -1) sClassName = String(row[sinifColIdx] || "").trim();
                }

                pendingStudents.push({
                    number: rawNo,
                    name: rawName,
                    className: sClassName || "Genel"
                });
            }

            if (pendingStudents.length === 0) throw new Error("Dosyadan öğrenci verisi ayıklanamadı.");

            // 3. Preview (First 5)
            const previewTable = document.getElementById('import-preview-table');
            previewTable.innerHTML = `
                <tr style="background: rgba(var(--primary-rgb), 0.1); font-weight: 700;">
                    <td style="padding: 10px; border: 1px solid #ddd;">No</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">Ad Soyad</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">Sınıf</td>
                </tr>
            `;
            pendingStudents.slice(0, 5).forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding: 10px; border: 1px solid #ddd;">${s.number}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${s.name}</td>
                    <td style="padding: 10px; border: 1px solid #ddd;">${s.className}</td>
                `;
                previewTable.appendChild(tr);
            });

            document.getElementById('import-step-1').style.display = 'none';
            document.getElementById('import-step-2').style.display = 'block';

        } catch (err) {
            alert("Dosya Okuma Hatası: " + err.message);
            console.error(err);
        }
    };
    reader.readAsArrayBuffer(file);
}

async function processImport() {
    const btnConfirm = document.getElementById('btn-confirm-import');
    btnConfirm.disabled = true;
    btnConfirm.textContent = "Aktarılıyor...";

    try {
        const classMap = {}; // name -> id
        let addedCount = 0;
        let skippedCount = 0;

        // 1. Get existing classes to map names
        const cTx = db.transaction(['classes'], 'readonly');
        const cStore = cTx.objectStore('classes');
        const existingClasses = await new Promise(r => cStore.getAll().onsuccess = (e) => r(e.target.result));
        existingClasses.forEach(c => classMap[c.name] = c.id);

        // 2. Loop and process
        for (const s of pendingStudents) {
            // A. Ensure class exists
            if (!classMap[s.className]) {
                const newClass = { name: s.className, level: parseInt(s.className) || 0 };
                const cAddTx = db.transaction(['classes'], 'readwrite');
                const newId = await new Promise(r => {
                    const req = cAddTx.objectStore('classes').add(newClass);
                    req.onsuccess = (e) => r(e.target.result);
                });
                classMap[s.className] = newId;
            }

            const activeClassId = classMap[s.className];

            // B. Check if student (No + Class) already exists
            const sTx = db.transaction(['students'], 'readonly');
            const sStore = sTx.objectStore('students');
            const index = sStore.index('classId');
            const classStudents = await new Promise(r => index.getAll(activeClassId).onsuccess = (e) => r(e.target.result));

            const isDuplicate = classStudents.some(cs => cs.number === s.number);

            if (!isDuplicate) {
                // C. Add Student
                const studentData = {
                    number: s.number,
                    name: s.name,
                    classId: activeClassId,
                    status: 'active',
                    updatedAt: new Date()
                };
                const sAddTx = db.transaction(['students'], 'readwrite');
                await new Promise(r => sAddTx.objectStore('students').add(studentData).onsuccess = () => r());
                addedCount++;
            } else {
                skippedCount++;
            }
        }

        // 3. Show Result
        document.getElementById('count-added').textContent = addedCount;
        document.getElementById('count-skipped').textContent = skippedCount;
        document.getElementById('import-step-2').style.display = 'none';
        document.getElementById('import-step-3').style.display = 'block';

    } catch (err) {
        alert("Kritik Hata: " + err.message);
        console.error(err);
    } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = "Aktarımı Başlat";
    }
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
                    <p>${c.level > 0 ? c.level + '. Sınıf' : 'Sınıf'}</p>
                </div>
                <button class="btn-text" style="margin-left:auto; font-size:1.2rem; color:#888;" onclick="event.stopPropagation(); openEditClassModal(${c.id})">⚙️</button>
            `;
            card.onclick = () => loadClassDetail(c.id);
            list.appendChild(card);
        });
    };
}

function openEditClassModal(id) {
    const tx = db.transaction(['classes'], 'readonly');
    tx.objectStore('classes').get(id).onsuccess = (e) => {
        const c = e.target.result;
        document.getElementById('class-id').value = c.id;
        document.getElementById('class-name').value = c.name;
        document.getElementById('modal-class-title').textContent = 'Sınıfı Düzenle';
        document.getElementById('btn-delete-class').style.display = 'block'; // Show delete
        document.getElementById('modal-class').classList.add('active');
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
        document.getElementById('btn-delete-student').style.display = 'none'; // Hide delete
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
        // If we came from the global list, go back there
        if (document.getElementById('view-students').classList.contains('active') || !currentClassId) {
            navigate('view-students', 'Öğrenciler');
        } else {
            loadClassDetail(currentClassId);
        }
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
            document.getElementById('btn-delete-student').style.display = 'block'; // Show delete
        };
    });

    document.getElementById('btn-delete-student').onclick = () => {
        const id = Number(document.getElementById('student-id').value);
        if (confirm("Bu öğrenciyi silmek istediğinize emin misiniz?")) {
            deleteStudent(id);
        }
    };
}

// Consolidated saveStudent and removed duplicates
function saveStudent() {
    const id = document.getElementById('student-id').value;
    const name = document.getElementById('student-name').value;
    const number = document.getElementById('student-number').value;
    const classId = Number(document.getElementById('student-class-id').value);

    // Photo Logic
    const photoImg = document.getElementById('student-form-img');
    const photo = (photoImg.style.display === 'block') ? photoImg.src : null;

    // Tags
    const tags = [];
    document.querySelectorAll('#student-tags .chip.selected').forEach(c => tags.push(c.getAttribute('data-value')));

    const studentData = {
        number,
        name,
        classId,
        photo,
        tags,
        parents: {
            mother: {
                name: document.getElementById('student-mother-name').value,
                tel: document.getElementById('student-mother-tel').value
            },
            father: {
                name: document.getElementById('student-father-name').value,
                tel: document.getElementById('student-father-tel').value
            }
        },
        notes: document.getElementById('student-notes').value,
        status: 'active',
        updatedAt: new Date()
    };

    if (id) {
        studentData.id = Number(id);
        const tx = db.transaction(['students'], 'readonly');
        tx.objectStore('students').get(Number(id)).onsuccess = (e) => {
            const existing = e.target.result;
            if (existing) {
                studentData.exams = existing.exams || [];
                studentData.teacherNotes = existing.teacherNotes || [];
                studentData.status = existing.status || 'active';
                if (existing.gradYear) studentData.gradYear = existing.gradYear;
                if (existing.prevClass) studentData.prevClass = existing.prevClass;
            }
            performSaveStudent(studentData);
        };
    } else {
        performSaveStudent(studentData);
    }
}

function performSaveStudent(studentData) {
    const tx = db.transaction(['students'], 'readwrite');
    tx.objectStore('students').put(studentData).onsuccess = () => {
        document.getElementById('modal-student').classList.remove('active');
        if (currentClassId) renderStudents(currentClassId);
        if (currentStudentId) loadStudentProfile(currentStudentId);
        if (document.getElementById('view-students').classList.contains('active')) {
            renderAllStudents();
        }
    };
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

function renderAllStudents() {
    const list = document.getElementById('global-student-list');
    if (!list) return;
    list.innerHTML = '';

    const tx = db.transaction(['students'], 'readonly');
    tx.objectStore('students').getAll().onsuccess = (e) => {
        const students = e.target.result.filter(s => s.status !== 'graduated'); // Only active students
        if (students.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>Henüz kayıtlı öğrenci yok.</p></div>';
            return;
        }

        students.forEach(s => {
            const card = document.createElement('div');
            card.className = 'student-card global-student-card';
            card.setAttribute('data-name', s.name.toLowerCase());
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

// Global Search logic for All Students
document.getElementById('global-student-search').addEventListener('input', (e) => {
    const text = e.target.value.toLowerCase();
    document.querySelectorAll('.global-student-card').forEach(card => {
        const name = card.getAttribute('data-name');
        card.style.display = name.includes(text) ? 'flex' : 'none';
    });
});

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

        // Auto-select type based on active tab
        const activeTab = document.querySelector('#view-plans .tab-btn.active').getAttribute('data-tab');
        const typeSelect = document.getElementById('plan-type');
        if (activeTab === 'plan-weekly') {
            typeSelect.value = 'weekly';
        } else {
            typeSelect.value = 'yearly';
        }

        document.getElementById('modal-plan').classList.add('active');
    };
    document.getElementById('btn-close-plan-modal').onclick = () => document.getElementById('modal-plan').classList.remove('active');

    document.getElementById('form-plan').onsubmit = (e) => {
        e.preventDefault();
        savePlan();
    };

    // Scroll Memory for Tabs
    const planScrollPositions = { 'plan-yearly': 0, 'plan-weekly': 0 };

    // Viewer Logic
    document.getElementById('btn-close-viewer').onclick = () => {
        if (history.state && history.state.modal === 'viewer') {
            history.back(); // Will trigger popstate and close
        } else {
            const viewer = document.getElementById('modal-file-viewer');
            const frame = document.getElementById('viewer-frame');
            viewer.classList.remove('active');
            frame.src = '';
        }
    };

    // Tab switching plans
    document.querySelectorAll('#view-plans .tab-btn').forEach(btn => {
        btn.onclick = () => {
            const mainContent = document.getElementById('main-content');
            const currentTab = document.querySelector('#view-plans .tab-btn.active').getAttribute('data-tab');

            // 1. Save current scroll
            planScrollPositions[currentTab] = mainContent.scrollTop;

            const tabId = btn.getAttribute('data-tab');
            document.querySelectorAll('#view-plans .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.plan-tab-content').forEach(c => {
                c.style.display = 'none';
                c.classList.remove('active');
            });

            btn.classList.add('active');
            const targetContainerId = tabId === 'plan-yearly' ? 'plan-yearly-list' : 'plan-weekly-list';
            const targetContainer = document.getElementById(targetContainerId);
            targetContainer.style.display = 'block';
            targetContainer.classList.add('active');

            // 2. Restore tab scroll after a tiny delay for layout
            setTimeout(() => {
                mainContent.scrollTop = planScrollPositions[tabId] || 0;
            }, 0);

            // Re-render when switching just in case
            renderPlans(tabId === 'plan-yearly' ? 'yearly' : 'weekly');
        };
    });
}

async function savePlan() {
    const title = document.getElementById('plan-title').value;
    const type = document.getElementById('plan-type').value;
    const fileInput = document.getElementById('plan-file');
    const file = fileInput.files[0];

    if (!file) {
        alert("Lütfen bir dosya seçin.");
        return;
    }

    // Edge Case: File Size Check (10MB limit to prevent IDB/Memory issues)
    if (file.size > 10 * 1024 * 1024) {
        alert("Dosya çok büyük (Maksimum 10MB). Lütfen daha küçük bir dosya seçin.");
        return;
    }

    const btn = document.querySelector('#form-plan button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = "PDF'e Dönüştürülüyor...";
    btn.disabled = true;

    try {
        let fileData = null;
        let isNative = false;

        // Try to convert Image
        // Store Images directly for better performance/quality as requested
        if (file.type.startsWith('image/')) {
            fileData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
            isNative = true;
        } else if (file.name.toLowerCase().endsWith('.pdf')) {
            // Store PDF as Data URL directly
            fileData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        } else {
            // Word/Excel -> Store as base64 to allow download
            isNative = true;
            fileData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.readAsDataURL(file);
            });
        }

        const plan = {
            title,
            type,
            fileData: fileData,
            fileName: file.name, // Keep original extension
            originalName: file.name,
            isNative: isNative, // Flag for handling view
            createdAt: new Date()
        };

        const tx = db.transaction(['plans'], 'readwrite');
        tx.objectStore('plans').add(plan).onsuccess = () => {
            document.getElementById('modal-plan').classList.remove('active');
            renderPlans(type);
        };
    } catch (error) {
        console.error("Dosya Hatası:", error);
        alert("Dosya yüklenirken hata oluştu: " + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// Simplified Conversion: Only for Images. 
// Word/Excel/PDF are stored as-is for native viewing.
async function convertFileToPDF(file) {
    const fileName = file.name.toLowerCase();

    // 1. Image -> PDF (We still convert images because they are easy and good for consistent viewing)
    if (file.type.startsWith('image/')) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.src = e.target.result;
                img.onload = () => {
                    const { jsPDF } = window.jspdf;
                    const pdf = new jsPDF();
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
                    const w = img.width * ratio;
                    const h = img.height * ratio;
                    pdf.addImage(img, 'JPEG', 10, 10, w - 20, h - 20);
                    resolve(pdf.output('datauristring'));
                };
            };
            reader.readAsDataURL(file);
        });
    }

    // 2. Others (PDF, DOCX, XLSX) -> Return null (Signaling "Store Original")
    return null;
}

async function renderHtmlToPdf(htmlContent) {
    const { jsPDF } = window.jspdf;

    // Create a visibly positioned but obscured container to ensure rendering engines catch it
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '800px'; // Standard width
    container.style.zIndex = '-9999';
    container.style.background = '#ffffff';
    container.style.padding = '40px';
    container.style.color = '#000000';

    // Inject Content
    container.innerHTML = `
        <div style="border-bottom: 2px solid #4a90e2; padding-bottom: 15px; margin-bottom: 30px;">
            <h2 style="color: #4a90e2; margin: 0; font-family: sans-serif;">Ders Planı</h2>
            <small style="color: #666; font-family: sans-serif;">NHMTAL Öğretmen Asistanı</small>
        </div>
        <div style="font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; line-height: 1.6;">
            ${htmlContent}
        </div>
    `;

    document.body.appendChild(container);

    // Wait for DOM to settle
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
        const canvas = await window.html2canvas(container, {
            scale: 1, // Safe scale for mobile memory
            useCORS: true,
            logging: false,
            windowWidth: 800
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.85); // JPEG is more efficient
        const pdf = new jsPDF('p', 'mm', 'a4');

        const imgWidth = 210; // A4 width in mm
        const pageHeight = 297; // A4 height in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // First Page
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        // Subsequent Pages (if long content)
        while (heightLeft >= 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;
        }

        return pdf.output('datauristring');

    } catch (err) {
        console.error("PDF Render Failed:", err);
        throw new Error("PDF oluşturulurken bir görsel hatası oluştu.");
    } finally {
        if (document.body.contains(container)) {
            document.body.removeChild(container);
        }
    }
}

function renderPlans(targetType) {
    const containerId = targetType === 'yearly' ? 'plan-yearly-list' : 'plan-weekly-list';
    const container = document.getElementById(containerId);
    if (!container) return;

    // Show Loading inside the specific container
    container.innerHTML = '<div class="empty-state-small">🔄 Yükleniyor...</div>';

    const tx = db.transaction(['plans'], 'readonly');
    const store = tx.objectStore('plans');

    store.getAll().onsuccess = (e) => {
        const plans = e.target.result.filter(p => p.type === targetType);
        container.innerHTML = ''; // Clear loading

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
            el.querySelector('button').onclick = async () => {
                const isPdf = p.fileName.toLowerCase().endsWith('.pdf');
                const isWord = p.fileName.toLowerCase().endsWith('.docx');
                const isExcel = p.fileName.toLowerCase().endsWith('.xlsx') || p.fileName.toLowerCase().endsWith('.xls');
                const isImage = p.fileName.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp)$/i) || p.fileData.startsWith('data:image/');

                const viewer = document.getElementById('modal-file-viewer');
                const frame = document.getElementById('viewer-frame');
                const title = document.getElementById('viewer-title');

                title.textContent = p.originalName || p.title;

                // 0. Image Preview
                if (isImage) {
                    viewer.classList.add('active');
                    frame.srcdoc = `
                        <html>
                        <body style="margin:0; background:#2c2c2c; display:flex; align-items:center; justify-content:center; height:100vh;">
                            <img src="${p.fileData}" style="max-width:100%; max-height:100%; object-fit:contain;">
                        </body>
                        </html>
                    `;
                    history.pushState({ modal: 'viewer' }, '', '#viewer');
                    return;
                }

                // 1. Word Document (.docx) -> HTML Preview
                if (isWord) {
                    try {
                        viewer.classList.add('active');
                        frame.srcdoc = '<div style="padding:20px; font-family:sans-serif; color:white;">🔄 Belge hazırlanıyor...</div>';

                        const response = await fetch(p.fileData);
                        const arrayBuffer = await response.arrayBuffer();
                        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });

                        const htmlContent = `
                            <html>
                            <head>
                                <style>
                                    body { font-family: -apple-system, system-ui; padding: 30px; line-height: 1.6; color: #333; background: white; }
                                    img { max-width: 100%; height: auto; }
                                    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
                                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                </style>
                            </head>
                            <body>${result.value || 'Belge içeriği boş.'}</body>
                            </html>
                        `;
                        frame.srcdoc = htmlContent;
                        history.pushState({ modal: 'viewer' }, '', '#viewer');
                        return;
                    } catch (err) {
                        console.error("Word conversion error:", err);
                    }
                }

                // 2. Excel Document (.xlsx) -> Table Preview
                if (isExcel) {
                    try {
                        viewer.classList.add('active');
                        frame.srcdoc = '<div style="padding:20px; font-family:sans-serif; color:white;">🔄 Tablo hazırlanıyor...</div>';

                        const response = await fetch(p.fileData);
                        const arrayBuffer = await response.arrayBuffer();
                        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
                        const firstSheetName = workbook.SheetNames[0];
                        const worksheet = workbook.Sheets[firstSheetName];
                        const htmlTable = XLSX.utils.sheet_to_html(worksheet);

                        const htmlContent = `
                            <html>
                            <head>
                                <style>
                                    body { font-family: sans-serif; padding: 20px; background: white; }
                                    table { border-collapse: collapse; width: 100%; font-size: 14px; }
                                    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
                                    th { background: #f4f4f4; }
                                </style>
                            </head>
                            <body>${htmlTable}</body>
                            </html>
                        `;
                        frame.srcdoc = htmlContent;
                        history.pushState({ modal: 'viewer' }, '', '#viewer');
                        return;
                    } catch (err) {
                        console.error("Excel conversion error:", err);
                    }
                }

                // 3. PDF or Native Fallback
                if (isPdf) {
                    try {
                        const byteString = atob(p.fileData.split(',')[1]);
                        const arrayBuffer = new ArrayBuffer(byteString.length);
                        const ia = new Uint8Array(arrayBuffer);
                        for (let i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i);
                        }
                        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                        const blobUrl = URL.createObjectURL(blob);

                        frame.src = blobUrl;
                        viewer.classList.add('active');
                        history.pushState({ modal: 'viewer' }, '', '#viewer');
                    } catch (e) {
                        frame.src = p.fileData;
                        viewer.classList.add('active');
                        history.pushState({ modal: 'viewer' }, '', '#viewer');
                    }
                } else if (p.isNative) {
                    // If we reach here, Word/Excel conversion failed or it's another file type
                    // Show in viewer anyway (iOS Safari might preview it)
                    frame.src = p.fileData;
                    viewer.classList.add('active');
                    history.pushState({ modal: 'viewer' }, '', '#viewer');
                }
            };
            container.appendChild(el);
        });
    };
}

// Global Popstate for Viewer
window.onpopstate = (event) => {
    const viewer = document.getElementById('modal-file-viewer');
    if (viewer.classList.contains('active')) {
        viewer.classList.remove('active');
        document.getElementById('viewer-frame').src = '';
    }
};

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
    document.body.classList.remove('theme-green', 'theme-dark', 'theme-navy', 'theme-rose');

    if (theme === 'green') document.body.classList.add('theme-green');
    if (theme === 'navy') document.body.classList.add('theme-navy');
    if (theme === 'rose') document.body.classList.add('theme-rose');

    // 'default' (Silver Mist) implies no extra class, just base :root variables
    document.documentElement.setAttribute('data-theme', theme);
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

async function generatePDF() {
    if (!currentStudentId) return;

    const btn = document.getElementById('btn-create-pdf');
    const originalText = btn.textContent;
    btn.textContent = "⌛ PDF Hazırlanıyor...";
    btn.disabled = true;

    try {
        const tx = db.transaction(['students', 'teachers', 'classes'], 'readonly');
        const teacherReq = tx.objectStore('teachers').get('teacher_profile');
        const studentReq = tx.objectStore('students').get(currentStudentId);

        const [teacher, student] = await Promise.all([
            new Promise(r => teacherReq.onsuccess = (e) => r(e.target.result)),
            new Promise(r => studentReq.onsuccess = (e) => r(e.target.result))
        ]);

        let className = '-';
        if (student.classId) {
            const classReq = db.transaction(['classes'], 'readonly').objectStore('classes').get(student.classId);
            const classData = await new Promise(r => classReq.onsuccess = (e) => r(e.target.result));
            className = classData ? classData.name : '-';
        } else {
            className = student.prevClass || '-';
        }

        const today = new Date().toLocaleDateString('tr-TR');

        // Generate Professional HTML for PDF
        const pdfHtml = `
            <div style="font-family: Arial, sans-serif; color: #333; padding: 20px;">
                <div style="text-align: center; border-bottom: 2px solid #4a90e2; padding-bottom: 10px; margin-bottom: 20px;">
                    <h1 style="margin: 0; color: #4a90e2; font-size: 24px;">${teacher.school || 'Okul Adı'}</h1>
                    <h2 style="margin: 5px 0 0; font-size: 18px; color: #666;">Öğrenci Bilgi Formu</h2>
                </div>

                <div style="display: flex; gap: 20px; margin-bottom: 30px; align-items: start;">
                    <div style="flex: 1;">
                        <p style="margin: 5px 0;"><strong>Öğrenci:</strong> ${student.name}</p>
                        <p style="margin: 5px 0;"><strong>Numara:</strong> ${student.number}</p>
                        <p style="margin: 5px 0;"><strong>Sınıf:</strong> ${className}</p>
                        <p style="margin: 5px 0;"><strong>Tarih:</strong> ${today}</p>
                    </div>
                    <div style="flex: 1; border-left: 1px solid #eee; padding-left: 20px;">
                        <p style="margin: 5px 0;"><strong>Öğretmen:</strong> ${teacher.name}</p>
                        <p style="margin: 5px 0;"><strong>Branş:</strong> ${teacher.branch}</p>
                    </div>
                </div>

                <div style="margin-bottom: 25px;">
                    <h3 style="color: #4a90e2; border-bottom: 1px solid #eee; padding-bottom: 5px;">👨‍👩‍👦 Veli Bilgileri</h3>
                    <div style="display: flex; gap: 40px;">
                        <div>
                            <p style="margin: 5px 0;"><strong>Anne:</strong> ${student.parents?.mother?.name || '-'}</p>
                            <p style="margin: 5px 0;"><strong>Tel:</strong> ${student.parents?.mother?.tel || '-'}</p>
                        </div>
                        <div>
                            <p style="margin: 5px 0;"><strong>Baba:</strong> ${student.parents?.father?.name || '-'}</p>
                            <p style="margin: 5px 0;"><strong>Tel:</strong> ${student.parents?.father?.tel || '-'}</p>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 25px;">
                    <h3 style="color: #4a90e2; border-bottom: 1px solid #eee; padding-bottom: 5px;">📈 Sınav Notları</h3>
                    ${student.exams?.length ? `
                        <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                            <tr style="background: #f8f9fa;">
                                <th style="border: 1px solid #eee; padding: 8px; text-align: left;">Sınav Adı</th>
                                <th style="border: 1px solid #eee; padding: 8px; text-align: right;">Puan</th>
                            </tr>
                            ${student.exams.map(e => `
                                <tr>
                                    <td style="border: 1px solid #eee; padding: 8px;">${e.name}</td>
                                    <td style="border: 1px solid #eee; padding: 8px; text-align: right;">${e.score}</td>
                                </tr>
                            `).join('')}
                        </table>
                    ` : '<p style="color: #888; font-style: italic;">Kayıtlı sınav bulunmamaktadır.</p>'}
                </div>

                <div style="margin-bottom: 25px;">
                    <h3 style="color: #4a90e2; border-bottom: 1px solid #eee; padding-bottom: 5px;">📝 Öğretmen Notları</h3>
                    ${student.teacherNotes?.length ? student.teacherNotes.map(n => `
                        <div style="margin-bottom: 10px; padding: 8px; background: #fdfdfd; border-left: 3px solid #eee;">
                            <small style="color: #999;">${new Date(n.date).toLocaleDateString('tr-TR')}:</small>
                            <p style="margin: 4px 0;">${n.text}</p>
                        </div>
                    `).join('') : '<p style="color: #888; font-style: italic;">Kayıtlı not bulunmamaktadır.</p>'}
                </div>

                <div style="margin-top: 50px; padding-top: 10px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #888;">
                    <p>Bu evrak <strong>${teacher.name}</strong> tarafından paylaşılmıştır. Kişisel veri içermektedir.</p>
                    <p>(C) 2025 ${teacher.school || 'Nene Hatun MTAL'}</p>
                </div>
            </div>
        `;

        // 2. Generate PDF using our reusable renderer
        const pdfDataUri = await renderHtmlToPdf(pdfHtml);

        // 3. Share or Fallback
        const byteString = atob(pdfDataUri.split(',')[1]);
        const mimeString = pdfDataUri.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);

        const blob = new Blob([ab], { type: mimeString });
        const fileName = `${student.name.replace(/\s+/g, '_')}_Gelisim_Raporu.pdf`;
        const file = new File([blob], fileName, { type: mimeString });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: `${student.name} Gelişim Raporu`,
                text: `${student.name} isimli öğrencinin gelişim raporu ektedir.`
            });
        } else {
            // Fallback: Download for Desktop or systems without share
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = fileName;
            link.click();
            alert("Paylaşım özelliği bu cihazda desteklenmiyor. Dosya cihaza indirildi.");
        }

    } catch (error) {
        console.error("PDF Generate Error:", error);
        alert("PDF oluşturulurken bir hata oluştu: " + error.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// function renderPrintView(teacher, student, className) { // Deprecated by generatePDF with Share API
// }

// Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js?v=18');
}
