// --- Tema Değiştirici ve Genel Başlatma ---
document.addEventListener('DOMContentLoaded', function() {
    // Sayfa yüklenirken temayı uygula
    const theme = localStorage.getItem('theme') || 'dark-theme';
    document.documentElement.className = theme;

    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = document.documentElement.className;
            const newTheme = currentTheme === 'dark-theme' ? 'light-theme' : 'dark-theme';
            document.documentElement.className = newTheme;
            localStorage.setItem('theme', newTheme);
        });
    }

    

    // Hangi sayfada olduğumuzu kontrol edip ilgili API fonksiyonlarını çağır
    if (document.getElementById('apod-container')) {
        fetchAPOD();
    }
    if (document.getElementById('ai-arxiv-container')) {
        fetchArxiv('cs.AI', 'ai-arxiv-list', 'ai-arxiv-loading');
    }
    if (document.getElementById('ml-arxiv-container')) {
        fetchArxiv('stat.ML', 'ml-arxiv-list', 'ml-arxiv-loading');
    }
    if (document.getElementById('math-arxiv-container')) {
        fetchArxiv('math.GM', 'math-arxiv-list', 'math-arxiv-loading');
    }
    if (document.getElementById('data-arxiv-container')) {
        fetchArxiv('cs.DB', 'data-arxiv-list', 'data-arxiv-loading');
    }
    if (document.getElementById('quantum-arxiv-container')) {
        fetchArxiv('quant-ph', 'quantum-arxiv-list', 'quantum-arxiv-loading');
    }
    if (document.getElementById('pubmed-container')) {
        fetchPubMed();
    }
});


// --- NASA APOD API Entegrasyonu (index.html için) ---
async function fetchAPOD() {
    const apodContainer = document.getElementById('apod-container');
    const loadingEl = document.getElementById('apod-loading');
    const NASA_API_KEY = 'DEMO_KEY'; // Güvenlik için demo anahtarı kullanılıyor

    try {
        const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`);
        if (!response.ok) throw new Error(`NASA API isteği başarısız: ${response.status}`);
        const data = await response.json();

        if (loadingEl) loadingEl.remove();

        const title = document.createElement('h3');
        title.textContent = data.title;

        let mediaElement;
        if (data.media_type === 'image') {
            mediaElement = document.createElement('img');
            mediaElement.src = data.hdurl || data.url;
            mediaElement.alt = data.title;
            mediaElement.className = 'content-image';
        } else if (data.media_type === 'video') {
            mediaElement = document.createElement('iframe');
            mediaElement.src = data.url;
            mediaElement.width = '100%';
            mediaElement.height = '450';
            mediaElement.allowFullscreen = true;
            mediaElement.className = 'content-video';
        }

        const explanation = document.createElement('p');
        explanation.textContent = data.explanation;

        apodContainer.append(title, mediaElement, explanation);

    } catch (error) {
        console.error('NASA APOD hatası:', error);
        if (loadingEl) loadingEl.textContent = 'Günün fotoğrafı yüklenemedi.';
    }
}


// --- Genel arXiv API Entegrasyonu ---
async function fetchArxiv(category, listId, loadingId) {
    const loadingEl = document.getElementById(loadingId);
    const listEl = document.getElementById(listId);
    if (!listEl) return;

    // arXiv API'sine doğrudan istek yapılıyor
    const url = `https://export.arxiv.org/api/query?search_query=cat:${category}&start=0&max_results=10&sortBy=submittedDate&sortOrder=descending`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`arXiv API hatası: ${response.status}`);
        const xmlText = await response.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const entries = Array.from(xmlDoc.getElementsByTagName('entry'));

        if (loadingEl) loadingEl.remove();

        if (entries.length === 0 || xmlDoc.querySelector('parsererror')) {
            listEl.textContent = 'Bu kategoride güncel makale bulunamadı veya API yanıtı hatalı.';
            console.error("Parser Error:", xmlDoc.querySelector('parsererror')?.textContent);
            return;
        }

        entries.forEach(entry => {
            const title = entry.querySelector('title').textContent.trim();
            const authors = Array.from(entry.querySelectorAll('author name')).map(el => el.textContent.trim()).join(', ');
            const link = entry.querySelector('link[rel="alternate"]').getAttribute('href');
            const summary = entry.querySelector('summary').textContent.trim();
            const published = new Date(entry.querySelector('published').textContent).toLocaleDateString('tr-TR');

            const articleEl = document.createElement('div');
            articleEl.className = 'api-list-item';
            articleEl.innerHTML = `
                <h4><a href="${link}" target="_blank" rel="noopener noreferrer">${title}</a></h4>
                <p class="api-item-meta"><strong>Yazarlar:</strong> ${authors}</p>
                <p class="api-item-meta"><strong>Yayınlanma Tarihi:</strong> ${published}</p>
                <p>${summary.substring(0, 300)}...</p>
            `;
            listEl.appendChild(articleEl);
        });

    } catch (error) {
        console.error('arXiv hatası:', error);
        if (loadingEl) loadingEl.textContent = 'Makaleler yüklenirken bir hata oluştu. Lütfen tarayıcı konsolunu kontrol edin.';
    }
}


// --- PubMed API Entegrasyonu (health_blog.html için) ---
async function fetchPubMed() {
    const loadingEl = document.getElementById('pubmed-loading');
    const listEl = document.getElementById('pubmed-list');
    if (!listEl) return;

    // PubMed API'sine doğrudan istek yapılıyor
    const searchTerm = "((crispr[Title/Abstract]) OR (bioinformatics[Title/Abstract]) OR (genomics[Title/Abstract])) AND (hasabstract[text])";
    const eutilsBase = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
    const searchUrl = `${eutilsBase}esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=10&sort=pub_date&usehistory=y&retmode=json`;

    try {
        // 1. Adım: Makale ID'lerini ara
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error(`PubMed ESearch isteği başarısız: ${searchResponse.status}`);
        const searchData = await searchResponse.json();
        const idList = searchData.esearchresult.idlist;

        if (!idList || idList.length === 0) {
            if (loadingEl) loadingEl.remove();
            listEl.textContent = 'İlgili konuda güncel makale bulunamadı.';
            return;
        }

        // 2. Adım: ID'leri kullanarak makale özetlerini al
        const summaryUrl = `${eutilsBase}esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
        const summaryResponse = await fetch(summaryUrl);
        if (!summaryResponse.ok) throw new Error(`PubMed ESummary isteği başarısız: ${summaryResponse.status}`);
        const summaryData = await summaryResponse.json();

        if (loadingEl) loadingEl.remove();

        const result = summaryData.result;
        if (!result || Object.keys(result).length <= 1) { // uids'den başka bir şey yoksa
             listEl.textContent = 'Makale detayları alınamadı.';
             return;
        }

        for (const uid in result) {
            if (uid === "uids") continue;

            const article = result[uid];
            const title = article.title;
            const authors = article.authors.map(a => a.name).join(', ');
            const journal = article.fulljournalname;
            const pubDate = article.pubdate;
            const articleUrl = `https://pubmed.ncbi.nlm.nih.gov/${uid}/`;

            const articleEl = document.createElement('div');
            articleEl.className = 'api-list-item';
            articleEl.innerHTML = `
                <h4><a href="${articleUrl}" target="_blank" rel="noopener noreferrer">${title}</a></h4>
                <p class="api-item-meta"><strong>Yazarlar:</strong> ${authors}</p>
                <p class="api-item-meta"><strong>Dergi:</strong> ${journal} | <strong>Tarih:</strong> ${pubDate}</p>
            `;
            listEl.appendChild(articleEl);
        }

    } catch (error) {
        console.error('PubMed hatası:', error);
        if (loadingEl) loadingEl.textContent = 'Makaleler yüklenirken bir hata oluştu. Lütfen tarayıcı konsolunu kontrol edin.';
    }
}


// --- İletişim Formu Gönderimi (contact.html için) ---
const contactForm = document.getElementById('contact-form');
if (contactForm) {
    contactForm.addEventListener('submit', function(event) {
        event.preventDefault();
        const statusEl = document.getElementById('form-status');
        
        const formData = new FormData(contactForm);
        const name = formData.get('name');
        const email = formData.get('email');
        const message = formData.get('message');

        if (!name || !email || !message) {
            statusEl.textContent = 'Lütfen tüm alanları doldurun.';
            statusEl.style.color = 'red';
            return;
        }

        console.log('Form gönderildi:', { name, email, message });
        
        statusEl.textContent = 'Mesajınız için teşekkürler! En kısa sürede geri döneceğim.';
        statusEl.style.color = 'green';
        contactForm.reset();
    });
}
