
  /* ===============================
   APEX MALL — PRODUCT SCRIPT
   =============================== */

/* ===============================
   GLOBAL ELEMENTS
   =============================== */
let lastFocusedElement = null;

const PRODUCTS_URL = "data/products.json";

const container = document.getElementById("products-container");
const searchInput = document.getElementById("searchInput");
const categoryButtons = document.querySelectorAll(".category");

// Filter / Sort controls
const priceMinInput = document.getElementById('priceMinInput');
const priceMaxInput = document.getElementById('priceMaxInput');
const inStockOnlyCheckbox = document.getElementById('inStockOnly');
const sortSelect = document.getElementById('sortSelect');
const modalQuantityInput = document.getElementById('modalQuantity');

/* ===== MOBILE MENU: populate categories and handle toggling ===== */
const navToggle = document.getElementById("navToggle");
const mobileMenu = document.getElementById("mobileMenu");
const mobileCategories = document.getElementById("mobileCategories");

function populateMobileCategories() {
  if (!mobileCategories) return;
  mobileCategories.innerHTML = "";

  categoryButtons.forEach(btn => {
    const clone = btn.cloneNode(true);
    clone.classList.add("mobile-category");
    clone.addEventListener("click", (e) => {
      e.stopPropagation();
      const cat = clone.dataset.category;
      // trigger original button click to reuse filtering logic
      const orig = Array.from(categoryButtons).find(b => b.dataset.category === cat);
      if (orig) orig.click();
      closeMobileMenu();
    });
    mobileCategories.appendChild(clone);
  });
}

function openMobileMenu() {
  if (!mobileMenu) return;
  mobileMenu.classList.add("open");
  mobileMenu.setAttribute("aria-hidden", "false");
  navToggle.setAttribute("aria-expanded", "true");
  const first = mobileMenu.querySelector("button, a, .category");
  first && first.focus();
}

function closeMobileMenu() {
  if (!mobileMenu) return;
  mobileMenu.classList.remove("open");
  mobileMenu.setAttribute("aria-hidden", "true");
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.focus();
}

if (navToggle && mobileMenu) {
  navToggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mobileMenu.classList.contains("open")) closeMobileMenu(); else openMobileMenu();
  });

  document.addEventListener("click", (e) => {
    if (mobileMenu.classList.contains("open") && !e.target.closest("#mobileMenu") && !e.target.closest("#navToggle")) {
      closeMobileMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mobileMenu.classList.contains("open")) {
      closeMobileMenu();
    }
  });

  // when page is ready, clone the categories into mobile menu
  populateMobileCategories();
}

/* ===============================
   MODAL ELEMENTS
   =============================== */
const modal = document.getElementById("productModal");
const modalMedia = document.querySelector(".modal-media");
const modalThumbs = document.querySelector(".modal-thumbs");

const modalTitle = document.getElementById("modalTitle");
const modalDescription = document.getElementById("modalDescription");
const modalSpecs = document.getElementById("modalSpecs");
const modalPrice = document.getElementById("modalPrice");
const modalOrderBtn = document.getElementById("modalOrderBtn");
const modalNotifyBtn = document.getElementById("modalNotifyBtn");

// Mobile quick buttons
const navMobileOrder = document.getElementById('navMobileOrder');
const navMobileNotify = document.getElementById('navMobileNotify');

// Track last opened product for quick actions
let LAST_OPENED_PRODUCT = null;

const modalCloseBtn = document.querySelector(".modal-close");
const modalOverlay = document.querySelector(".modal-overlay");

if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeModal);
if (modalOverlay) modalOverlay.addEventListener("click", closeModal);

/* ===============================
   STATE
   =============================== */
let ALL_PRODUCTS = [];
let ACTIVE_CATEGORY = "all";

/* ===============================
   FETCH PRODUCTS
   =============================== */
fetch(PRODUCTS_URL)
  .then(res => res.json())
  .then(data => {
    ALL_PRODUCTS = extractProducts(data);

    // Shuffle products so each page load shows a different order
    shuffleArray(ALL_PRODUCTS);

    renderProducts(ALL_PRODUCTS);

      // Setup price bounds and listeners for filtering/sorting
    computePriceBounds();
    attachFilterListeners();

    // Apply inventory edits saved in localStorage (if any)
    applyLocalInventoryEdits();

    // Ensure modal quantity input updates the order href when changed
    if (modalQuantityInput) {
      modalQuantityInput.addEventListener('input', () => {
        // modal product reference will be attached when opening modal
        const currentName = modalTitle && modalTitle.textContent;
        const prod = ALL_PRODUCTS.find(p => p.name === currentName);
        if (prod) updateModalOrderHref(prod);
      });
    }

    // Listen for storage changes from admin page or other tabs and reapply edits
    window.addEventListener('storage', (e) => {
      if (!e || !e.key || e.key === 'apexInventoryEdits') {
        applyLocalInventoryEdits();
      }
    });
  })
  .catch(err => {
    console.error("Failed to load products:", err);
    container.innerHTML = "<p>Unable to load products.</p>";
  });

// Fisher-Yates shuffle - in-place
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/* ===============================
   EXTRACT PRODUCTS
   =============================== */
function extractProducts(data) {
  let results = [];

  if (!Array.isArray(data)) return results;

  data.forEach(item => {
    if (item && (item.title || item.name)) {
      const normalized = normalizeProduct(item);
      if (normalized) results.push(normalized);
    }

    if (Array.isArray(item.products)) {
      item.products.forEach(p => {
        const normalized = normalizeProduct(p);
        if (normalized) results.push(normalized);
      });
    }
  });

  return results;
}

/* ===============================
   NORMALIZE PRODUCT STRUCTURE
   =============================== */
function normalizeProduct(p) {
  if (!p || typeof p !== 'object') return null;

  const details = Array.isArray(p.details) ? p.details : [];
  const specs = Array.isArray(p.specs) ? p.specs : [];

  const priceString = String(p.price || "").trim();
  const priceNumber = (() => {
    const n = parseFloat(priceString.toString().replace(/[^0-9.-]+/g, ''));
    return Number.isFinite(n) ? n : null;
  })();

  const stockNumber = (typeof p.stock === 'number') ? p.stock : null;
  const available = (stockNumber !== null) ? (stockNumber > 0) : ((typeof p.available === 'boolean') ? p.available : true);

  return {
    id: p.id || crypto.randomUUID(),
    name: String(p.title || p.name || "Unnamed Product").trim(),
    price: priceString,
    priceNumber: priceNumber,
    stock: stockNumber,
    currency: String(p.currency || "").trim(),
    image:
      p.image ||
      (details && details[0]) ||
      "https://via.placeholder.com/600x400",
    description: String(p.shortDescription || p.description || "").trim(),
    category: String(p.category || "other").toLowerCase().trim(),
    whatsapp: String(p.whatsapp || "233597323795").trim(),
    external: String(p.external_url || p.link || "").trim(),
    video: p.video || null,
    details: details,
    specs: specs,
    available: available
  }; 
} 

/* ===============================
   RENDER PRODUCTS
   =============================== */
function renderProducts(products) {
  container.innerHTML = "";

  if (products.length === 0) {
    const msg = document.createElement("p");
    msg.textContent = "No products found.";
    container.appendChild(msg);
    return;
  }

  products.forEach(product => {
    const card = document.createElement("div");
    card.className = "product-card";

    const priceText = product.currency
      ? `${product.currency} ${product.price}`
      : product.price;

    const orderLink = product.external
      ? product.external
      : `https://wa.me/${product.whatsapp}?text=${encodeURIComponent(
          "Hello, I want to order: " + product.name
        )}`;

    let badgeHTML = "";

    if (product.video) {
      badgeHTML = `<span class="media-badge">▶ Video</span>`;
    } else if (product.details.length > 1) {
      badgeHTML = `<span class="media-badge">📷 ${product.details.length}</span>`;
    }

    card.innerHTML = `
      <div class="product-media">
        <img src="${product.image}" alt="${product.name}" loading="lazy" data-product-id="${product.id}">
        ${badgeHTML}
      </div>

      <h4></h4>
      <p class="product-desc"></p>

      <div class="price"></div>

      ${product.available ? `
        <a href="${orderLink}" target="_blank" class="buy-btn">Order Now</a>
      ` : `
        <div class="out-stock-actions">
          <button class="buy-btn disabled" aria-disabled="true">Out of stock</button>
          <button class="notify-btn">Notify Me</button>
        </div>
      `}
    `;

    // Use textContent for security (no HTML injection)
    card.querySelector("h4").textContent = product.name;
    card.querySelector(".product-desc").textContent = product.description;
    card.querySelector(".price").textContent = priceText;

    // Add error handling for images
    const img = card.querySelector("img");
    img.addEventListener("error", () => {
      img.src = "https://via.placeholder.com/600x400?text=Image+Not+Found";
    });

    // Prevent buy or notify clicks from opening the modal
    const buyBtn = card.querySelector('.buy-btn');
    if (buyBtn) buyBtn.addEventListener('click', e => e.stopPropagation());

    const notifyBtn = card.querySelector('.notify-btn');
    if (notifyBtn) {
      notifyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Notify via WhatsApp with a prefilled message
        const msg = encodeURIComponent('Hi, please notify me when "' + product.name + '" is back in stock.');
        window.open('https://wa.me/' + product.whatsapp + '?text=' + msg, '_blank');
      });
    }

    card.addEventListener("click", () => {
      openProductModal(product);
    });

    container.appendChild(card);
  });
}

/* ===============================
   MODAL LOGIC (ACCESSIBLE)
   =============================== */
function openProductModal(product) {
  lastFocusedElement = document.activeElement;

  // remember product for quick mobile actions
  LAST_OPENED_PRODUCT = product;
  updateNavQuickButtons(product);

  document.body.classList.add("modal-open");
  modal.classList.add("active");
  modal.removeAttribute("inert");

  // Use textContent for security
  modalTitle.textContent = product.name;
  modalDescription.textContent = product.description;

  modalPrice.textContent = product.currency
    ? `${product.currency} ${product.price}`
    : product.price;

  modalOrderBtn.href = product.external
    ? product.external
    : `https://wa.me/${product.whatsapp}?text=${encodeURIComponent(
        "Hello, I want to order: " + product.name
      )}`;

  modalMedia.innerHTML = "";
  modalThumbs.innerHTML = "";

  if (product.video) {
    modalMedia.innerHTML = `<video controls src="${product.video}"></video>`;
  } else {
    const mainImg = document.createElement("img");
    mainImg.src = product.image;
    mainImg.alt = product.name;
    mainImg.addEventListener("error", () => {
      mainImg.src = "https://via.placeholder.com/600x400?text=Image+Not+Found";
    });
    modalMedia.appendChild(mainImg);
  }

  product.details.forEach((imgSrc, index) => {
    const thumb = document.createElement("img");
    thumb.src = imgSrc;
    thumb.alt = `${product.name} - Image ${index + 1}`;
    if (index === 0) thumb.classList.add("active");

    thumb.addEventListener("error", () => {
      thumb.src = "https://via.placeholder.com/60x60?text=Error";
    });

    thumb.addEventListener("click", () => {
      document
        .querySelectorAll(".modal-thumbs img")
        .forEach(t => t.classList.remove("active"));

      thumb.classList.add("active");
      modalMedia.innerHTML = "";
      const newImg = document.createElement("img");
      newImg.src = imgSrc;
      newImg.alt = product.name;
      newImg.addEventListener("error", () => {
        newImg.src = "https://via.placeholder.com/600x400?text=Image+Not+Found";
      });
      modalMedia.appendChild(newImg);
    });

    modalThumbs.appendChild(thumb);
  });

  modalSpecs.innerHTML = "";
  product.specs.forEach(spec => {
    const li = document.createElement("li");
    li.textContent = spec;
    modalSpecs.appendChild(li);
  });

  // update modal order href and quick nav buttons immediately
  updateModalOrderHref(product);
  updateNavQuickButtons(product);

  modalCloseBtn.focus();
}

// Update the mobile quick order/notify buttons next to the search
function updateNavQuickButtons(product) {
  if (!navMobileOrder) return;

  // Quick order: prefill product if available, else link to general WhatsApp
  if (product && product.available) {
    const qty = modalQuantityInput && Number(modalQuantityInput.value) > 0 ? Number(modalQuantityInput.value) : 1;
    const msg = encodeURIComponent(`Hello, I want to order: ${product.name} (Qty: ${qty})`);
    navMobileOrder.href = product.external ? product.external : `https://wa.me/${product.whatsapp}?text=${msg}`;
  } else {
    // generic order link
    navMobileOrder.href = 'https://wa.me/233597323795';
  }

  // Notify button: show only when product exists and is out-of-stock
  if (navMobileNotify) {
    if (product && !product.available) {
      const msg = encodeURIComponent('Hi, please notify me when "' + product.name + '" is back in stock.');
      navMobileNotify.href = `https://wa.me/${product.whatsapp}?text=${msg}`;
      navMobileNotify.style.display = '';
    } else {
      navMobileNotify.style.display = 'none';
      navMobileNotify.removeAttribute('href');
    }
  }
}

// Click handlers: if user taps quick order when no product selected, open general link
if (navMobileOrder) {
  navMobileOrder.addEventListener('click', (e) => {
    // allow anchor default behavior; but prefer to prefill if we know LAST_OPENED_PRODUCT
    if (LAST_OPENED_PRODUCT) {
      // ensure the href is up to date
      updateNavQuickButtons(LAST_OPENED_PRODUCT);
    }
  });
}

if (navMobileNotify) {
  navMobileNotify.addEventListener('click', (e) => {
    // allow anchor to open; nothing extra needed
  });
}

function closeModal() {
  document.body.classList.remove("modal-open");
  modal.classList.remove("active");
  modal.setAttribute("inert", "");

  if (lastFocusedElement) {
    lastFocusedElement.focus();
  }
}

/* ===============================
   HERO INTERACTIVITY
   =============================== */
const hero = document.querySelector(".hero");
const heroBtn = document.querySelector(".hero-btn");
const navbar = document.querySelector(".navbar");

// Parallax scroll effect
window.addEventListener("scroll", () => {
  const scrollPos = window.scrollY;
  
  // Parallax background movement
  if (hero) {
    hero.style.backgroundPosition = `center calc(50% + ${scrollPos * 0.5}px)`;
  }

  // Add scrolled state to hero when scrolling down
  if (scrollPos > 100) {
    hero.classList.add("scrolled");
  } else {
    hero.classList.remove("scrolled");
  }

  // Navbar shadow effect
  if (scrollPos > 10) {
    navbar.style.boxShadow = "0 4px 15px rgba(0,0,0,0.1)";
  } else {
    navbar.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
  }

  // Show/hide back-to-top button
  const backToTopBtn = document.getElementById("backToTop");
  if (backToTopBtn) {
    if (scrollPos > 300) {
      backToTopBtn.classList.add("show");
    } else {
      backToTopBtn.classList.remove("show");
    }
  }
});

// Back to top button functionality
const backToTopBtn = document.getElementById("backToTop");
if (backToTopBtn) {
  backToTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });
}

// Ripple effect function for buttons
function addRippleEffect(button) {
  button.addEventListener("click", function(e) {
    const ripple = document.createElement("span");
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + "px";
    ripple.style.left = x + "px";
    ripple.style.top = y + "px";
    ripple.classList.add("ripple");

    this.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  });
}

// Apply ripple effect to hero button
if (heroBtn) {
  addRippleEffect(heroBtn);
}

// Apply ripple effect to all category buttons
categoryButtons.forEach(btn => {
  addRippleEffect(btn);
});

// Apply ripple effect to CTA button
const ctaBtn = document.querySelector(".cta-btn");
if (ctaBtn) {
  addRippleEffect(ctaBtn);
}

// Apply ripple effect to all buy buttons (added dynamically)
function applyRippleToNewButtons() {
  const buyBtns = document.querySelectorAll(".buy-btn");
  buyBtns.forEach(btn => {
    // Only add if not already added
    if (!btn.hasRippleListener) {
      addRippleEffect(btn);
      btn.hasRippleListener = true;
    }
  });
}

// Call initially
applyRippleToNewButtons();

// Intersection Observer for scroll animations
const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px"
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = "1";
      entry.target.style.animation = entry.target.dataset.animation || "fadeInUp 0.6s ease-out forwards";
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

// Helper to observe product cards (call after render)
function observeProductCards() {
  const productCards = Array.from(document.querySelectorAll(".product-card"));
  productCards.forEach((card, index) => {
    // Skip if already observed
    if (card._observed) return;
    card.style.opacity = "0";
    card.dataset.animation = `fadeInUp 0.6s ease-out ${index * 0.1}s forwards`;
    observer.observe(card);
    card._observed = true;
  });
}



// Modal smooth open/close with animations (guarded)
const originalOpenModal = openProductModal;
window.openProductModal = function(product) {
  originalOpenModal(product);
  if (modal) {
    modal.style.animation = "modalFadeIn 0.3s ease-out";
    const mc = modal.querySelector(".modal-content");
    if (mc) mc.style.animation = "modalSlideIn 0.3s ease-out";
  }
};

/* ===============================
   FLASH SALE POPUPS
   - Periodically show a small popup in a random corner with a product & CTA
   - Disabled for small screens and respects reduced-motion
   =============================== */
(function setupFlashSales(){
  const INTERVAL_MIN = 14_000; // 14s
  const INTERVAL_MAX = 28_000; // 28s
  const DISPLAY_TIME = 7000; // 7s
  const MOBILE_INTERVAL_MIN = 20_000; // 20s
  const MOBILE_INTERVAL_MAX = 36_000; // 36s
  const MOBILE_DISPLAY_TIME = 5000; // 5s
  const POSITIONS = ['flash-top-left','flash-top-right','flash-bottom-left','flash-bottom-right'];
  let timer = null;

  function shouldRun() {
    // allow running on mobile; behavior will adapt for narrow screens
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return true;
  }

  function isMobileView() {
    return window.innerWidth <= 420;
  }

  function pickRandomProduct() {
    if (!ALL_PRODUCTS || ALL_PRODUCTS.length === 0) return null;
    return ALL_PRODUCTS[Math.floor(Math.random() * ALL_PRODUCTS.length)];
  }

  function createFlash(product) {
    if (!product) return null;

    const flash = document.createElement('div');
    const pos = isMobileView() ? 'flash-bottom-right' : POSITIONS[Math.floor(Math.random()*POSITIONS.length)];
    flash.className = `flash-sale ${pos}`;

    // If mobile, ensure only one mobile flash exists (replace existing)
    if (isMobileView()) {
      const existing = document.querySelector('.flash-sale.flash-bottom-right');
      if (existing) removeFlash(existing);
      flash.classList.add('flash-mobile');
    }

    flash.innerHTML = `
      <div class="thumb"><img src="${product.image}" alt="${product.name}"></div>
      <div class="meta">
        <div class="title">${escapeHtml(product.name)}</div>
        <div class="price">${product.currency ? product.currency+' '+product.price : product.price}</div>
      </div>
      <div class="actions">
        <button class="sale-btn">Order</button>
        <button class="close-btn" aria-label="Close">✕</button>
      </div>
    `;

    // Order button behaviour: open external if available else WhatsApp prefills
    const orderBtn = flash.querySelector('.sale-btn');
    if (orderBtn) {
      const orderFn = (e) => {
        e.stopPropagation();
        if (product.external) window.open(product.external, '_blank', 'noopener');
        else window.open(`https://wa.me/${product.whatsapp}?text=${encodeURIComponent('Hello, I want to order: '+product.name)}`,'_blank');
        removeFlash(flash);
      };
      orderBtn.addEventListener('click', orderFn);
      orderBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      orderBtn.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    }

    // Close button - ensure touch/pointer events are handled first on mobile
    const closeBtn = flash.querySelector('.close-btn');
    if (closeBtn) {
      const closeFn = (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeFlash(flash);
      };
      closeBtn.addEventListener('click', closeFn);
      closeBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); removeFlash(flash); });
      closeBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); removeFlash(flash); }, { passive: false });
    }

    // Allow clicking the card to open modal instead — but ignore clicks coming from actionable children
    flash.addEventListener('click', (e) => {
      // if user tapped the order or close buttons, do nothing here
      if (e.target.closest('.sale-btn') || e.target.closest('.close-btn') || e.target.closest('.notify-btn')) return;
      e.stopPropagation();
      openProductModal(product);
      removeFlash(flash);
    });

    document.body.appendChild(flash);

    // Auto-remove after display time (shorter on mobile)
    const duration = isMobileView() ? MOBILE_DISPLAY_TIME : DISPLAY_TIME;
    const out = setTimeout(() => removeFlash(flash), duration);

    return {flash, out};
  }

  function removeFlash(node) {
    if (!node) return;
    node.style.animation = 'flashOut 0.35s ease-out forwards';
    setTimeout(() => node.remove(), 360);
  }

  function scheduleNext() {
    if (!shouldRun()) return;
    const mobile = isMobileView();
    const min = mobile ? MOBILE_INTERVAL_MIN : INTERVAL_MIN;
    const max = mobile ? MOBILE_INTERVAL_MAX : INTERVAL_MAX;
    const delay = min + Math.random() * (max - min);
    // Debug logging to help diagnose mobile issues
    console.debug('[flash] scheduling next flash', { mobile, delay });
    timer = setTimeout(() => {
      const product = pickRandomProduct();
      if (product) {
        console.debug('[flash] creating flash for product', product.id, product.name, 'mobile=', mobile);
        createFlash(product);
      }
      scheduleNext();
    }, delay);
  }

  // start after page load a little later to avoid competing with initial render
  window.addEventListener('load', () => {
    setTimeout(() => scheduleNext(), 2000);
  });

  // utility: escape HTML in product name
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, (s)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
  }
})();

const originalCloseModal = closeModal;
window.closeModal = function() {
  if (modal) modal.style.animation = "modalFadeOut 0.3s ease-out forwards";
  setTimeout(() => {
    originalCloseModal();
  }, 300);
};

// Wrap renderProducts so dynamic UI hooks are re-applied after each render
const originalRenderProducts = renderProducts;
renderProducts = function(products) {
  originalRenderProducts(products);
  applyRippleToNewButtons();
  observeProductCards();
};

/* ===============================
   DEBOUNCE UTILITY
   =============================== */
function debounce(func, delay = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

/* ===============================
   SEARCH
   =============================== */
if (searchInput) {
  searchInput.addEventListener("input", debounce(filterProducts, 300));
} else {
  console.warn('Search input `#searchInput` not found.');
}

/* ===============================
   CATEGORY FILTER
   =============================== */
categoryButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    categoryButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    ACTIVE_CATEGORY = btn.dataset.category;
    filterProducts();
  });
});

/* ===============================
   FILTER LOGIC
   =============================== */
function filterProducts() {
  const query = (searchInput && searchInput.value || '').toLowerCase();

  const min = priceMinInput && priceMinInput.value !== '' ? Number(priceMinInput.value) : null;
  const max = priceMaxInput && priceMaxInput.value !== '' ? Number(priceMaxInput.value) : null;
  const inStockOnly = inStockOnlyCheckbox && inStockOnlyCheckbox.checked;

  let filtered = ALL_PRODUCTS.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query);

    const matchesCategory =
      ACTIVE_CATEGORY === "all" ||
      p.category.toLowerCase().includes(ACTIVE_CATEGORY);

    const matchesPrice = (
      (min === null || p.priceNumber === null || p.priceNumber >= min) &&
      (max === null || p.priceNumber === null || p.priceNumber <= max)
    );

    const matchesStock = !inStockOnly || p.available;

    return matchesSearch && matchesCategory && matchesPrice && matchesStock;
  });

  // Sorting
  const sort = sortSelect && sortSelect.value;
  if (sort === 'price-asc') {
    filtered.sort((a,b) => (a.priceNumber || 0) - (b.priceNumber || 0));
  } else if (sort === 'price-desc') {
    filtered.sort((a,b) => (b.priceNumber || 0) - (a.priceNumber || 0));
  } else if (sort === 'name-asc') {
    filtered.sort((a,b) => a.name.localeCompare(b.name));
  } else if (sort === 'name-desc') {
    filtered.sort((a,b) => b.name.localeCompare(a.name));
  }

  renderProducts(filtered);
}

/* ===============================
   LOCAL INVENTORY EDITS (apexInventoryEdits)
   - Admin page stores per-product stock values in localStorage as a map of id -> stock
   - This function applies those edits into ALL_PRODUCTS so the site reflects local changes
   =============================== */
function applyLocalInventoryEdits() {
  try {
    const raw = localStorage.getItem('apexInventoryEdits');
    if (!raw) return;
    const edits = JSON.parse(raw);
    if (!edits || typeof edits !== 'object') return;

    let mutated = false;
    ALL_PRODUCTS.forEach(p => {
      const key = String(p.id);
      if (Object.prototype.hasOwnProperty.call(edits, key)) {
        const newStock = edits[key];
        const n = Number(newStock);
        if (!Number.isNaN(n)) {
          p.stock = n;
          p.available = (p.stock != null) ? (p.stock > 0) : p.available;
          mutated = true;
        }
      }
    });

    if (mutated) {
      renderProducts(ALL_PRODUCTS);
    }
  } catch (e) {
    console.warn('Failed to apply local inventory edits:', e);
  }
}


// Compute price bounds for UI and attach control listeners
function computePriceBounds() {
  const nums = ALL_PRODUCTS.map(p => p.priceNumber).filter(n => n !== null);
  if (nums.length === 0) return;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (priceMinInput) priceMinInput.value = Math.floor(min);
  if (priceMaxInput) priceMaxInput.value = Math.ceil(max);
}

function attachFilterListeners() {
  if (priceMinInput) priceMinInput.addEventListener('input', debounce(filterProducts, 250));
  if (priceMaxInput) priceMaxInput.addEventListener('input', debounce(filterProducts, 250));
  if (inStockOnlyCheckbox) inStockOnlyCheckbox.addEventListener('change', filterProducts);
  if (sortSelect) sortSelect.addEventListener('change', filterProducts);
}

// Update modal order link when quantity changes
function updateModalOrderHref(product) {
  if (!product || !modalOrderBtn) return;
  const qty = modalQuantityInput && Number(modalQuantityInput.value) > 0 ? Number(modalQuantityInput.value) : 1;

  const message = `Hello, I want to order: ${product.name} (Qty: ${qty})${product.price ? ' - Price: '+(product.currency? product.currency+' '+product.price : product.price) : ''}`;
  const href = product.external ? product.external : `https://wa.me/${product.whatsapp}?text=${encodeURIComponent(message)}`;

  if (product.available) {
    modalOrderBtn.href = href;
    modalOrderBtn.classList.remove('disabled');
    modalOrderBtn.removeAttribute('aria-disabled');
    modalOrderBtn.textContent = 'Order Now';
    if (modalNotifyBtn) modalNotifyBtn.style.display = 'none';
  } else {
    modalOrderBtn.removeAttribute('href');
    modalOrderBtn.classList.add('disabled');
    modalOrderBtn.setAttribute('aria-disabled','true');
    modalOrderBtn.textContent = 'Out of stock';

    if (modalNotifyBtn) {
      const msg = encodeURIComponent('Hi, please notify me when "' + product.name + '" is back in stock.');
      modalNotifyBtn.href = 'https://wa.me/' + product.whatsapp + '?text=' + msg;
      modalNotifyBtn.style.display = '';
      modalNotifyBtn.addEventListener('click', (e) => {
        // allow regular anchor navigation; ensure accessibility
      }, { once: true });
    }
  }
} 
