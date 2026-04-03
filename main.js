/* RDX RED - Main Logic */

// DOM Elements
const pages = document.querySelectorAll('.page-section');
const navLinks = document.querySelectorAll('.nav-link');
const gridContainer = document.querySelector('.media-grid');
const mySpaceBtn = document.querySelector('.myspace-btn');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxVideo = document.getElementById('lightbox-video');
const lightboxCaption = document.getElementById('lightbox-caption');

// Theme Logic
const themeBtn = document.getElementById('theme-toggle');
const body = document.body;

// Check Saved Theme
if (localStorage.getItem('theme') === 'light') {
    body.classList.add('light-mode');
    if (themeBtn) themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
}

if (themeBtn) {
    themeBtn.addEventListener('click', () => {
        body.classList.toggle('light-mode');
        const isLight = body.classList.contains('light-mode');
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
        themeBtn.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });
}

// State
let currentUser = null; // 'admin' or 'client'
const savedSession = localStorage.getItem('rdx_session');
if (savedSession === 'admin' || savedSession === 'test_admin') { currentUser = savedSession; }

// Background Video Settings


/* --- Navigation --- */
function navigateTo(pageId) {
    // Update Active Link
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${pageId}`) {
            link.classList.add('active');
        }
    });

    // Show Section
    pages.forEach(page => {
        page.classList.remove('active');
        if (page.id === pageId) {
            page.classList.add('active');
            // Trigger specific page loaders
            if (pageId === 'creations') loadCreations();
            if (pageId === 'studio') loadStudios();
            if (pageId === 'myspace') loadMySpace();
            if (pageId === 'home') restartHeroAnimations();

            // Re-trigger scroll animations for the new section
            setTimeout(initScrollAnimations, 100);
        }
    });
}

function restartHeroAnimations() {
    const heroTitle = document.querySelector('.hero-title');
    const heroTagline = document.querySelector('.hero-tagline');
    const heroFounded = document.querySelector('.hero-founded');

    // Reset animations by cloning
    [heroTitle, heroTagline, heroFounded].forEach(el => {
        if (el) {
            el.style.animation = 'none';
            el.offsetHeight; /* trigger reflow */
            el.style.animation = '';
        }
    });
}

// Event Listeners for Nav
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        navigateTo(targetId);
    });
});

// Hero Button Listener
document.querySelector('.hero-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('creations');
});

mySpaceBtn.addEventListener('click', () => navigateTo('myspace'));

/* --- Creations Page --- */
// Store created URLs to revoke them later
let activeLightboxUrl = null;

window.loadCreations = loadCreations;
async function loadCreations(filterType = 'all', filterStudio = 'all') {
    const media = await DataService.getMedia(); // Await data
    const container = document.getElementById('media-grid-container');

    // Clean up previous URLs to prevent memory leaks if re-rendering
    if (window._createdObjectUrls) {
        window._createdObjectUrls.forEach(url => URL.revokeObjectURL(url));
    }
    window._createdObjectUrls = [];

    container.innerHTML = '';

    const filtered = media.filter(item => {
        const typeMatch = filterType === 'all' || item.type === filterType;
        const studioMatch = filterStudio === 'all' || item.studio.toLowerCase() === filterStudio.toLowerCase();
        return typeMatch && studioMatch;
    });

    filtered.forEach(item => {
        // Handle Blob URLs
        let thumbUrl = item.thumbnail || item.url;

        // ONLY create ObjectURL for thumbnails (images) upfront
        if (item.thumbnail instanceof Blob) {
            const u = URL.createObjectURL(item.thumbnail);
            thumbUrl = u;
            window._createdObjectUrls.push(u);
        } else if (item.url instanceof Blob && item.type === 'photo') {
            // For photos, we need the URL for the thumbnail img
            const u = URL.createObjectURL(item.url);
            thumbUrl = u;
            // Also store it for lightbox use
            item._tempDisplayUrl = u;
            window._createdObjectUrls.push(u);
        }

        const card = document.createElement('div');
        card.className = 'media-card glass-card';

        // Structure
        const img = document.createElement('img');

        // Optimize: Don't set img.src to a video blob
        if (item.type !== 'video' || (item.thumbnail && item.thumbnail instanceof Blob)) {
            img.src = thumbUrl;
        } else if (typeof thumbUrl === 'string' && !thumbUrl.startsWith('blob:')) {
            // It's a string URL (external or asset), fine to use
            img.src = thumbUrl;
        } else {
            // If it's a video BLOB and no separate thumbnail blob, 
            // we CANNOT easily show a thumb without generating a frame (expensive).
            // Just show a generic placeholder or the card background.
            // img.src = ''; // Leave empty
        }

        img.className = 'media-thumbnail';
        img.alt = item.title;
        img.loading = 'lazy';

        // Video Preview Logic
        let videoPreview = null;
        let activePreviewUrl = null;

        if (item.type === 'video') {
            videoPreview = document.createElement('video');
            // No src initially
            videoPreview.muted = true;
            videoPreview.loop = true;
            videoPreview.preload = 'none';
            videoPreview.className = 'video-preview';

            // Events
            card.addEventListener('mouseenter', () => {
                // Generate URL on fly
                if (item.url instanceof Blob) {
                    activePreviewUrl = URL.createObjectURL(item.url);
                } else {
                    activePreviewUrl = item.url;
                }

                videoPreview.src = activePreviewUrl;
                videoPreview.load();
                const p = videoPreview.play();
                if (p) p.catch(() => { });
            });

            card.addEventListener('mouseleave', () => {
                videoPreview.pause();
                videoPreview.currentTime = 0;
                videoPreview.removeAttribute('src');
                videoPreview.load();

                // Revoke immediately if it was a blob
                if (activePreviewUrl && item.url instanceof Blob) {
                    URL.revokeObjectURL(activePreviewUrl);
                    activePreviewUrl = null;
                }
            });
        }

        const info = document.createElement('div');
        info.className = 'media-info';
        info.innerHTML = `
            <h3 class="media-title">${item.title}</h3>
            <div class="media-meta">
                <span>${item.category}</span>
                <span>${item.studio}</span>
            </div>
            ${currentUser === 'admin' ? `<button class="btn-delete-media" data-id="${item.id}" style="color:var(--primary-red); margin-top:10px; border:1px solid var(--primary-red); background:transparent; padding:5px 10px; border-radius:5px; cursor:pointer;">Delete</button>` : ''}
        `;

        // Assemble
        if (videoPreview) card.appendChild(videoPreview);
        card.appendChild(img);
        card.appendChild(info);

        card.addEventListener('click', (e) => {
            if (!e.target.classList.contains('btn-delete-media')) {
                openLightbox(item);
            }
        });

        // Bind Delete manually
        const delBtn = card.querySelector('.btn-delete-media');
        if (delBtn) {
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteMedia(item.id);
            }
        }

        // Animation
        card.classList.add('reveal');
        container.appendChild(card);
    });

    // Re-init animations for new elements
    initScrollAnimations();
}

function openLightbox(item) {
    // Generate URL on demand
    let src = item.url;
    if (item.url instanceof Blob) {
        activeLightboxUrl = URL.createObjectURL(item.url);
        src = activeLightboxUrl;
    } else if (item._tempDisplayUrl) {
        // Use the one we created for the photo thumbnail
        src = item._tempDisplayUrl;
    }

    // Aggressively Optimize Resources
    const bgVideo = document.getElementById('main-bg-video');
    if (bgVideo) {
        bgVideo.pause();
        bgVideo.style.display = 'none'; // Force hide to stop rendering
    }

    // Pause any other previews
    document.querySelectorAll('video').forEach(v => {
        v.pause();
    });

    if (item.type === 'video') {
        lightboxImg.style.display = 'none';
        lightboxVideo.style.display = 'block';
        lightboxVideo.src = src;
        lightboxVideo.load(); // Force load
        lightboxVideo.playsInline = true; // Ensure inline playback

        const playPromise = lightboxVideo.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("Lightbox video play error:", error);
            });
        }
    } else {
        lightboxVideo.style.display = 'none';
        lightboxVideo.pause();
        lightboxVideo.src = ""; // Clear src to stop buffering
        lightboxImg.style.display = 'block';
        lightboxImg.src = src;
    }

    lightboxCaption.innerText = item.title;
    lightbox.classList.add('active');
}

window.closeLightbox = () => {
    lightbox.classList.remove('active');
    lightboxVideo.pause();
    lightboxVideo.src = "";

    // Revoke URL
    if (activeLightboxUrl) {
        URL.revokeObjectURL(activeLightboxUrl);
        activeLightboxUrl = null;
    }

    // Resume Background Video
    const bgVideo = document.getElementById('main-bg-video');
    if (bgVideo) {
        bgVideo.style.display = 'block';
        bgVideo.playbackRate = 0.5; // Enforce fluid speed (0.5x)
        bgVideo.play().catch(e => console.log("Bg resume failed", e));
    }
};

// Close on outside click
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
});

// Global scope for onclick
// Global scope for onclick
window.deleteMedia = async (id) => {
    if (confirm('Delete this media?')) {
        try {
            await DataService.deleteMedia(id);
            loadCreations();
            // Check if library is active
            if (document.getElementById('admin-view-library').classList.contains('active')) {
                renderMediaLibrary();
            }
        } catch (error) {
            console.error('Error deleting media:', error);
            alert('Failed to delete media. Please try again.');
        }
    }
};

window.deleteMessage = async (id) => {
    if (confirm('Delete this message?')) {
        try {
            await DataService.deleteMessage(id);
            // Refresh messages view if active
            if (document.getElementById('admin-view-messages').classList.contains('active')) {
                renderAdminMessages();
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Failed to delete message. Please try again.');
        }
    }
};

/* --- Studio Page --- */
/* --- Studio Page --- */
async function loadStudios() {
    const studios = await DataService.getStudios();

    // Update Kokkada
    const kStatus = document.getElementById('status-kokkada');
    if (kStatus) {
        kStatus.textContent = studios.kokkada.status;
        kStatus.className = `status-badge ${studios.kokkada.status === 'OPEN' ? 'status-open' : 'status-closed'}`;
    }

    // Update Mysuru
    const mStatus = document.getElementById('status-mysuru');
    if (mStatus) {
        mStatus.textContent = studios.mysuru.status;
        mStatus.className = `status-badge ${studios.mysuru.status === 'OPEN' ? 'status-open' : 'status-closed'}`;
    }
}

/* --- My Space / Admin --- */
function loadMySpace() {
    const loginForm = document.getElementById('login-form');
    const dashboard = document.getElementById('admin-dashboard');

    if (currentUser === 'admin' || currentUser === 'test_admin') {
        loginForm.style.display = 'none';
        dashboard.classList.add('active');

        // Show/Hide Problems Tab
        const problemTab = document.getElementById('tab-problems');
        if (problemTab) {
            problemTab.style.display = (currentUser === 'test_admin') ? 'block' : 'none';
        }

        switchAdminTab('overview'); // Default view
    } else {
        loginForm.style.display = 'block';
        dashboard.classList.remove('active');
    }
}

// Login Logic
document.getElementById('btn-login').addEventListener('click', () => {
    const user = document.getElementById('u-email').value;
    const pass = document.getElementById('u-pass').value;

    if (user === 'elite8chz' && pass === 'Chriszeyon@07') {
        currentUser = 'admin';
        performLogin();
    } else if (user === 'test' && pass === '123') {
        currentUser = 'test_admin';
        performLogin();
    } else {
        alert('Invalid Credentials');
    }
});

function performLogin() {
    localStorage.setItem('rdx_session', currentUser);
    // Hide form immediately
    document.getElementById('login-form').style.display = 'none';

    // Play Admin Intro then load dashboard
    playAdminIntro().then(() => {
        loadMySpace();
    });
}

document.getElementById('btn-logout').addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('rdx_session');
    loadMySpace();
});

/* --- ADMIN TABS & MEDIA LIBRARY --- */
/* --- ADMIN TABS & MEDIA LIBRARY --- */
window.switchAdminTab = (tabId) => {
    // Tabs
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.admin-tab[onclick="switchAdminTab('${tabId}')"]`).classList.add('active');

    // Views
    document.querySelectorAll('.admin-view').forEach(view => view.classList.remove('active'));
    document.getElementById(`admin-view-${tabId}`).classList.add('active');

    if (tabId === 'overview') renderAdminStats();
    if (tabId === 'library') {
        renderMediaLibrary();
        updateStorageMeter();
    }
    if (tabId === 'messages') renderAdminMessages();
};

async function updateStorageMeter() {
    // IDB Estimator
    if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        // usage is in bytes
        const usedMB = (estimate.usage / (1024 * 1024)).toFixed(1);
        const quotaMB = (estimate.quota / (1024 * 1024)).toFixed(0);
        const percent = Math.min(100, (estimate.usage / estimate.quota) * 100).toFixed(1);

        document.getElementById('storage-text').innerText = `${percent}% Used (${usedMB} MB / ${quotaMB} MB)`;
        document.getElementById('storage-bar-fill').style.width = `${percent}%`;

        // Color code
        const fill = document.getElementById('storage-bar-fill');
        if (percent > 80) fill.style.background = 'red';
        else if (percent > 50) fill.style.background = 'orange';
        else fill.style.background = 'var(--primary-red)';
    } else {
        document.getElementById('storage-text').innerText = 'Storage info unavailable';
    }
}

async function renderMediaLibrary() {
    const media = await DataService.getMedia();
    const container = document.getElementById('admin-library-grid');
    container.innerHTML = '';

    media.forEach(item => {
        let thumbUrl = item.thumbnail || item.url;
        if (item.thumbnail instanceof Blob) thumbUrl = URL.createObjectURL(item.thumbnail);
        else if (item.url instanceof Blob) thumbUrl = URL.createObjectURL(item.url);

        const div = document.createElement('div');
        div.className = 'library-item';
        div.innerHTML = `
            <img src="${thumbUrl}" loading="lazy" alt="${item.title}">
            <div class="lib-actions">
                <button class="btn-delete-mini">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // Attach listener manually
        div.querySelector('.btn-delete-mini').addEventListener('click', () => deleteMedia(item.id));

        container.appendChild(div);
    });
}

async function renderAdminStats() {
    const media = await DataService.getMedia();
    document.getElementById('stat-count').innerText = media.length;
}

// Drag & Drop Handling
const dropZone = document.getElementById('drag-drop-zone');
const fileInput = document.getElementById('inp-file');

if (dropZone) {
    dropZone.addEventListener('click', () => fileInput.click());

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        fileInput.files = files; // Assign to input
        alert(`Selected: ${files[0].name}`);
    }
}

// Contact Form
document.getElementById('contact-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('c-name').value;
    const email = document.getElementById('c-email').value;
    const msg = document.getElementById('c-msg').value;

    await DataService.addMessage({ name, email, msg });

    // Custom Feedback Message
    const feedbackMsg = `Thank you, ${name}! We have received your message details.\n\nFurther communication will be conducted via email (ddxredx0703@gmail.com).\n\nPlease be ready to share any reference images or videos.\n\nNOTE: If you have requested Photography services, please reply to our upcoming email with the EVENT ADDRESS and DEADLINE.`;

    alert(feedbackMsg);
    e.target.reset();
});

// Admin Actions (Upload)
// Admin Actions (Upload)
// Update listeners for new inputs
const categorySelect = document.getElementById('inp-category');
const customCategoryInput = document.getElementById('inp-custom-category');

if (categorySelect) {
    categorySelect.addEventListener('change', () => {
        if (categorySelect.value === 'other') {
            customCategoryInput.classList.add('visible');
        } else {
            customCategoryInput.classList.remove('visible');
        }
    });
}

document.getElementById('admin-add-media')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('inp-title').value;
    const typeVal = document.getElementById('inp-type').value; // 'photo' or 'video'
    const categoryVal = document.getElementById('inp-category').value;
    const studio = document.getElementById('inp-studio').value;

    let finalCategory = categoryVal;
    if (categoryVal === 'other') {
        finalCategory = customCategoryInput.value || 'Other';
    }

    if (fileInput.files && fileInput.files.length > 0) {
        // Iterate and upload
        const files = Array.from(fileInput.files);
        const totalFiles = files.length;
        let uploadedCount = 0;

        const coverInput = document.getElementById('inp-cover');
        const coverFile = (coverInput && coverInput.files && coverInput.files[0]) ? coverInput.files[0] : null;

        for (const file of files) {
            // Use selected type, or auto-detect if not strict?
            // User now explicitly selects 'photo' or 'video'. We should respect that if possible, 
            // but for safety, maybe check MIME too?
            // Let's rely on the explicit Type dropdown as it's cleaner for organization.
            let finalType = typeVal;

            // Fallback if bad selection? No, required field.
            if (!finalType || finalType === '') {
                if (file.type.startsWith('video/')) finalType = 'video';
                else finalType = 'photo';
            }

            try {
                await DataService.addMedia({
                    title: (totalFiles > 1) ? `${title} (${uploadedCount + 1})` : title,
                    type: finalType,
                    studio,
                    category: finalCategory,
                    url: file,
                    thumbnail: coverFile || file
                });
                uploadedCount++;
            } catch (err) {
                console.error('Failed to upload file:', file.name, err);
            }
        }

        alert(`Uploaded ${uploadedCount} files successfully!`);
        document.getElementById('admin-add-media').reset();
        fileInput.value = '';
        if (coverInput) coverInput.value = '';
        customCategoryInput.classList.remove('visible');

        // Refresh views
        if (document.getElementById('creations').classList.contains('active')) {
            loadCreations();
        }
        switchAdminTab('library');

    } else {
        alert('Please select at least one file.');
    }
});

window.toggleStudio = async (key) => {
    await DataService.toggleStudioStatus(key);
    loadStudios();
    alert(`${key} status toggled!`);
};

async function renderAdminMessages() {
    const container = document.getElementById('admin-chat');
    const messages = await DataService.getMessages();
    container.innerHTML = '';

    messages.forEach(msg => {
        const date = new Date(msg.date).toLocaleString();
        const div = document.createElement('div');
        div.className = 'message-bubble';

        // Gmail Compose Link
        const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${msg.email}&su=Re: Inquiry from RDX RED Website&body=Hi ${msg.name},%0D%0A%0D%0AThank you for contacting RDX RED. regarding your message: "${msg.msg}"...`;

        div.innerHTML = `
            <div class="msg-header">
                <span class="msg-sender">${msg.name} (${msg.email})</span>
                <span>${date}</span>
            </div>
            <div class="msg-content">${msg.msg}</div>
            <div class="reply-box">
                <a href="${gmailLink}" target="_blank" class="btn-primary" style="text-decoration:none; display:inline-block; font-size:0.8rem; padding:5px 15px;">
                    <i class="fas fa-reply"></i> Reply via Gmail
                </a>
                <button class="btn-delete-msg" style="background:transparent; border:1px solid red; color:red; padding:5px 15px; margin-left:10px; cursor:pointer;">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        div.querySelector('.btn-delete-msg').onclick = () => deleteMessage(msg.id);
        container.appendChild(div);
    });
}

/* --- Header Scroll Effect --- */
window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (window.scrollY > 100) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

/* --- Scroll Animations --- */
let scrollObserver;

function initScrollAnimations() {
    if (!scrollObserver) {
        scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, { threshold: 0.1 });
    }

    document.querySelectorAll('.reveal').forEach(el => {
        // Prevent double observation (optional check)
        scrollObserver.observe(el);
    });
}

// Init
// navigateTo('home'); // Moved inside intro logic

// Header Logo Click Event
document.querySelectorAll('.header-logo, .brand-logo').forEach(logo => {
    logo.addEventListener('click', () => {
        playLogoVideo();
    });
});

function playLogoVideo() {
    const overlay = document.getElementById('logo-video-overlay');
    const video = document.getElementById('logo-video');

    if (!overlay || !video) return;
    
    video.onerror = () => { overlay.classList.add('hidden'); };

    overlay.classList.remove('hidden');
    video.currentTime = 0;
    video.muted = false; // Try unmuted as user interaction occurred

    const promise = video.play();
    if (promise !== undefined) {
        promise.catch(error => {
            console.warn("Logo video autoplay prevented:", error);
            video.muted = true;
            video.play();
        });
    }

    const finishLogoVideo = () => {
        // Fade out
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.style.opacity = ''; // Reset inline opacity
            video.pause();
            video.currentTime = 0;
            window.removeEventListener('keydown', skipHandler);
        }, 500); // Match CSS transition time usually, but here we can force it
    };

    video.onended = finishLogoVideo;

    const skipHandler = (e) => {
        if (e.key === 'Enter') {
            finishLogoVideo();
        }
    };
    window.addEventListener('keydown', skipHandler);
}

/* --- Intro Animation --- */
const introOverlay = document.getElementById('intro-overlay');

function playIntro() {
    const video = document.getElementById('intro-video');

    // Ensure muted for autoplay policy
    video.muted = true;

    const promise = video.play();
    if (promise !== undefined) {
        promise.catch(e => {
            console.warn("Intro autoplay blocked:", e);
            // If blocked, we might just finish immediately or show a 'click to start'
            // For now, let's just finish to avoid stuck screen
            finishIntro();
        });
    }

    video.onended = () => {
        finishIntro();
    };

    // Skip on Enter
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !introOverlay.classList.contains('hidden')) {
            finishIntro();
        }
    });

    // Fallback if video fails to load
    video.onerror = () => {
        console.error("Intro video error");
        finishIntro();
    }
}

function finishIntro() {
    // Prevent multiple calls
    if (introOverlay.classList.contains('hidden')) return;

    introOverlay.classList.add('hidden');
    // Start site animations after intro
    navigateTo('home');
    initScrollAnimations();
    initHomeVideoObserver();

    // Remove overlay from DOM after fade out to save memory
    setTimeout(() => {
        introOverlay.style.display = 'none';
    }, 1000);
}

function playAdminIntro() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('admin-intro-overlay');
        const video = document.getElementById('admin-intro-video');

        if (!overlay || !video) {
            console.error("Admin intro elements not found");
            resolve();
            return;
        }

        overlay.classList.remove('hidden');
        video.currentTime = 0;

        // Try playing with sound since user interacted (clicked login)
        video.muted = false;

        const promise = video.play();
        if (promise !== undefined) {
            promise.catch(error => {
                console.warn("Autoplay prevented, trying muted:", error);
                video.muted = true;
                video.play();
            });
        }

        video.onended = () => {
            finishAdminIntro();
        };

        // Skip on Enter
        const skipHandler = (e) => {
            if (e.key === 'Enter' && !overlay.classList.contains('hidden')) {
                window.removeEventListener('keydown', skipHandler); // Cleanup
                finishAdminIntro();
            }
        };
        window.addEventListener('keydown', skipHandler);

        function finishAdminIntro() {
            // Start Fade/Blur
            overlay.classList.add('fade-blur-out');

            // Wait for transition (1.5s) to complete
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('fade-blur-out'); // Reset for next time
                video.pause();
                resolve();
            }, 1500);
        }

        // Safety timeout (e.g. if video fails or is 0 length)
        setTimeout(() => {
            // If still playing after a very long time (optional)? 
            // Better to just let it play. But if video error occurs:
        }, 100);

        video.onerror = () => {
            overlay.classList.add('hidden');
            resolve();
        };
    });
}

// Mobile Menu
const mobileToggle = document.getElementById('mobile-menu-toggle');
const sidebar = document.querySelector('.sidebar');
if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });
}
// Close sidebar when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => sidebar.classList.remove('active'));
});

// Parallax Effect
document.addEventListener('mousemove', (e) => {
    // Disable if lightbox is active to save resources
    if (document.getElementById('lightbox').classList.contains('active')) return;

    const x = (e.clientX / window.innerWidth) * 20;
    const y = (e.clientY / window.innerHeight) * 20;

    const bgImg = document.getElementById('main-bg-image');
    if (bgImg) {
        bgImg.style.transform = `translate(-${x}px, -${y}px) scale(1.1)`;
    }

    // Apply to video as well for consistent feel
    const bgVid = document.getElementById('main-bg-video');
    if (bgVid) {
        bgVid.style.transform = `translate(calc(-50% - ${x}px), calc(-50% - ${y}px)) scale(1.1)`;
    }
});

// Form Validation
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', () => {
            if (input.checkValidity()) {
                input.style.borderColor = 'lime';
                input.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.2)';
            } else {
                input.style.borderColor = 'red';
                input.style.boxShadow = 'none';
            }
        });
    });
}

// Start everything
playIntro();
// initScrollAnimations(); // Moved to finishIntro

/* --- Home Background Video Logic --- */
function initHomeVideoObserver() {
    const homeSection = document.getElementById('home');
    const bgVideo = document.getElementById('main-bg-video');

    if (!homeSection || !bgVideo) return;
    
    bgVideo.onerror = () => { bgVideo.style.display = 'none'; };

    // Set playback speed - Restored to 0.5 for smoother flow
    bgVideo.playbackRate = 0.5;

    // Initially pause
    bgVideo.pause();

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Home is visible
                bgVideo.style.opacity = '1';
                bgVideo.playbackRate = 0.5; // Enforce on play
                bgVideo.play().catch(e => console.log("Bg video play block", e));
            } else {
                // Home is not visible
                bgVideo.style.opacity = '0';
                bgVideo.pause();
                bgVideo.currentTime = 0; // Optional: Reset
            }
        });
    }, { threshold: 0.1 });

    observer.observe(homeSection);
}
