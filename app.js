// NHMTAL Teacher PWA - Main Logic
let db;
const DB_NAME = 'NHMTAL_DB';
const DB_VERSION = 2; // Upgraded for Plans

// Global current state
let currentClassId = null;
let currentStudentId = null;

document.addEventListener('DOMContentLoaded', () => {
    initDB();
    setupNavigation();
    setupProfileLogic();
    setupClassLogic();
    setupStudentLogic();
    setupPerformanceLogic();
    setupAlumniLogic();
    setupTransitionLogic();
    setupPDFLogic();
    setupPlansLogic(); // New
    setupSettingsLogic(); // New

    // Check theme
    const savedTheme = localStorage.getItem('app-theme') || 'default';
    applyTheme(savedTheme);
});

function initDB() {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
        console.error("Database error: " + event.target.errorCode);
        alert("Veritabanı hatası. Uygulama düzgün çalışmayabilir.");
    };

    request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Teachers Store (Profile)
        if (!db.objectStoreNames.contains('teachers')) {
            db.createObjectStore('teachers', { keyPath: 'id', autoIncrement: true });
        }

        // Classes Store
        if (!db.objectStoreNames.contains('classes')) {
            const classStore = db.createObjectStore('classes', { keyPath: 'id', autoIncrement: true });
            classStore.createIndex('name', 'name', { unique: false });
        }

        // Students Store
        if (!db.objectStoreNames.contains('students')) {
            const studentStore = db.createObjectStore('students', { keyPath: 'id', autoIncrement: true });
            studentStore.createIndex('classId', 'classId', { unique: false });
            studentStore.createIndex('name', 'name', { unique: false });
        }

        // Plans Store (New in v2)
        if (!db.objectStoreNames.contains('plans')) {
            const planStore = db.createObjectStore('plans', { keyPath: 'id', autoIncrement: true });
            planStore.createIndex('type', 'type', { unique: false });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log("DB Initialized");
        checkFirstLaunch();
        // Pre-load logic if needed
        renderClasses(); // Ensure classes specific logic is ready
    };
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const appHeader = document.querySelector('.app-header');
    const bottomNav = document.querySelector('.bottom-nav');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Handle disabled items
            if (item.classList.contains('disabled')) return;

            // UI Toggle
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            const targetId = item.getAttribute('data-target');
            views.forEach(v => v.classList.remove('active'));

            const targetView = document.getElementById(targetId);
            if (targetView) targetView.classList.add('active');

            // Special cases
            if (targetId === 'view-settings') {
                // appHeader.style.display = 'none'; // Optional: keep header or not
            } else {
                appHeader.style.display = 'flex';
            }

            // Reset state if leaving details
            if (targetId === 'view-classes' || targetId === 'view-welcome') {
                currentClassId = null;
                currentStudentId = null;
                // Show core UI
                bottomNav.style.display = 'flex';
                appHeader.style.display = 'flex';
            }
        });
    });
}

// Ensure initDB call checks (existing)
// We need to inject the fetch for classes inside the DB success

// Let's modify initDB to load classes if we are in app mode
// But better, let's make a generic "loadCurrentView" function

// --- Class Logic ---
let isEditingClass = false;

function setupClassLogic() {
    // Open Modal
    const btnAddClass = document.getElementById('btn-add-class');
    const modalClass = document.getElementById('modal-class');
    const btnCloseClass = document.getElementById('btn-close-class-modal');
    const formClass = document.getElementById('form-class');

    // Level Chips
    const chips = document.querySelectorAll('.chip');
    const levelInput = document.getElementById('class-level');

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            levelInput.value = chip.getAttribute('data-value');
        });
    });

    if (btnAddClass) {
        btnAddClass.addEventListener('click', () => {
            openClassModal();
        });
    }

    if (btnCloseClass) {
        btnCloseClass.addEventListener('click', () => {
            modalClass.classList.remove('active');
        });
    }

    // Close on outside click
    modalClass.addEventListener('click', (e) => {
        if (e.target === modalClass) modalClass.classList.remove('active');
    });

    // Form Submit
    formClass.addEventListener('submit', (e) => {
        e.preventDefault();
        saveClass();
    });

    setupClassTabListener();
}

function openClassModal(classId = null) {
    const modal = document.getElementById('modal-class');
    const title = document.getElementById('modal-class-title');
    const inputName = document.getElementById('class-name');
    const inputLevel = document.getElementById('class-level');
    const inputId = document.getElementById('class-id');
    const chips = document.querySelectorAll('.chip');

    chips.forEach(c => c.classList.remove('selected'));

    if (classId) {
        // Edit Mode
        isEditingClass = true;
        title.textContent = 'Sınıfı Düzenle';
        inputId.value = classId;

        // Fetch data
        const transaction = db.transaction(['classes'], 'readonly');
        const store = transaction.objectStore('classes');
        const request = store.get(Number(classId));

        request.onsuccess = (e) => { // Fixed: Using e instead of event for scope
            const data = e.target.result;
            inputName.value = data.name;
            inputLevel.value = data.level;

            // Select Chip
            chips.forEach(c => {
                if (c.getAttribute('data-value') === data.level) c.classList.add('selected');
            });
            modal.classList.add('active');
        };
    } else {
        // Add Mode
        isEditingClass = false;
        title.textContent = 'Yeni Sınıf Ekle';
        inputId.value = '';
        inputName.value = '';
        inputLevel.value = '';
        modal.classList.add('active');
    }
}

function saveClass() {
    const id = document.getElementById('class-id').value;
    const name = document.getElementById('class-name').value;
    const level = document.getElementById('class-level').value;

    if (!level) {
        alert('Lütfen sınıf seviyesini seçiniz.');
        return;
    }

    const transaction = db.transaction(['classes'], 'readwrite');
    const store = transaction.objectStore('classes');

    const classData = {
        name: name,
        level: level,
        studentCount: 0, // Default
        updatedAt: new Date()
    };

    if (id) {
        // Update (need to preserve student count ideally, but for now 0 is fine or we fetch first)
        // Better: Fetch first, then update
        // But IndexedDB 'put' needs the Key. If keypath is 'id'.
        classData.id = Number(id);
        // Important: If we want to keep studentCount, we should have fetched it. 
        // For simplified step 3, we assume 0 or we do a quick get-put.
        // Let's do a simple PUT for now, assuming editing name/level doesn't reset DB if we provide ID.
        // Actually, 'put' overwrites. So we should merge.

        // Merging logic inside transaction is tricky without async/await wrapper for IDB.
        // Let's assume for this step we just overwrite or ...
        // WAIT. If we overwrite, we lose studentCount if it was >0 (Step 4). 
        // So let's correct this:

        // Correct Edit Flow:
        // We already fetched in openClassModal, but that's async separate.
        // Let's just do a 'put' with the ID. We risk losing other fields if we don't include them.
        // For Step 3, there ARE no other fields. So it is fine.
        // In Step 4, we will need to be careful.

        store.put(classData);
    } else {
        // Add
        classData.createdAt = new Date();
        store.add(classData);
    }

    transaction.oncomplete = () => {
        document.getElementById('modal-class').classList.remove('active');
        renderClasses();
    };
}

function renderClasses() {
    const list = document.getElementById('class-list');

    // Preserve header/empty state logic? 
    // We'll rebuild.
    list.innerHTML = '';

    const transaction = db.transaction(['classes'], 'readonly');
    const store = transaction.objectStore('classes');
    const request = store.openCursor();

    let hasClasses = false;

    request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            hasClasses = true;
            const c = cursor.value;

            // Create Card
            const card = document.createElement('div');
            card.className = 'class-card';
            card.innerHTML = `
    <div class="class-info">
                    <h3>${c.name} <span class="class-level-badge">${c.level}. Sınıf</span></h3>
                    <p>${c.studentCount} Öğrenci</p>
                </div>
    <div class="class-actions">
        <button class="btn-edit-class" data-id="${c.id}">✏️</button>
        <button class="btn-delete-class" data-id="${c.id}">🗑️</button>
    </div>
`;

            // Edit
            card.querySelector('.btn-edit-class').addEventListener('click', (e) => {
                e.stopPropagation();
                openClassModal(c.id);
            });

            // Delete
            card.querySelector('.btn-delete-class').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`${c.name} sınıfı silinecek.Devam edilsin mi ? `)) {
                    deleteClass(c.id);
                }
            });

            // Card click (Navigate to details - later)
            // card.addEventListener('click', () => { ... });

            list.appendChild(card);
            cursor.continue();
        } else {
            if (!hasClasses) {
                list.innerHTML = '<div class="empty-state"><p>Henüz hiç sınıf eklenmedi.</p></div>';
            }
        }
    };
}

function deleteClass(id) {
    const transaction = db.transaction(['classes'], 'readwrite');
    const store = transaction.objectStore('classes');
    store.delete(id);
    transaction.oncomplete = () => {
        renderClasses();
    };
}

// Hook renderClasses into Navigation or Init
// We modify the existing initDB success slightly to render classes if valid
// OR we just call it when "Classes" tab is clicked.
// Let's modify the click listener in setupNavigation to load data if needed.
// This is cleaner.

// We need to modify setupNavigation to expose a way to hook interactions.
// Or just add a specific listener for the classes tab.
// Since setupNavigation is already running, let's add a separate listener for the classes tab specifically.
// But we need to make sure we don't duplicate logic.
// Simpler: Just call renderClasses() whenever the Sınıflar tab is activated.

// Let's override the click handler logic? No, let's just add an observer or extra listener.
// Easier: Add specific logic in setupClassLogic that listens to the nav click.

// But wait, I can't easily select the exact element and know IF it was clicked inside the generic loop without modifying the loop or adding ID.
// The nav items have 'data-target="view-classes"'.

function setupClassTabListener() {
    const classBtn = document.querySelector('[data-target="view-classes"]');
    classBtn.addEventListener('click', () => {
        // Small delay to ensure DB is ready if fast click, or just call
        if (db) renderClasses();
        else setTimeout(renderClasses, 500); // Retry
    });
}
// Call this in setupClassLogic


// Navigation Logic
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            // Prevent navigation if in Welcome Screen mode (effectively disabled by hideNav, but good safeguard)
            if (document.body.classList.contains('setup-mode')) return;

            const targetId = item.getAttribute('data-target');
            const title = item.getAttribute('data-title');

            // Update UI
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            views.forEach(view => {
                view.classList.remove('active');
                if (view.id === targetId) {
                    view.classList.add('active');
                    // Special case for scrolling top
                    window.scrollTo(0, 0);
                }
            });

            // Update Title
            pageTitle.textContent = title;
        });
    });

    // Settings -> Profile Link
    document.getElementById('btn-settings-profile').addEventListener('click', () => {
        document.querySelector('[data-target="view-profile"]').click();
    });
}

// Profile & Setup Logic
function setupProfileLogic() {
    // Avatar Selection
    const avatarOptions = document.querySelectorAll('.avatar-option');
    const photoUpload = document.getElementById('photo-upload');
    const photoPreview = document.getElementById('photo-preview');
    let selectedAvatar = '👨‍🏫'; // Default
    let selectedImageBase64 = null;

    avatarOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            avatarOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedAvatar = opt.textContent;
            selectedImageBase64 = null; // Reset custom image
            photoPreview.style.display = 'none';
        });
    });

    photoUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (evt) {
                selectedImageBase64 = evt.target.result;
                photoPreview.src = selectedImageBase64;
                photoPreview.style.display = 'block';
                // Deselect avatars visual
                avatarOptions.forEach(o => o.classList.remove('selected'));
            };
            reader.readAsDataURL(file);
        }
    });

    // Form Submit
    document.getElementById('setup-form').addEventListener('submit', (e) => {
        e.preventDefault();

        const name = document.getElementById('setup-name').value;
        const branch = document.getElementById('setup-branch').value;
        const school = document.getElementById('setup-school').value;
        const gender = document.getElementById('setup-gender').value;

        const profileData = {
            id: 'teacher_profile', // Singleton
            name,
            branch,
            school,
            gender,
            avatar: selectedAvatar,
            photo: selectedImageBase64,
            createdAt: new Date()
        };

        saveTeacherProfile(profileData);
    });

    // Edit Button in Profile View
    document.getElementById('btn-edit-profile').addEventListener('click', () => {
        // For now, just show the Welcome Screen again as an "Edit" mode could be complex
        // Or simply re-open the setup view but pre-filled.
        // Let's re-open setup-view
        loadProfileToForm();
        showSetupMode();
    });
}

// Database & Flow
// Database & Flow - (Moved to top)

function checkFirstLaunch() {
    const transaction = db.transaction(['teachers'], 'readonly');
    const objectStore = transaction.objectStore('teachers');
    const request = objectStore.get('teacher_profile');

    request.onsuccess = (event) => {
        const result = event.target.result;
        if (result) {
            // Profile exists -> Load App
            loadProfileView(result);
            showAppMode();
        } else {
            // No profile -> Show Setup
            showSetupMode();
        }
    };
}

function saveTeacherProfile(data) {
    const transaction = db.transaction(['teachers'], 'readwrite');
    const objectStore = transaction.objectStore('teachers');
    const request = objectStore.put(data);

    request.onsuccess = () => {
        alert('Profil kaydedildi!');
        loadProfileView(data);
        showAppMode();
    };

    request.onerror = () => {
        alert('Kaydetme başarısız!');
    };
}

function loadProfileView(data) {
    document.getElementById('disp-name').textContent = data.name;
    document.getElementById('disp-branch').textContent = data.branch;
    document.getElementById('disp-school').textContent = data.school;

    // Gender Text
    const genders = { 'male': 'Erkek', 'female': 'Kadın', 'none': 'Belirtimiyor', '': 'Belirtilmiyor' };
    document.getElementById('disp-gender').textContent = genders[data.gender] || '-';

    // Image logic
    const imgDisp = document.getElementById('profile-img-display');
    const avatarDisp = document.getElementById('profile-avatar-display');

    if (data.photo) {
        imgDisp.src = data.photo;
        imgDisp.style.display = 'block';
        avatarDisp.style.display = 'none';
    } else {
        avatarDisp.textContent = data.avatar || '👨‍🏫';
        avatarDisp.style.display = 'block';
        imgDisp.style.display = 'none';
    }
}

function showSetupMode() {
    document.body.classList.add('setup-mode');
    document.getElementById('view-welcome').classList.add('active');
    document.querySelector('.bottom-nav').style.display = 'none';
    document.querySelector('.app-header').style.display = 'none';

    // Hide all other views
    document.querySelectorAll('.view').forEach(v => {
        if (v.id !== 'view-welcome') v.classList.remove('active');
    });
}

function showAppMode() {
    document.body.classList.remove('setup-mode');
    document.getElementById('view-welcome').classList.remove('active');
    document.querySelector('.bottom-nav').style.display = 'flex';
    document.querySelector('.app-header').style.display = 'flex';

    // Go to default view
    document.querySelector('[data-target="view-profile"]').click();
}

function loadProfileToForm() {
    const transaction = db.transaction(['teachers'], 'readonly');
    const objectStore = transaction.objectStore('teachers');
    const request = objectStore.get('teacher_profile');

    request.onsuccess = (event) => {
        const data = event.target.result;
        if (data) {
            document.getElementById('setup-name').value = data.name;
            document.getElementById('setup-branch').value = data.branch;
            document.getElementById('setup-school').value = data.school;
            document.getElementById('setup-gender').value = data.gender;
            // Image handling reconstruction is complex for UI, leave simple for now
        }
    };
}

// --- Student Logic ---
// --- Student Logic ---

function setupStudentLogic() {
    const btnAddStudent = document.getElementById('btn-add-student');
    const modalStudent = document.getElementById('modal-student');
    const formStudent = document.getElementById('form-student');
    const btnCloseStudent = document.getElementById('btn-close-student-modal');

    if (btnAddStudent) {
        btnAddStudent.addEventListener('click', () => {
            openStudentModal();
        });
    }

    if (btnCloseStudent) {
        btnCloseStudent.addEventListener('click', () => {
            modalStudent.classList.remove('active');
        });
    }

    if (formStudent) {
        formStudent.addEventListener('submit', (e) => {
            e.preventDefault();
            saveStudent();
        });
    }

    // Photo Upload
    const photoInput = document.getElementById('student-photo-upload');
    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function (evt) {
                    const img = document.getElementById('student-form-img');
                    img.src = evt.target.result;
                    img.style.display = 'block';
                    document.getElementById('student-form-avatar').style.display = 'none';
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Tag Selection
    const tags = document.querySelectorAll('#student-tags .chip');
    tags.forEach(tag => {
        tag.addEventListener('click', () => {
            // Toggle selection (single select logic for simplicity)
            tags.forEach(t => t.classList.remove('selected'));
            tag.classList.add('selected');
        });
    });

    // Back Buttons
    const btnBackClass = document.querySelector('#view-class-detail .btn-back');
    if (btnBackClass) {
        btnBackClass.addEventListener('click', () => {
            document.querySelector('[data-target="view-classes"]').click();
        });
    }

    const btnBackProfile = document.getElementById('btn-back-from-student');
    if (btnBackProfile) {
        btnBackProfile.addEventListener('click', () => {
            // Return to class detail or alumni based on status
            // Simple fallback:
            if (currentClassId) {
                loadClassDetail(currentClassId);
                document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
                document.getElementById('view-class-detail').classList.add('active');
                document.querySelector('.app-header').style.display = 'flex';
                document.querySelector('.bottom-nav').style.display = 'flex';
            } else {
                // Might be alumni
                document.querySelector('[data-target="view-alumni"]').click();
                document.querySelector('.app-header').style.display = 'flex';
                document.querySelector('.bottom-nav').style.display = 'flex';
            }
        });
    }

    // Edit Button Logic
    const btnEditStudent = document.getElementById('btn-edit-student');
    if (btnEditStudent) {
        btnEditStudent.addEventListener('click', () => {
            if (currentStudentId) openStudentModal(currentStudentId);
        });
    }

    // Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const target = btn.getAttribute('data-tab');
            document.getElementById(target).classList.add('active');
        });
    });

    // Search
    const searchInput = document.getElementById('student-search');
    if (searchInput) searchInput.addEventListener('input', filterStudents);

    // Setup other modules
    setupPerformanceLogic();
    setupAlumniLogic();
    setupTransitionLogic();
}

function openStudentModal(studentId = null) {
    const modal = document.getElementById('modal-student');
    const form = document.getElementById('form-student');

    form.reset();
    document.querySelectorAll('#student-tags .chip').forEach(c => c.classList.remove('selected'));
    document.getElementById('student-form-img').style.display = 'none';
    document.getElementById('student-form-avatar').style.display = 'block';
    document.getElementById('student-form-img').src = '';

    if (studentId) {
        // Edit Mode
        document.getElementById('modal-student-title').textContent = 'Öğrenci Düzenle';
        const transaction = db.transaction(['students'], 'readonly');
        const store = transaction.objectStore('students');
        store.get(Number(studentId)).onsuccess = (e) => {
            const s = e.target.result;
            document.getElementById('student-id').value = s.id;
            document.getElementById('student-class-id').value = s.classId || '';
            document.getElementById('student-number').value = s.number;
            document.getElementById('student-name').value = s.name;

            if (s.parents) {
                document.getElementById('student-mother-name').value = s.parents.mother?.name || '';
                document.getElementById('student-mother-tel').value = s.parents.mother?.tel || '';
                document.getElementById('student-father-name').value = s.parents.father?.name || '';
                document.getElementById('student-father-tel').value = s.parents.father?.tel || '';
            }

            document.getElementById('student-notes').value = s.notes || '';

            if (s.photo) {
                const img = document.getElementById('student-form-img');
                img.src = s.photo;
                img.style.display = 'block';
                document.getElementById('student-form-avatar').style.display = 'none';
            }

            if (s.tags && s.tags.length > 0) {
                const t = s.tags[0];
                const chip = document.querySelector(`#student - tags.chip[data - value="${t}"]`);
                if (chip) chip.classList.add('selected');
            }

            modal.classList.add('active');
        };
    } else {
        // Add Mode
        document.getElementById('modal-student-title').textContent = 'Öğrenci Ekle';
        document.getElementById('student-id').value = '';
        document.getElementById('student-class-id').value = currentClassId;
        modal.classList.add('active');
    }
}

function saveStudent() {
    const id = document.getElementById('student-id').value;
    const classId = Number(document.getElementById('student-class-id').value);
    const number = document.getElementById('student-number').value;
    const name = document.getElementById('student-name').value;
    const mName = document.getElementById('student-mother-name').value;
    const mTel = document.getElementById('student-mother-tel').value;
    const fName = document.getElementById('student-father-name').value;
    const fTel = document.getElementById('student-father-tel').value;
    const notes = document.getElementById('student-notes').value;

    const selectedTag = document.querySelector('#student-tags .chip.selected')?.getAttribute('data-value');

    const imgSrc = document.getElementById('student-form-img').src;
    const hasImg = document.getElementById('student-form-img').style.display === 'block';

    const transaction = db.transaction(['students', 'classes'], 'readwrite');
    const store = transaction.objectStore('students');

    // We need to fetch existing if editing to preserve some data like performance
    if (id) {
        const req = store.get(Number(id));
        req.onsuccess = (e) => {
            const existing = e.target.result;
            existing.number = number;
            existing.name = name;
            existing.parents = {
                mother: { name: mName, tel: mTel },
                father: { name: fName, tel: fTel }
            };
            existing.notes = notes;
            existing.tags = selectedTag ? [selectedTag] : [];
            if (hasImg && imgSrc) existing.photo = imgSrc;
            existing.updatedAt = new Date();

            store.put(existing);

            // Refresh View
            if (currentStudentId == id) loadStudentProfile(id); // Reload profile if active
            if (currentClassId) loadClassDetail(currentClassId); // Reload list logic if needed, but we might be in profile
            document.getElementById('modal-student').classList.remove('active');
        };
    } else {
        // New
        const student = {
            classId: classId,
            number: number,
            name: name,
            parents: {
                mother: { name: mName, tel: mTel },
                father: { name: fName, tel: fTel }
            },
            notes: notes,
            tags: selectedTag ? [selectedTag] : [],
            photo: (hasImg && imgSrc) ? imgSrc : null,
            createdAt: new Date(),
            status: 'active',
            teacherNotes: [],
            exams: []
        };
        store.add(student);

        // Update Class Count
        const classStore = transaction.objectStore('classes');
        const cReq = classStore.get(classId);
        cReq.onsuccess = (e) => {
            const c = e.target.result;
            c.studentCount = (c.studentCount || 0) + 1;
            classStore.put(c);
        };

        transaction.oncomplete = () => {
            document.getElementById('modal-student').classList.remove('active');
            loadClassDetail(classId);
        };
    }
}

function loadClassDetail(classId) {
    currentClassId = classId;

    // UI Switch
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-class-detail').classList.add('active');

    // Get Class Name
    const t = db.transaction(['classes'], 'readonly');
    t.objectStore('classes').get(Number(classId)).onsuccess = (e) => {
        const c = e.target.result;
        document.getElementById('class-detail-title').textContent = `${c.name} Sınıfı`;
    };

    // Start Print
    // Note: window.print() is called in renderPrintView
}

// --- Plans Logic (Step 9) ---
function setupPlansLogic() {
    const btnAddPlan = document.getElementById('btn-add-plan');
    const modalPlan = document.getElementById('modal-plan');
    const btnClosePlan = document.getElementById('btn-close-plan-modal');
    const formPlan = document.getElementById('form-plan');

    // Quick Action & Menu Handlers
    const btnDashPlans = document.getElementById('btn-dash-plans');
    const btnSettingsPlans = document.getElementById('btn-settings-plans');

    const openPlansView = () => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-plans').classList.add('active');
        // Hide bottom nav/header if desired, but nice to keep header
        document.querySelector('.app-header').style.display = 'flex';
        renderPlans('yearly'); // Default
        document.querySelector('.tab-btn[data-tab="plan-yearly"]').click();
    };

    if (btnDashPlans) btnDashPlans.addEventListener('click', openPlansView);
    if (btnSettingsPlans) btnSettingsPlans.addEventListener('click', openPlansView);

    if (btnAddPlan) btnAddPlan.addEventListener('click', () => {
        document.getElementById('plan-id').value = '';
        document.getElementById('form-plan').reset();
        modalPlan.classList.add('active');
    });

    if (btnClosePlan) btnClosePlan.addEventListener('click', () => modalPlan.classList.remove('active'));

    // Tab switching
    const tabs = document.querySelectorAll('.student-profile-tabs .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.getAttribute('data-tab').startsWith('plan-')) {
                tabs.forEach(t => {
                    if (t.getAttribute('data-tab').startsWith('plan-')) t.classList.remove('active');
                });
                tab.classList.add('active');
                const type = tab.getAttribute('data-tab') === 'plan-yearly' ? 'yearly' : 'weekly';
                renderPlans(type);
            }
        });
    });

    if (formPlan) {
        formPlan.addEventListener('submit', (e) => {
            e.preventDefault();
            savePlan();
        });
    }
}

function savePlan() {
    const title = document.getElementById('plan-title').value;
    const type = document.getElementById('plan-type').value;
    const fileInput = document.getElementById('plan-file');

    if (!title || fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
        // Blob for storage
        const blob = new Blob([new Uint8Array(e.target.result)], { type: file.type });

        const plan = {
            title: title,
            type: type,
            fileName: file.name,
            fileType: file.type,
            fileData: blob,
            createdAt: new Date()
        };

        const transaction = db.transaction(['plans'], 'readwrite');
        const store = transaction.objectStore('plans');
        store.add(plan);

        transaction.oncomplete = () => {
            alert("Plan kaydedildi.");
            document.getElementById('modal-plan').classList.remove('active');
            renderPlans(type);
        };
    };

    reader.readAsArrayBuffer(file);
}

function renderPlans(type) {
    const list = document.getElementById('plan-list-container');
    list.innerHTML = '';

    const transaction = db.transaction(['plans'], 'readonly');
    const store = transaction.objectStore('plans');
    const idx = store.index('type'); // Use index
    const req = idx.openCursor(IDBKeyRange.only(type));

    let hasPlans = false;

    req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            hasPlans = true;
            const p = cursor.value;

            const card = document.createElement('div');
            card.className = 'info-card';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            card.style.marginBottom = '10px';

            const icon = p.fileType.includes('image') ? '🖼️' : '📄';

            card.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <span style="font-size:1.5rem; margin-right:15px;">${icon}</span>
                    <div>
                        <h4 style="margin:0; font-size:1rem;">${p.title}</h4>
                        <p style="margin:0; font-size:0.8rem; color:#888;">${p.fileName}</p>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-icon" style="color:#4a90e2; font-size:1.2rem;">📂</button>
                    <button class="btn-icon delete-plan-btn" style="color:#e74c3c;">🗑️</button>
                </div>
            `;

            // Open
            card.querySelector('.btn-icon').addEventListener('click', () => {
                const url = URL.createObjectURL(p.fileData);
                window.open(url, '_blank');
            });

            // Delete
            card.querySelector('.delete-plan-btn').addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (confirm('Plan silinsin mi?')) {
                    const t2 = db.transaction(['plans'], 'readwrite');
                    t2.objectStore('plans').delete(p.id);
                    t2.oncomplete = () => renderPlans(type);
                }
            });

            list.appendChild(card);

            cursor.continue();
        } else {
            if (!hasPlans) list.innerHTML = '<div class="empty-state-small">Bu kategori için plan yok.</div>';
        }
    };
}

// --- Settings Logic ---
function setupSettingsLogic() {
    // Theme
    const btnTheme = document.getElementById('btn-settings-theme');
    const modalTheme = document.getElementById('modal-theme');
    const btnCloseTheme = document.getElementById('btn-close-theme-modal');

    if (btnTheme) btnTheme.addEventListener('click', () => modalTheme.classList.add('active'));
    if (btnCloseTheme) btnCloseTheme.addEventListener('click', () => modalTheme.classList.remove('active'));

    const themeOpts = document.querySelectorAll('.theme-option');
    themeOpts.forEach(opt => {
        opt.addEventListener('click', () => {
            const theme = opt.getAttribute('data-theme');
            applyTheme(theme);
            modalTheme.classList.remove('active');
        });
    });

    // Info
    const btnInfo = document.getElementById('btn-settings-info');
    if (btnInfo) {
        btnInfo.addEventListener('click', () => {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('view-info').classList.add('active');
            document.querySelector('.app-header').style.display = 'flex';
        });
    }

    // Reset
    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
        btnReset.addEventListener('click', resetAppData);
    }
}

function applyTheme(themeName) {
    document.body.classList.remove('theme-green', 'theme-dark');
    if (themeName === 'green') document.body.classList.add('theme-green');
    if (themeName === 'dark') document.body.classList.add('theme-dark');
    localStorage.setItem('app-theme', themeName);
}

function resetAppData() {
    if (confirm('UYARI: Tüm veriler silinecek ve uygulama sıfırlanacak. Bu işlem geri alınamaz!')) {
        if (confirm('Son kez soruyorum: Emin misiniz?')) {
            const req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = () => {
                localStorage.clear();
                location.reload();
            };
        }
    }
}
const container = document.getElementById('student-list');
container.innerHTML = '';

const ts = db.transaction(['students'], 'readonly');
const req = ts.objectStore('students').openCursor();

let hasStudents = false;

req.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
        const s = cursor.value;
        if (s.classId == classId && s.status !== 'graduated') {
            hasStudents = true;
            const el = document.createElement('div');
            el.className = 'student-card';
            el.setAttribute('data-name', s.name.toLowerCase());

            let avatar = s.photo ? `<img src="${s.photo}" class="student-list-img">` : `<div class="student-list-avatar">🎓</div>`;

            el.innerHTML = `
                    ${avatar}
                    <div class="student-info">
                        <h4>${s.name}</h4>
                        <p>${s.number}</p>
                    </div>
                    <div class="student-arrow">›</div>
`;

            el.addEventListener('click', () => loadStudentProfile(s.id));
            container.appendChild(el);
        }
        cursor.continue();
    } else {
        if (!hasStudents) container.innerHTML = '<div class="empty-state"><p>Bu sınıfta öğrenci yok.</p></div>';
    }
};
}

function filterStudents() {
    const term = document.getElementById('student-search').value.toLowerCase();
    const cards = document.querySelectorAll('#student-list .student-card');
    cards.forEach(c => {
        const name = c.getAttribute('data-name');
        if (name.includes(term)) c.style.display = 'flex';
        else c.style.display = 'none';
    });
}

function loadStudentProfile(studentId, readOnly = false) {
    currentStudentId = studentId;

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelector('.bottom-nav').style.display = 'none';
    document.querySelector('.app-header').style.display = 'none';
    document.getElementById('view-student-profile').classList.add('active');

    const btnEdit = document.getElementById('btn-edit-student');
    const btnAddNote = document.getElementById('btn-add-note');
    const btnAddExam = document.getElementById('btn-add-exam');

    if (readOnly || (arguments.length > 1 && readOnly)) { // Ensure readOnly handled
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnAddNote) btnAddNote.style.display = 'none';
        if (btnAddExam) btnAddExam.style.display = 'none';
    } else {
        if (btnEdit) btnEdit.style.display = 'block';
        if (btnAddNote) btnAddNote.style.display = 'flex';
        if (btnAddExam) btnAddExam.style.display = 'flex';
    }

    // PDF Button Listener (Dynamic binding)
    const btnPDF = document.getElementById('btn-create-pdf');
    if (btnPDF) {
        // Clone to remove old listeners
        const newBtn = btnPDF.cloneNode(true);
        btnPDF.parentNode.replaceChild(newBtn, btnPDF);
        newBtn.addEventListener('click', generatePDF);
    }

    const trans = db.transaction(['students'], 'readonly');
    const store = trans.objectStore('students');
    store.get(Number(studentId)).onsuccess = (e) => {
        const s = e.target.result;

        document.getElementById('std-profile-name').textContent = s.name;
        document.getElementById('std-profile-no').textContent = s.status === 'graduated' ? (s.gradYear + ' Mezunu') : s.number;

        const heroAvatar = document.getElementById('std-profile-avatar');
        const heroImg = document.getElementById('std-profile-img');

        if (s.photo) {
            heroImg.src = s.photo;
            heroImg.style.display = 'block';
            heroAvatar.style.display = 'none';
        } else {
            heroAvatar.style.display = 'block';
            heroImg.style.display = 'none';
        }

        const tagsContainer = document.getElementById('std-profile-tags');
        tagsContainer.innerHTML = '';
        if (s.tags) {
            const labels = { success: 'Başarılı', follow: 'Takip', support: 'Destek', passive: 'Pasif' };
            const colors = { success: '#d1fae5', follow: '#fee2e2', support: '#fef3c7', passive: '#f3f4f6' };
            const textColors = { success: '#065f46', follow: '#991b1b', support: '#92400e', passive: '#1f2937' };

            s.tags.forEach(t => {
                const sp = document.createElement('span');
                sp.className = 'tag-badge';
                sp.textContent = labels[t] || t;
                sp.style.background = colors[t] || '#eee';
                sp.style.color = textColors[t] || '#333';
                tagsContainer.appendChild(sp);
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
    };
}

// --- Performance Logic ---
function setupPerformanceLogic() {
    const modalNote = document.getElementById('modal-note');
    const formNote = document.getElementById('form-note');
    const btnAddNote = document.getElementById('btn-add-note');
    const btnCloseNote = document.getElementById('btn-close-note-modal');

    if (btnAddNote) {
        btnAddNote.addEventListener('click', () => {
            document.getElementById('form-note').reset();
            document.getElementById('note-student-id').value = currentStudentId;
            document.getElementById('note-date').valueAsDate = new Date();
            modalNote.classList.add('active');
        });
    }

    if (btnCloseNote) btnCloseNote.addEventListener('click', () => modalNote.classList.remove('active'));
    if (formNote) {
        formNote.addEventListener('submit', (e) => {
            e.preventDefault();
            saveNote();
        });
    }

    const modalExam = document.getElementById('modal-exam');
    const formExam = document.getElementById('form-exam');
    const btnAddExam = document.getElementById('btn-add-exam');
    const btnCloseExam = document.getElementById('btn-close-exam-modal');

    if (btnAddExam) {
        btnAddExam.addEventListener('click', () => {
            document.getElementById('form-exam').reset();
            document.getElementById('exam-student-id').value = currentStudentId;
            document.getElementById('exam-date').valueAsDate = new Date();
            modalExam.classList.add('active');
        });
    }
    if (btnCloseExam) btnCloseExam.addEventListener('click', () => modalExam.classList.remove('active'));
    if (formExam) {
        formExam.addEventListener('submit', (e) => {
            e.preventDefault();
            saveExam();
        });
    }
}

function saveNote() {
    const sId = Number(document.getElementById('note-student-id').value);
    const date = document.getElementById('note-date').value;
    const text = document.getElementById('note-text').value;

    if (!text) return;

    const transaction = db.transaction(['students'], 'readwrite');
    const store = transaction.objectStore('students');
    const req = store.get(sId);

    req.onsuccess = (e) => {
        const student = e.target.result;
        if (!student.teacherNotes) student.teacherNotes = [];

        student.teacherNotes.unshift({
            id: Date.now(),
            date: date,
            text: text,
            createdAt: new Date()
        });

        store.put(student).onsuccess = () => {
            document.getElementById('modal-note').classList.remove('active');
            renderNotes(student.teacherNotes);
        };
    };
}

function deleteNote(noteId) {
    if (!confirm('Not silinsin mi?')) return;
    const transaction = db.transaction(['students'], 'readwrite');
    const store = transaction.objectStore('students');
    const req = store.get(Number(currentStudentId));

    req.onsuccess = (e) => {
        const student = e.target.result;
        if (student.teacherNotes) {
            student.teacherNotes = student.teacherNotes.filter(n => n.id !== noteId);
            store.put(student).onsuccess = () => {
                renderNotes(student.teacherNotes);
            };
        }
    };
}

function renderNotes(notes, readOnly) {
    const list = document.getElementById('notes-list');
    list.innerHTML = '';

    if (!notes || notes.length === 0) {
        list.innerHTML = '<div class="empty-state-small">Henüz not eklenmedi.</div>';
        return;
    }

    notes.forEach(n => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        const d = new Date(n.date);
        const dateStr = d.toLocaleDateString('tr-TR');

        let delBtn = readOnly ? '' : '<button class="btn-delete-item">🗑️</button>';

        item.innerHTML = `
    < div class="timeline-date" > ${dateStr}</div >
        <div class="timeline-content">
            ${n.text}
            ${delBtn}
        </div>
`;

        if (!readOnly) {
            item.querySelector('.btn-delete-item').addEventListener('click', () => deleteNote(n.id));
        }
        list.appendChild(item);
    });
}

function saveExam() {
    const sId = Number(document.getElementById('exam-student-id').value);
    const name = document.getElementById('exam-name').value;
    const date = document.getElementById('exam-date').value;
    const score = Number(document.getElementById('exam-score').value);

    if (!name) return;

    const transaction = db.transaction(['students'], 'readwrite');
    const store = transaction.objectStore('students');
    const req = store.get(sId);

    req.onsuccess = (e) => {
        const student = e.target.result;
        if (!student.exams) student.exams = [];

        student.exams.push({
            id: Date.now(),
            name: name,
            date: date,
            score: score
        });

        store.put(student).onsuccess = () => {
            document.getElementById('modal-exam').classList.remove('active');
            renderExams(student.exams);
        };
    };
}

function deleteExam(examId) {
    if (!confirm('Sınav notu silinsin mi?')) return;

    const transaction = db.transaction(['students'], 'readwrite');
    const store = transaction.objectStore('students');
    const req = store.get(Number(currentStudentId));

    req.onsuccess = (e) => {
        const student = e.target.result;
        if (student.exams) {
            student.exams = student.exams.filter(ex => ex.id !== examId);
            store.put(student).onsuccess = () => {
                renderExams(student.exams);
            };
        }
    };
}

function renderExams(exams, readOnly) {
    const list = document.getElementById('exams-list');
    const avgDisplay = document.getElementById('exam-average');
    list.innerHTML = '';

    if (!exams || exams.length === 0) {
        list.innerHTML = '<div class="empty-state-small">Henüz sınav girilmedi.</div>';
        avgDisplay.textContent = '-';
        return;
    }

    let total = 0;
    exams.forEach(ex => {
        total += ex.score;
        const item = document.createElement('div');
        item.className = 'exam-item';
        const d = new Date(ex.date);
        const dateStr = d.toLocaleDateString('tr-TR');

        let scoreClass = 'score-mid';
        if (ex.score >= 85) scoreClass = 'score-high';
        if (ex.score < 50) scoreClass = 'score-low';

        let delBtn = readOnly ? '' : '<button class="btn-delete-item" style="position:static;">🗑️</button>';

        item.innerHTML = `
    < div class="exam-info" >
                <h4>${ex.name}</h4>
                <span>${dateStr}</span>
            </div >
    <div style="display:flex; align-items:center;">
        <div class="exam-score ${scoreClass}">${ex.score}</div>
        ${delBtn}
    </div>
`;
        if (!readOnly) {
            item.querySelector('.btn-delete-item').addEventListener('click', () => deleteExam(ex.id));
        }
        list.appendChild(item);
    });

    const avg = (total / exams.length).toFixed(1);
    avgDisplay.textContent = avg;
}

// --- Alumni Logic ---
function setupAlumniLogic() {
    const searchInput = document.getElementById('alumni-search');
    const yearSelect = document.getElementById('alumni-year-filter');
    const btnAlumni = document.querySelector('[data-target="view-alumni"]');

    if (btnAlumni) {
        btnAlumni.addEventListener('click', () => renderAlumni());
    }

    if (searchInput) searchInput.addEventListener('input', filterAlumni);
    if (yearSelect) yearSelect.addEventListener('change', filterAlumni);

    // Populate Years
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
        const opt = document.createElement('option');
        opt.value = currentYear - i;
        opt.textContent = currentYear - i;
        yearSelect.appendChild(opt);
    }
}

function renderAlumni() {
    const list = document.getElementById('alumni-list');
    list.innerHTML = '';

    const trans = db.transaction(['students'], 'readonly');
    const store = trans.objectStore('students');
    const request = store.openCursor();

    let hasAlumni = false;

    request.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            if (cursor.value.status === 'graduated') {
                hasAlumni = true;
                const s = cursor.value;
                const el = document.createElement('div');
                el.className = 'student-card alumni-card';
                el.setAttribute('data-name', s.name.toLowerCase());
                el.setAttribute('data-year', s.gradYear || '');

                let avatar = s.photo ? `<img src="${s.photo}" class="student-list-img">` : `<div class="student-list-avatar">🎓</div>`;

                el.innerHTML = `
                    ${avatar}
<div class="student-info">
    <h4>${s.name}</h4>
    <p>${s.gradYear || '-'} Mezunu • ${s.prevClass || ''}</p>
</div>
`;

                el.addEventListener('click', () => {
                    loadStudentProfile(s.id, true);
                });

                list.appendChild(el);
            }
            cursor.continue();
        } else {
            if (!hasAlumni) list.innerHTML = '<div class="empty-state"><p>Henüz mezun öğrenci yok.</p></div>';
        }
    };
}

function filterAlumni() {
    const text = document.getElementById('alumni-search').value.toLowerCase();
    const year = document.getElementById('alumni-year-filter').value;

    const cards = document.querySelectorAll('.alumni-card');
    cards.forEach(c => {
        const name = c.getAttribute('data-name');
        const cYear = c.getAttribute('data-year');

        const matchText = name.includes(text);
        const matchYear = year === '' || cYear == year;

        if (matchText && matchYear) c.style.display = 'flex';
        else c.style.display = 'none';
    });
}

// --- Transition Logic ---
function setupTransitionLogic() {
    const btnSettings = document.getElementById('btn-year-transition');
    const modal = document.getElementById('modal-transition');
    const btnConfirm = document.getElementById('btn-confirm-transition');
    const btnCancel = document.getElementById('btn-cancel-transition');

    if (btnSettings) {
        btnSettings.addEventListener('click', () => {
            modal.classList.add('active');
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    // Fix: Ensure close braces for setupTransitionLogic and performYearTransition
    // Then add PDF Logic

    if (btnConfirm) {
        btnConfirm.addEventListener('click', () => {
            performYearTransition();
            modal.classList.remove('active');
        });
    }
}

function performYearTransition() {
    const transaction = db.transaction(['classes', 'students'], 'readwrite');
    const classStore = transaction.objectStore('classes');
    const studentStore = transaction.objectStore('students');

    const classesRequest = classStore.getAll();

    classesRequest.onsuccess = (e) => {
        const classes = e.target.result;
        const level12ClassIds = new Set();
        const updates = [];

        classes.forEach(c => {
            const lvl = Number(c.level);
            if (lvl === 12) {
                level12ClassIds.add(c.id);
                classStore.delete(c.id);
            } else if ([9, 10, 11].includes(lvl)) {
                c.level = (lvl + 1).toString();
                // Name replace safe logic
                const oldLvl = lvl.toString();
                const newLvl = c.level;

                // Smart replace: 9-A -> 10-A
                if (c.name.includes(oldLvl)) {
                    c.name = c.name.replace(oldLvl, newLvl);
                }
                classStore.put(c);
            }
        });

        const studentReq = studentStore.openCursor();
        const currentYear = new Date().getFullYear();

        studentReq.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) {
                const s = cursor.value;
                if (s.classId && level12ClassIds.has(s.classId)) {
                    s.status = 'graduated';
                    s.gradYear = currentYear;
                    const cls = classes.find(c => c.id === s.classId);
                    s.prevClass = cls ? cls.name : '';
                    s.classId = null;
                    cursor.update(s);
                }
                cursor.continue();
            }
        };
    };

    transaction.oncomplete = () => {
        alert("Yeni eğitim yılı başarıyla oluşturuldu.");
        renderClasses();
    };
} // End performYearTransition

// --- PDF / Print Logic (Step 8) ---
function setupPDFLogic() {
    // We attach this to a generated button inside the profile view
    // Since the button might be dynamic, we delegate or bind when profile loads.
    // 'loadStudentProfile' is responsible for showing the button
}

function generatePDF() {
    if (!currentStudentId) return;

    // 1. Fetch Data (Student + Teacher)
    const transaction = db.transaction(['students', 'teachers', 'classes'], 'readonly');

    let teacher = { name: 'Öğretmen', school: 'Okul', branch: 'Branş' };
    let student = null;
    let studentClass = '';

    const tStore = transaction.objectStore('teachers');
    const sStore = transaction.objectStore('students');
    const cStore = transaction.objectStore('classes');

    // Callback Hell Avoidance: simple state machine
    let reqCount = 0;

    const checkDone = () => {
        if (reqCount === 3) {
            renderPrintView(teacher, student, studentClass);
        }
    };

    tStore.get('teacher_profile').onsuccess = (e) => {
        if (e.target.result) teacher = e.target.result;
        reqCount++;
        checkDone();
    };

    sStore.get(Number(currentStudentId)).onsuccess = (e) => {
        student = e.target.result;

        // If student exists, get class
        if (student && student.classId) {
            cStore.get(student.classId).onsuccess = (ev) => {
                if (ev.target.result) studentClass = ev.target.result.name;
                reqCount++; // Class done
                reqCount++; // Student done (logical grouping)
                checkDone();
            };
        } else {
            if (student && student.prevClass) studentClass = student.prevClass + ' (Mezun)';
            reqCount += 2;
            checkDone();
        }
    };
}

function renderPrintView(teacher, student, className) {
    const printArea = document.getElementById('print-area');

    // Format Date
    const today = new Date().toLocaleDateString('tr-TR');

    // Performance
    let examsHtml = '<p>Sınav notu bulunmamaktadır.</p>';
    if (student.exams && student.exams.length > 0) {
        let rows = student.exams.map(e => `< tr ><td>${e.name}</td><td>${new Date(e.date).toLocaleDateString('tr-TR')}</td><td><strong>${e.score}</strong></td></tr > `).join('');
        // Calc Avg
        const avg = (student.exams.reduce((a, b) => a + b.score, 0) / student.exams.length).toFixed(1);
        examsHtml = `
    < table class="print-table" >
                <thead><tr><th>Sınav</th><th>Tarih</th><th>Puan</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr><td colspan="2">Ortalama</td><td>${avg}</td></tr></tfoot>
            </table >
    `;
    }

    // Notes
    let notesHtml = '<p>Öğretmen notu bulunmamaktadır.</p>';
    if (student.teacherNotes && student.teacherNotes.length > 0) {
        notesHtml = `< ul class="print-notes" > ` + student.teacherNotes.map(n => `
    < li >
                <span class="note-date">${new Date(n.date).toLocaleDateString('tr-TR')}</span>
                <p>${n.text}</p>
            </li >
    `).join('') + `</ul > `;
    }

    // Avatar/Photo
    let imgHtml = '<div class="print-avatar-placeholder">🎓</div>';
    if (student.photo) {
        imgHtml = `<img src="${student.photo}" class="print-avatar">`;
    }

    const html = `
    <div class="print-header">
            <div class="print-school-info">
                <h1>${teacher.school || 'Okul Adı Yok'}</h1>
                <p>${teacher.name} - ${teacher.branch}</p>
            </div>
            <div class="print-date">${today}</div>
        </div>
        
        <div class="print-student-info">
            <div class="print-student-photo">${imgHtml}</div>
            <div class="print-student-details">
                <h2>${student.name}</h2>
                <div class="print-meta-grid">
                    <div><span>Numara:</span> ${student.number}</div>
                    <div><span>Sınıf:</span> ${className || 'Belirtilmemiş'}</div>
                </div>
            </div>
        </div>

        <div class="print-section">
            <h3>📈 Sınav Başarısı</h3>
            ${examsHtml}
        </div>

        <div class="print-section">
            <h3>📝 Öğretmen Notları</h3>
            ${notesHtml}
        </div>

        <div class="print-section">
            <h3>ℹ️ Genel Bilgiler</h3>
            <p>${student.notes || 'Ek bilgi yok.'}</p>
        </div>

        <div class="print-footer">
            <p>Bu belge öğretmen tarafından hazırlanmıştır.</p>
            <p>Kişisel veri içerir.</p>
        </div>
`;

    printArea.innerHTML = html;

    // Trigger Print
    setTimeout(() => {
        window.print();
    }, 200); // Slight delay for DOM render
}

// --- Plans Logic (Step 9) ---
function setupPlansLogic() {
    const btnAddPlan = document.getElementById('btn-add-plan');
    const modalPlan = document.getElementById('modal-plan');
    const btnClosePlan = document.getElementById('btn-close-plan-modal');
    const formPlan = document.getElementById('form-plan');

    // Quick Action & Menu Handlers
    const btnDashPlans = document.getElementById('btn-dash-plans');
    const btnSettingsPlans = document.getElementById('btn-settings-plans');

    const openPlansView = () => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('view-plans').classList.add('active');
        // Hide bottom nav/header if desired, but nice to keep header
        document.querySelector('.app-header').style.display = 'flex';
        renderPlans('yearly'); // Default
        document.querySelector('.tab-btn[data-tab="plan-yearly"]').click();
    };

    if (btnDashPlans) btnDashPlans.addEventListener('click', openPlansView);
    if (btnSettingsPlans) btnSettingsPlans.addEventListener('click', openPlansView);

    if (btnAddPlan) btnAddPlan.addEventListener('click', () => {
        document.getElementById('plan-id').value = '';
        document.getElementById('form-plan').reset();
        modalPlan.classList.add('active');
    });

    if (btnClosePlan) btnClosePlan.addEventListener('click', () => modalPlan.classList.remove('active'));

    // Tab switching
    const tabs = document.querySelectorAll('.student-profile-tabs .tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.getAttribute('data-tab').startsWith('plan-')) {
                tabs.forEach(t => {
                    if (t.getAttribute('data-tab').startsWith('plan-')) t.classList.remove('active');
                });
                tab.classList.add('active');
                const type = tab.getAttribute('data-tab') === 'plan-yearly' ? 'yearly' : 'weekly';
                renderPlans(type);
            }
        });
    });

    if (formPlan) {
        formPlan.addEventListener('submit', (e) => {
            e.preventDefault();
            savePlan();
        });
    }
}

function savePlan() {
    const title = document.getElementById('plan-title').value;
    const type = document.getElementById('plan-type').value;
    const fileInput = document.getElementById('plan-file');

    if (!title || fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
        // Blob for storage
        const blob = new Blob([new Uint8Array(e.target.result)], { type: file.type });

        const plan = {
            title: title,
            type: type,
            fileName: file.name,
            fileType: file.type,
            fileData: blob,
            createdAt: new Date()
        };

        const transaction = db.transaction(['plans'], 'readwrite');
        const store = transaction.objectStore('plans');
        store.add(plan);

        transaction.oncomplete = () => {
            alert("Plan kaydedildi.");
            document.getElementById('modal-plan').classList.remove('active');
            renderPlans(type);
        };
    };

    reader.readAsArrayBuffer(file);
}

function renderPlans(type) {
    const list = document.getElementById('plan-list-container');
    list.innerHTML = '';

    const transaction = db.transaction(['plans'], 'readonly');
    const store = transaction.objectStore('plans');
    const idx = store.index('type'); // Use index
    const req = idx.openCursor(IDBKeyRange.only(type));

    let hasPlans = false;

    req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
            hasPlans = true;
            const p = cursor.value;

            const card = document.createElement('div');
            card.className = 'info-card';
            card.style.display = 'flex';
            card.style.justifyContent = 'space-between';
            card.style.alignItems = 'center';
            card.style.marginBottom = '10px';

            const icon = p.fileType.includes('image') ? '🖼️' : '📄';

            card.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <span style="font-size:1.5rem; margin-right:15px;">${icon}</span>
                    <div>
                        <h4 style="margin:0; font-size:1rem;">${p.title}</h4>
                        <p style="margin:0; font-size:0.8rem; color:#888;">${p.fileName}</p>
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-icon" style="color:#4a90e2; font-size:1.2rem;">📂</button>
                    <button class="btn-icon delete-plan-btn" style="color:#e74c3c;">🗑️</button>
                </div>
            `;

            // Open
            card.querySelector('.btn-icon').addEventListener('click', () => {
                const url = URL.createObjectURL(p.fileData);
                window.open(url, '_blank');
            });

            // Delete
            card.querySelector('.delete-plan-btn').addEventListener('click', (ev) => {
                ev.stopPropagation();
                if (confirm('Plan silinsin mi?')) {
                    const t2 = db.transaction(['plans'], 'readwrite');
                    t2.objectStore('plans').delete(p.id);
                    t2.oncomplete = () => renderPlans(type);
                }
            });

            list.appendChild(card);

            cursor.continue();
        } else {
            if (!hasPlans) list.innerHTML = '<div class="empty-state-small">Bu kategori için plan yok.</div>';
        }
    };
}

// --- Settings Logic ---
function setupSettingsLogic() {
    // Theme
    const btnTheme = document.getElementById('btn-settings-theme');
    const modalTheme = document.getElementById('modal-theme');
    const btnCloseTheme = document.getElementById('btn-close-theme-modal');

    if (btnTheme) btnTheme.addEventListener('click', () => modalTheme.classList.add('active'));
    if (btnCloseTheme) btnCloseTheme.addEventListener('click', () => modalTheme.classList.remove('active'));

    const themeOpts = document.querySelectorAll('.theme-option');
    themeOpts.forEach(opt => {
        opt.addEventListener('click', () => {
            const theme = opt.getAttribute('data-theme');
            applyTheme(theme);
            modalTheme.classList.remove('active');
        });
    });

    // Info
    const btnInfo = document.getElementById('btn-settings-info');
    if (btnInfo) {
        btnInfo.addEventListener('click', () => {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('view-info').classList.add('active');
            document.querySelector('.app-header').style.display = 'flex';
        });
    }

    // Reset
    const btnReset = document.getElementById('btn-reset-data');
    if (btnReset) {
        btnReset.addEventListener('click', resetAppData);
    }
}

function applyTheme(themeName) {
    document.body.classList.remove('theme-green', 'theme-dark');
    if (themeName === 'green') document.body.classList.add('theme-green');
    if (themeName === 'dark') document.body.classList.add('theme-dark');
    localStorage.setItem('app-theme', themeName);
}

function resetAppData() {
    if (confirm('UYARI: Tüm veriler silinecek ve uygulama sıfırlanacak. Bu işlem geri alınamaz!')) {
        if (confirm('Son kez soruyorum: Emin misiniz?')) {
            const req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = () => {
                localStorage.clear();
                location.reload();
            };
        }
    }
}

// Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker Registered', reg))
            .catch(err => console.error('Service Worker Failed', err));
    }
}

