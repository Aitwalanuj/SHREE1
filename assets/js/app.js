(() => {
  const cfg = window.LUXE_WEBSITE_CONFIG || {};
  const fallbackSettings = {
    site_name: cfg.SITE_NAME || 'SHREE',
    topbar_text: 'Browse products, inquire online, Instagram, or WhatsApp us directly.',
    hero_title: 'Boutique Styles, Curated by Category',
    hero_text: 'Products and images are managed from the CMS. Upload images in CMS and they will show here.',
    hero_image: '',
    whatsapp_number: cfg.WHATSAPP_NUMBER || '9779868800001',
    instagram_url: cfg.INSTAGRAM_URL || '',
    default_message: cfg.DEFAULT_MESSAGE || 'Hello, I want to inquire about your boutique products.',
    contact_heading: 'Contact SHREE',
    contact_text: 'Use the inquiry form, Instagram, or WhatsApp for direct messages.',
    fonts: {
      body: 'Poppins, Arial, sans-serif',
      heading: 'Playfair Display, Georgia, serif',
      nav: 'Poppins, Arial, sans-serif',
      button: 'Poppins, Arial, sans-serif',
      body_size: '16px',
      heading_weight: '700'
    }
  };

  const state = {
    settings: { ...fallbackSettings },
    categories: [],
    products: [],
    connected: false,
    loading: true,
    error: ''
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
  const cleanBase = () => String(cfg.CMS_API_BASE || '').trim().replace(/\/+$/, '');
  const cmsConfigured = () => {
    const base = cleanBase();
    return /^https?:\/\//i.test(base) && !/your-cms-site/i.test(base);
  };

  function apiUrl(endpoint) {
    return `${cleanBase()}/${String(endpoint || '').replace(/^\/+/, '')}`;
  }

  async function apiGet(endpoint) {
    const res = await fetch(apiUrl(endpoint), { headers: { accept: 'application/json' }, cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.message || `CMS request failed: ${res.status}`);
    return json;
  }

  async function apiPost(endpoint, payload) {
    const res = await fetch(apiUrl(endpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload || {})
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) throw new Error(json.message || `CMS request failed: ${res.status}`);
    return json;
  }

  function arrayFromPayload(payload, key) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.[key])) return payload[key];
    return [];
  }

  async function loadCms() {
    state.loading = true;
    state.error = '';
    if (!cmsConfigured()) {
      state.loading = false;
      state.connected = false;
      state.error = 'CMS API is not configured yet. Edit config.js and set CMS_API_BASE to your Netlify CMS API URL.';
      render();
      return;
    }

    try {
      const [home, productsPayload] = await Promise.all([apiGet('home'), apiGet('products')]);
      state.settings = { ...fallbackSettings, ...(home.settings || {}) };
      state.categories = Array.isArray(home.categories) ? home.categories : [];
      state.products = arrayFromPayload(productsPayload, 'products');
      state.connected = true;
    } catch (error) {
      state.connected = false;
      state.error = error.message || 'Could not connect to CMS API.';
    }
    state.loading = false;
    render();
  }

  function slugify(value) {
    return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function getRoute() {
    const raw = (location.hash || '#home').replace(/^#\/?/, '');
    const [pathPart, queryPart = ''] = raw.split('?');
    const parts = pathPart.split('/').filter(Boolean);
    return { name: parts[0] || 'home', slug: parts[1] || '', params: new URLSearchParams(queryPart) };
  }

  function setTitle(title) {
    document.title = `${title} - ${siteName()}`;
  }

  function siteName() {
    return state.settings.site_name || fallbackSettings.site_name || 'SHREE';
  }

  function setting(key, fallback = '') {
    return state.settings?.[key] ?? fallbackSettings[key] ?? fallback;
  }

  function whatsappNumber() {
    return String(setting('whatsapp_number', cfg.WHATSAPP_NUMBER || '')).replace(/\D+/g, '') || '9779868800001';
  }

  function whatsappLink(message) {
    const text = message || setting('default_message', fallbackSettings.default_message);
    return `https://wa.me/${encodeURIComponent(whatsappNumber())}?text=${encodeURIComponent(text)}`;
  }

  function instagramUrl() {
    let url = String(setting('instagram_url', cfg.INSTAGRAM_URL || '') || '').trim();
    if (!url) return '';
    if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^\/+/, '')}`;
    return url;
  }

  function productImages(product) {
    const images = [];
    if (product?.image) images.push(product.image);
    (product?.gallery || []).forEach((image) => { if (image) images.push(image); });
    const seen = new Set();
    return images.map(String).map((s) => s.trim()).filter(Boolean).filter((src) => {
      if (seen.has(src)) return false;
      seen.add(src);
      return true;
    });
  }

  function imagePlaceholder(label = 'Upload image from CMS') {
    return `<div class="image-placeholder"><span>${esc(label)}</span></div>`;
  }

  function primaryImage(product) {
    return productImages(product)[0] || '';
  }

  function moneyDisplay(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const numeric = raw.replace(/[^0-9.]/g, '');
    if (numeric && !Number.isNaN(Number(numeric))) {
      const amount = Number(numeric);
      return new Intl.NumberFormat('en-IN', { maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
    }
    return raw;
  }

  function priceHtml(product, large = false) {
    if (product?.price === undefined || product?.price === null || String(product.price).trim() === '') return '';
    const compare = product.compare_price;
    return `<div class="${large ? 'product-price-large' : ''}"><span class="price">NPR ${esc(moneyDisplay(product.price))}${compare ? ` <del>NPR ${esc(moneyDisplay(compare))}</del>` : ''}</span></div>`;
  }

  function discountLabel(product) {
    const label = String(product?.discount_label || '').trim();
    if (label) return label;
    const percent = Number(product?.discount_percent || 0);
    if (percent > 0) return `${percent % 1 ? percent.toFixed(1) : percent}% OFF`;
    const price = Number(String(product?.price || '').replace(/[^0-9.]/g, ''));
    const compare = Number(String(product?.compare_price || '').replace(/[^0-9.]/g, ''));
    if (compare > price && compare > 0) return `${Math.round((1 - price / compare) * 100)}% OFF`;
    return '';
  }

  function colorHex(hex) {
    const value = String(hex || '').trim();
    return /^#[0-9a-f]{3,8}$/i.test(value) ? value : '#dddddd';
  }

  function categoryCount(slug) {
    return state.products.filter((product) => (product.category_slugs || []).includes(slug)).length;
  }

  function categoryCard(category) {
    const img = category.image ? `<img src="${esc(category.image)}" alt="${esc(category.name || 'Category')}" loading="lazy">` : imagePlaceholder('Upload category image from CMS');
    const count = category.count ?? categoryCount(category.slug);
    return `<a class="category-tile" href="#products?category=${encodeURIComponent(category.slug || '')}">${img}<span class="tile-label"><strong>${esc(category.name || 'Category')}</strong><small>${esc(count)} items</small></span></a>`;
  }

  function productCard(product) {
    const title = product.title || 'Product';
    const image = primaryImage(product);
    const discount = discountLabel(product);
    const sizes = Array.isArray(product.sizes) ? product.sizes.slice(0, 4) : [];
    const colors = Array.isArray(product.colors) ? product.colors.slice(0, 3) : [];
    const productMessage = `Hello, I want to inquire about ${title}.`;
    return `<article class="product-card">
      <a class="media" href="#product/${encodeURIComponent(product.slug || '')}">${image ? `<img src="${esc(image)}" alt="${esc(title)}" loading="lazy">` : imagePlaceholder('Upload product image from CMS')}</a>
      <div class="body">
        <div class="badges">
          ${discount ? `<span class="badge badge-sale">${esc(discount)}</span>` : ''}
          ${product.new_arrival ? '<span class="badge">New</span>' : ''}
          ${product.featured ? '<span class="badge">Featured</span>' : ''}
          ${product.stock_label ? `<span class="badge">${esc(product.stock_label)}</span>` : ''}
        </div>
        <h3><a href="#product/${encodeURIComponent(product.slug || '')}">${esc(title)}</a></h3>
        ${product.excerpt ? `<p>${esc(product.excerpt)}</p>` : ''}
        ${priceHtml(product)}
        ${(sizes.length || colors.length) ? `<div class="mini-options">${sizes.map((size) => `<span>${esc(size)}</span>`).join('')}${colors.map((color) => `<span>${esc(color.name || '')}</span>`).join('')}</div>` : ''}
        <div class="product-actions">
          <a class="btn btn-outline" href="#product/${encodeURIComponent(product.slug || '')}">View</a>
          <a class="btn btn-gold" href="#inquiry?product=${encodeURIComponent(product.slug || '')}">Inquiry</a>
          <a class="btn btn-whatsapp" href="${esc(whatsappLink(productMessage))}" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>
    </article>`;
  }

  function statusNotice() {
    if (state.loading) return '<div class="notice">Loading live CMS data...</div>';
    if (state.error) return `<div class="notice error"><strong>CMS connection notice:</strong> ${esc(state.error)}</div>`;
    return '';
  }

  function renderHome() {
    setTitle('Home');
    const settings = state.settings;
    const heroImage = settings.hero_image || '';
    const featured = state.products.filter((product) => product.featured).slice(0, 8);
    const newArrivals = state.products.filter((product) => product.new_arrival).slice(0, 8);
    $('#app').innerHTML = `
      <section class="hero ${heroImage ? '' : 'hero-no-image'}">
        ${heroImage ? `<img src="${esc(heroImage)}" alt="Boutique hero">` : ''}
        <div class="container hero-content">
          <span class="eyebrow">New Collection</span>
          <h1>${esc(settings.hero_title || fallbackSettings.hero_title)}</h1>
          <p>${esc(settings.hero_text || fallbackSettings.hero_text)}</p>
          <a class="btn btn-light" href="#categories">Browse Categories</a>
          <a class="btn btn-gold" href="#products">View Products</a>
        </div>
      </section>
      <section class="section"><div class="container">${statusNotice()}<div class="section-head"><span class="eyebrow">Categories</span><h2>Shop From Category</h2><p>Categories and images are loaded from the CMS.</p></div>${state.categories.length ? `<div class="grid grid-3">${state.categories.slice(0, 6).map(categoryCard).join('')}</div>` : '<div class="empty">No categories found. Add categories in the CMS and save changes.</div>'}</div></section>
      <section class="section section-soft"><div class="container"><div class="section-head"><span class="eyebrow">Featured</span><h2>Featured Products</h2><p>Product details, sizes, colours, discounts, and images come from the CMS.</p></div>${featured.length ? `<div class="grid grid-4">${featured.map(productCard).join('')}</div>` : '<div class="empty">No featured products yet. Mark products as Featured in CMS.</div>'}</div></section>
      <section class="section"><div class="container"><div class="section-head"><span class="eyebrow">New</span><h2>New Arrivals</h2></div>${newArrivals.length ? `<div class="grid grid-4">${newArrivals.map(productCard).join('')}</div>` : '<div class="empty">No new arrivals yet. Mark products as New arrival in CMS.</div>'}</div></section>`;
  }

  function renderCategories() {
    setTitle('Categories');
    $('#app').innerHTML = `<section class="page-hero"><div class="container page-title"><span class="eyebrow">Browse</span><h1>Product Categories</h1><p>Choose a category to see products inside it. Update categories and images from CMS.</p></div></section><section class="section"><div class="container">${statusNotice()}${state.categories.length ? `<div class="grid grid-3">${state.categories.map(categoryCard).join('')}</div>` : '<div class="empty">No categories found. Add categories in the CMS and save changes.</div>'}</div></section>`;
  }

  function renderProducts() {
    const route = getRoute();
    const selectedCategory = route.params.get('category') || '';
    const q = (route.params.get('q') || '').trim().toLowerCase();
    const selectedCategoryName = state.categories.find((cat) => cat.slug === selectedCategory)?.name || '';
    let products = state.products.slice();
    if (selectedCategory) products = products.filter((product) => (product.category_slugs || []).includes(slugify(selectedCategory)));
    if (q) products = products.filter((product) => [product.title, product.excerpt, product.content, product.sku, product.fabric].some((value) => String(value || '').toLowerCase().includes(q)));
    setTitle(selectedCategoryName || 'Products');
    $('#app').innerHTML = `<section class="page-hero"><div class="container page-title"><span class="eyebrow">Catalogue</span><h1>${esc(selectedCategoryName || 'All Products')}</h1><p>Multiple photos, sizes, colours, prices, and discount boxes are updated from CMS.</p></div></section><section class="section"><div class="container">${statusNotice()}<div class="filters"><a class="chip ${selectedCategory ? '' : 'active'}" href="#products">All</a>${state.categories.map((cat) => `<a class="chip ${selectedCategory === cat.slug ? 'active' : ''}" href="#products?category=${encodeURIComponent(cat.slug)}">${esc(cat.name)}</a>`).join('')}<input class="search-input" data-search-products placeholder="Search products" value="${esc(route.params.get('q') || '')}"></div>${products.length ? `<div class="grid grid-4">${products.map(productCard).join('')}</div>` : '<div class="empty">No products found. Add products in CMS, choose category, upload images, and save.</div>'}</div></section>`;
  }

  function findProduct(slug) {
    const clean = decodeURIComponent(slug || '');
    return state.products.find((product) => product.slug === clean) || null;
  }

  async function fetchProductIfNeeded(slug) {
    if (!cmsConfigured() || !slug || findProduct(slug)) return;
    try {
      const payload = await apiGet(`products/${encodeURIComponent(slug)}`);
      const product = payload.product || payload;
      if (product?.slug) state.products.push(product);
    } catch (error) {
      state.error = error.message || state.error;
    }
  }

  function renderProduct(product) {
    const title = product.title || 'Product';
    const images = productImages(product);
    const main = images[0] || '';
    const discount = discountLabel(product);
    const sizes = Array.isArray(product.sizes) ? product.sizes : [];
    const colors = Array.isArray(product.colors) ? product.colors : [];
    const categoryNames = (product.categories || []).map((cat) => cat.name).join(', ') || (product.category_slugs || []).join(', ');
    const message = `Hello, I want to inquire about ${title}.`;
    setTitle(title);
    $('#app').innerHTML = `<section class="page-hero"><div class="container page-title"><span class="eyebrow">Product Detail</span><h1>${esc(title)}</h1><p>${esc(product.excerpt || 'See images, sizes, colours, price, and inquiry options.')}</p></div></section><section class="section"><div class="container product-layout">
      <div class="product-gallery">
        <div class="gallery-main">${main ? `<img src="${esc(main)}" alt="${esc(title)}" data-gallery-main>` : imagePlaceholder('Upload product images from CMS')}</div>
        ${images.length > 1 ? `<div class="thumbs">${images.map((src) => `<button type="button" data-gallery-thumb="${esc(src)}"><img src="${esc(src)}" alt="${esc(title)}"></button>`).join('')}</div>` : ''}
      </div>
      <div class="product-summary">
        <div class="badges">${discount ? `<span class="badge badge-sale">${esc(discount)}</span>` : ''}${product.new_arrival ? '<span class="badge">New</span>' : ''}${product.featured ? '<span class="badge">Featured</span>' : ''}${product.stock_label ? `<span class="badge">${esc(product.stock_label)}</span>` : ''}</div>
        <h1>${esc(title)}</h1>
        ${priceHtml(product, true)}
        ${product.content ? `<p>${esc(product.content)}</p>` : ''}
        <div class="meta-list">
          ${categoryNames ? `<div class="meta-row"><strong>Category</strong><span>${esc(categoryNames)}</span></div>` : ''}
          ${product.sku ? `<div class="meta-row"><strong>SKU</strong><span>${esc(product.sku)}</span></div>` : ''}
          ${product.fabric ? `<div class="meta-row"><strong>Fabric</strong><span>${esc(product.fabric)}</span></div>` : ''}
          ${sizes.length ? `<div class="meta-row"><strong>Sizes</strong><span class="option-pills">${sizes.map((size) => `<span>${esc(size)}</span>`).join('')}</span></div>` : ''}
          ${colors.length ? `<div class="meta-row"><strong>Colours</strong><span class="option-pills">${colors.map((color) => `<span><i class="color-dot" style="background:${esc(colorHex(color.hex))}"></i>${esc(color.name || '')}</span>`).join('')}</span></div>` : ''}
        </div>
        <div class="product-actions product-actions-large"><a class="btn btn-gold" href="#inquiry?product=${encodeURIComponent(product.slug || '')}">Send Inquiry</a><a class="btn btn-whatsapp" href="${esc(whatsappLink(message))}" target="_blank" rel="noopener">WhatsApp Inquiry</a><a class="btn btn-outline" href="#products">Back to Products</a></div>
      </div>
    </div></section>`;
  }

  async function renderProductRoute(slug) {
    await fetchProductIfNeeded(slug);
    const product = findProduct(slug);
    if (!product) {
      setTitle('Product Not Found');
      $('#app').innerHTML = `<section class="page-hero"><div class="container page-title"><span class="eyebrow">Not Found</span><h1>Product not found</h1><p>This product may be hidden or not yet saved in CMS.</p></div></section><section class="section"><div class="container">${statusNotice()}<a class="btn btn-gold" href="#products">View Products</a></div></section>`;
      return;
    }
    renderProduct(product);
  }

  function inquiryProductFromRoute() {
    const slug = getRoute().params.get('product') || '';
    return slug ? findProduct(slug) : null;
  }

  function optionSelect(name, options, placeholder) {
    if (!options || !options.length) return '';
    return `<label>${esc(placeholder)}<select name="${esc(name)}"><option value="">Select ${esc(placeholder.toLowerCase())}</option>${options.map((item) => `<option value="${esc(item.name || item)}">${esc(item.name || item)}</option>`).join('')}</select></label>`;
  }

  function renderInquiry() {
    const product = inquiryProductFromRoute();
    const title = product?.title || '';
    const image = product ? primaryImage(product) : '';
    setTitle('Inquiry');
    $('#app').innerHTML = `<section class="page-hero"><div class="container page-title"><span class="eyebrow">Inquiry</span><h1>Send Product Inquiry</h1><p>Your inquiry is saved in CMS and can also be sent through WhatsApp.</p></div></section><section class="section"><div class="container grid grid-2">${statusNotice()}<div class="form-card"><div id="formNotice" hidden></div><form class="form-grid" data-inquiry-form><input type="hidden" name="product_slug" value="${esc(product?.slug || '')}"><input type="hidden" name="product_title" value="${esc(title)}"><label>Your name<input name="name" required placeholder="Full name"></label><label>Phone / WhatsApp<input name="phone" required placeholder="98XXXXXXXX"></label><label>Email optional<input name="email" type="email" placeholder="you@example.com"></label>${optionSelect('size', product?.sizes || [], 'Size')}${optionSelect('color', product?.colors || [], 'Colour')}<label class="full">Message<textarea name="message" required>${esc(title ? `Hello, I want to inquire about ${title}.` : setting('default_message', fallbackSettings.default_message))}</textarea></label><button class="btn btn-gold" type="submit">Submit Inquiry to CMS</button><a class="btn btn-whatsapp" href="${esc(whatsappLink(title ? `Hello, I want to inquire about ${title}.` : undefined))}" target="_blank" rel="noopener">Send on WhatsApp</a></form></div><aside class="info-card inquiry-side"><h2>${esc(title || 'General Inquiry')}</h2>${image ? `<img src="${esc(image)}" alt="${esc(title)}">` : imagePlaceholder(product ? 'Upload product image from CMS' : 'Select a product for image preview')}<p>${esc(product?.excerpt || 'Choose a product and send size or colour preference. Inquiries are stored inside the CMS Inquiries tab.')}</p><div class="social-actions"><a class="btn btn-whatsapp" href="${esc(whatsappLink())}" target="_blank" rel="noopener">WhatsApp</a>${instagramUrl() ? `<a class="btn btn-outline" href="${esc(instagramUrl())}" target="_blank" rel="noopener">Instagram</a>` : ''}</div></aside></div></section>`;
  }

  function renderContact() {
    setTitle('Contact');
    $('#app').innerHTML = `<section class="page-hero"><div class="container page-title"><span class="eyebrow">Contact</span><h1>${esc(setting('contact_heading', 'Contact SHREE'))}</h1><p>${esc(setting('contact_text', 'Use the inquiry form, Instagram, or WhatsApp for direct messages.'))}</p></div></section><section class="section"><div class="container grid grid-3">${statusNotice()}<div class="info-card contact-card"><h2>Direct WhatsApp</h2><p>Customers can press the WhatsApp button and send a pre-filled message to your number.</p><a class="btn btn-whatsapp" target="_blank" rel="noopener" href="${esc(whatsappLink())}">Message on WhatsApp</a></div><div class="info-card contact-card"><h2>Product Inquiry</h2><p>Open a product and press Send Inquiry, or use the general inquiry form.</p><a class="btn btn-gold" href="#inquiry">Send Inquiry</a></div><div class="info-card contact-card"><h2>Instagram</h2><p>${instagramUrl() ? 'Connect with the boutique on Instagram.' : 'Add your Instagram URL in CMS Settings to show it here.'}</p>${instagramUrl() ? `<a class="btn btn-outline" href="${esc(instagramUrl())}" target="_blank" rel="noopener">Open Instagram</a>` : ''}</div></div></section>`;
  }

  function applyGlobalSettings() {
    const settings = state.settings;
    $$('[data-site-name]').forEach((el) => { el.textContent = siteName(); });
    const topbar = $('#topbar');
    if (topbar) topbar.textContent = settings.topbar_text || fallbackSettings.topbar_text;
    const footerText = $('[data-footer-text]');
    if (footerText) footerText.textContent = settings.hero_text || 'Products and images are managed from the CMS.';
    const footerWhatsapp = $('[data-footer-whatsapp]');
    if (footerWhatsapp) footerWhatsapp.textContent = `WhatsApp: +${whatsappNumber()}`;
    const wa = whatsappLink();
    $$('[data-whatsapp-nav],[data-whatsapp-float]').forEach((el) => { el.href = wa; });
    const ig = instagramUrl();
    $$('[data-instagram-nav],[data-instagram-footer]').forEach((el) => {
      el.hidden = !ig;
      if (ig) el.href = ig;
    });
    const fonts = settings.fonts || fallbackSettings.fonts;
    document.body.style.fontFamily = fonts.body || fallbackSettings.fonts.body;
    document.body.style.fontSize = fonts.body_size || fallbackSettings.fonts.body_size;
    document.documentElement.style.setProperty('--cms-heading-font', fonts.heading || fallbackSettings.fonts.heading);
    $('#year').textContent = new Date().getFullYear();
  }

  async function render() {
    applyGlobalSettings();
    const route = getRoute();
    if (route.name === 'categories') return renderCategories();
    if (route.name === 'products') return renderProducts();
    if (route.name === 'product') return renderProductRoute(route.slug);
    if (route.name === 'inquiry') return renderInquiry();
    if (route.name === 'contact') return renderContact();
    return renderHome();
  }

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-menu-toggle]');
    if (toggle) $('[data-menu]')?.classList.toggle('open');
    const thumb = event.target.closest('[data-gallery-thumb]');
    if (thumb) {
      const main = $('[data-gallery-main]');
      const src = thumb.getAttribute('data-gallery-thumb');
      if (main && src) main.setAttribute('src', src);
    }
  });

  document.addEventListener('input', (event) => {
    const input = event.target.closest('[data-search-products]');
    if (!input) return;
    clearTimeout(input._timer);
    input._timer = setTimeout(() => {
      const route = getRoute();
      const params = new URLSearchParams(route.params.toString());
      const value = input.value.trim();
      if (value) params.set('q', value); else params.delete('q');
      location.hash = `products${params.toString() ? `?${params.toString()}` : ''}`;
    }, 350);
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('[data-inquiry-form]');
    if (!form) return;
    event.preventDefault();
    const notice = $('#formNotice');
    const data = Object.fromEntries(new FormData(form).entries());
    data.source = 'github-pages-website';
    if (notice) {
      notice.hidden = false;
      notice.className = 'notice';
      notice.textContent = 'Submitting inquiry to CMS...';
    }
    try {
      if (!cmsConfigured()) throw new Error('CMS API is not configured. Use WhatsApp or update config.js first.');
      await apiPost('inquiries', data);
      if (notice) notice.textContent = 'Inquiry saved in CMS successfully.';
      form.reset();
    } catch (error) {
      if (notice) {
        notice.className = 'notice error';
        notice.textContent = error.message || 'Inquiry could not be saved. Please use WhatsApp.';
      }
    }
  });

  window.addEventListener('hashchange', () => render());
  loadCms();
})();
