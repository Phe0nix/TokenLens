(() => {
  const nodes = Array.from(document.querySelectorAll('.reveal'));
  if (!nodes.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('on');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.14 });

  nodes.forEach((node, idx) => {
    node.style.transitionDelay = `${Math.min(idx * 38, 220)}ms`;
    io.observe(node);
  });

  const links = Array.from(document.querySelectorAll('a[href^="#"]'));
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  const billingButtons = Array.from(document.querySelectorAll('.billing-btn'));
  const proPriceNode = document.querySelector('[data-price-pro]');
  const proCycleNode = document.querySelector('[data-cycle-pro]');
  const proNoteNode = document.querySelector('[data-price-pro-note]');
  const proCard = document.querySelector('.price-card.featured');
  const docsNavLinks = Array.from(document.querySelectorAll('.docs-nav-link'));

  function setupDocsSectionHighlighting() {
    if (!docsNavLinks.length) return;
    const map = new Map();
    docsNavLinks.forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#')) return;
      const id = href.slice(1);
      if (!id) return;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(link);
    });

    const sectionIds = Array.from(map.keys());
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!sections.length) return;

    const setActive = (id) => {
      docsNavLinks.forEach((link) => link.classList.remove('is-active'));
      const matchedLinks = map.get(id) || [];
      matchedLinks.forEach((link) => link.classList.add('is-active'));
    };

    const ioSections = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible || !visible.target || !visible.target.id) return;
      setActive(visible.target.id);
    }, { threshold: [0.22, 0.4, 0.6], rootMargin: '-20% 0px -58% 0px' });

    sections.forEach((section) => ioSections.observe(section));

    const initial = sectionIds.find((id) => document.getElementById(id)) || sectionIds[0];
    if (initial) setActive(initial);
  }

  function applyBillingMode(mode) {
    const annual = mode === 'annual';
    if (proPriceNode) proPriceNode.textContent = annual ? '$50' : '$4.99';
    if (proCycleNode) proCycleNode.textContent = annual ? '/ year' : '/ month';
    if (proCard) proCard.classList.toggle('is-annual', annual);
    if (proNoteNode) {
      proNoteNode.textContent = annual
        ? 'Best for solo designers and developers shipping regularly. Equivalent to $4.17/month, billed yearly (save 16%).'
        : 'Best for solo designers and developers shipping regularly. Billed monthly.';
    }
  }

  billingButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.billing === 'annual' ? 'annual' : 'monthly';
      billingButtons.forEach((node) => {
        const active = node === btn;
        node.classList.toggle('active', active);
        node.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      applyBillingMode(mode);
    });
  });

  applyBillingMode('monthly');
  setupDocsSectionHighlighting();
})();
