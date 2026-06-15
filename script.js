/* ============================================================
   ChopChop — main script
   Handles: custom cursor, sticky nav, scroll reveals,
   and the live YouTube data integration (featured video +
   latest episodes grid).
   Loaded at the end of <body>, so the DOM is ready.
   ============================================================ */

  // Custom cursor
  const cursor = document.getElementById('cursor');
  const ring = document.getElementById('cursor-ring');
  let mx = 0, my = 0, rx = 0, ry = 0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cursor.style.left = mx + 'px';
    cursor.style.top = my + 'px';
  });
  function animRing() {
    rx += (mx - rx) * 0.12;
    ry += (my - ry) * 0.12;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
    requestAnimationFrame(animRing);
  }
  animRing();
  document.querySelectorAll('a, button, .video-card, .cat-card').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(2)';
      ring.style.transform = 'translate(-50%, -50%) scale(1.5)';
      ring.style.opacity = '0.4';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      ring.style.transform = 'translate(-50%, -50%) scale(1)';
      ring.style.opacity = '1';
    });
  });

  // Sticky nav
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 80);
  });

  // Scroll reveal
  const reveals = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(el => io.observe(el));

  /*// Newsletter form
  document.querySelector('.newsletter-form button').addEventListener('click', function() {
    const input = document.querySelector('.newsletter-form input');
    if (input.value && input.value.includes('@')) {
      this.textContent = 'Subscribed ✓';
      this.style.background = '#2a6e3a';
      this.style.borderColor = '#2a6e3a';
      this.style.color = '#fff';
      input.value = '';
    }
  });*/


  // ─── YouTube API Integration ───────────────────────────────────────────

  const YT_API_KEY    = 'AIzaSyC3Fn5xWiuq4AZeYokBpB70dAhtaXCj_GI';
  const YT_CHANNEL_ID = 'UCRcTuk13dASkymAkdp1Fttw';

  // ── Fetch latest videos for the grid ──────────────────────────────────
  async function loadLatestVideos() {
    const url = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&channelId=${YT_CHANNEL_ID}&maxResults=3` +
            `&order=date&type=video&key=${YT_API_KEY}`;

    try {
      const res  = await fetch(url);
      const data = await res.json();
      if (data.error) {
        console.error('YouTube grid error:', data.error.message || data.error);
        return;
      }
      if (!data.items?.length) return;

      // Also fetch statistics (view counts) in one batch call
      const ids      = data.items.map(i => i.id.videoId).join(',');
      const statsUrl = `https://www.googleapis.com/youtube/v3/videos?` +
              `part=statistics,contentDetails&id=${ids}&key=${YT_API_KEY}`;
      const statsRes  = await fetch(statsUrl);
      const statsData = await statsRes.json();

      const statsMap = {};
      (statsData.items || []).forEach(v => { statsMap[v.id] = v; });

      renderVideoGrid(data.items, statsMap);
    } catch (err) {
      console.error('YouTube grid error:', err);
    }
  }

  function formatViews(n) {
    n = parseInt(n, 10);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M views';
    if (n >= 1_000)     return (n / 1_000).toFixed(0)     + 'K views';
    return n + ' views';
  }

  function formatDuration(iso) {
    // ISO 8601 → "32 min"
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const h  = parseInt(m[1] || 0);
    const mn = parseInt(m[2] || 0);
    const s  = parseInt(m[3] || 0);
    if (h)  return `${h}h ${mn}m`;
    if (mn) return `${mn + (s >= 30 ? 1 : 0)} min`;
    return `${s}s`;
  }

  function renderVideoGrid(items, statsMap) {
    const grid = document.querySelector('.video-grid');
    grid.innerHTML = '';

    items.forEach((item, i) => {
      const vid      = item.id.videoId;
    const snippet  = item.snippet;
    const stats    = statsMap[vid]?.statistics   || {};
    const details  = statsMap[vid]?.contentDetails || {};
    const thumb    = snippet.thumbnails?.maxres?.url
    || snippet.thumbnails?.high?.url
    || snippet.thumbnails?.medium?.url
    || snippet.thumbnails?.default?.url
    || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
    const views    = formatViews(stats.viewCount || 0);
    const duration = details.duration ? formatDuration(details.duration) : '';
    // Use channel title as a "category" label
    const category = snippet.channelTitle || 'ChopChop';
    const delay    = (i * 0.1).toFixed(1);

    const card = document.createElement('div');
    card.className = 'video-card reveal';
    card.style.transitionDelay = `${delay}s`;
    card.innerHTML = `
      <div class="video-card-thumb">
        <img src="${thumb}" alt="${snippet.title}" loading="lazy">
        <div class="thumb-overlay"></div>
        <div class="card-category">${category}</div>
        ${duration ? `<div class="card-duration">${duration}</div>` : ''}
      </div>
      <div class="video-card-title">${snippet.title}</div>
      <div class="video-card-meta">
        <span>${new Date(snippet.publishedAt).toLocaleDateString('en-US',{month:'short',year:'numeric'})}</span>
        <span>${views}</span>
      </div>
    `;
    card.addEventListener('click', () => {
      window.open(`https://www.youtube.com/watch?v=${vid}`, '_blank');
  });
    grid.appendChild(card);
  });

    // Re-run scroll reveal on new cards
    document.querySelectorAll('.video-card.reveal').forEach(el => io.observe(el));
  }

  // ── Fetch featured (most popular) video ───────────────────────────────
  async function loadFeaturedVideo() {
    const url = `https://www.googleapis.com/youtube/v3/search?` +
            `part=snippet&channelId=${YT_CHANNEL_ID}&maxResults=1` +
            `&order=viewCount&type=video&key=${YT_API_KEY}`;

    try {
      const res  = await fetch(url);
      const data = await res.json();
      if (data.error) {
        console.error('YouTube featured error:', data.error.message || data.error);
        return;
      }
      if (!data.items?.length) return;

      const item    = data.items[0];
      const vid     = item.id.videoId;
      const snippet = item.snippet;

      // Fetch duration
      const detailRes  = await fetch(
              `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${vid}&key=${YT_API_KEY}`
      );
      const detailData = await detailRes.json();
      const details    = detailData.items?.[0]?.contentDetails || {};
      const stats      = detailData.items?.[0]?.statistics     || {};
      const duration   = details.duration ? formatDuration(details.duration) : '';
      const views      = formatViews(stats.viewCount || 0);

      // Update featured section
      const featImg = document.querySelector('.featured-video img');
      if (featImg) {
        featImg.src = snippet.thumbnails?.maxres?.url
        || snippet.thumbnails?.high?.url
        || snippet.thumbnails?.medium?.url
        || snippet.thumbnails?.default?.url
        || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
        featImg.alt = snippet.title;
      }

      const featTitle = document.querySelector('.featured-content .section-title');
      if (featTitle) {
        // Split title roughly in half for the two-line display
        const words = snippet.title.split(' ');
        const mid   = Math.ceil(words.length / 2);
        featTitle.innerHTML = `${words.slice(0, mid).join(' ')}<br><em>${words.slice(mid).join(' ')}</em>`;
      }

      const featDesc = document.querySelector('.featured-content p[style]');
      if (featDesc) featDesc.textContent = snippet.description.slice(0, 220) + '…';

      const featMeta = document.querySelector('.video-meta');
      if (featMeta) {
        featMeta.innerHTML = `
        <span>${new Date(snippet.publishedAt).toLocaleDateString('en-US',{month:'long',year:'numeric'})}</span>
        <span style="color:var(--muted)">·</span>
        <span style="color:var(--muted)">${duration}</span>
        <span style="color:var(--muted)">·</span>
        <span style="color:var(--muted)">${views}</span>
      `;
      }

      const watchBtn = document.querySelector('.featured-content .btn-primary');
      if (watchBtn) {
        watchBtn.href   = `https://www.youtube.com/watch?v=${vid}`;
        watchBtn.target = '_blank';
      }

      const featuredVideo = document.querySelector('.featured-video');
      if (featuredVideo) {
        featuredVideo.style.cursor = 'pointer';
        /*featuredVideo.addEventListener('click', () => {
          window.open(`https://www.youtube.com/watch?v=${vid}`, '_blank');
      });*/

        featuredVideo.addEventListener('click', () => {
          featuredVideo.innerHTML = `
    <iframe
      width="100%"
      height="100%"
      src="https://www.youtube.com/embed/${vid}?autoplay=1"
      title="${snippet.title}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen>
    </iframe>
  `;
      });
      }

    } catch (err) {
      console.error('YouTube featured error:', err);
    }
  }

  // ── Kick off both calls ────────────────────────────────────────────────
  loadFeaturedVideo();
  loadLatestVideos();

