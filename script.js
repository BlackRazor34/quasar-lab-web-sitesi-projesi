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
    if (document.getElementById('arxiv-container')) {
        fetchArxiv();
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


// --- arXiv API Entegrasyonu (blog.html için) ---
async function fetchArxiv() {
    const container = document.getElementById('arxiv-container');
    const loadingEl = document.getElementById('arxiv-loading');
    const listEl = document.getElementById('arxiv-list');
    if (!container) return;

    const searchQuery = 'cat:cs.AI+OR+cat:stat.ML'; // Yapay Zeka VEYA Makine Öğrenmesi
    const maxResults = 5;
    // arXiv API'si CORS desteklemediği için bir proxy gerekli olabilir.
    // Şimdilik doğrudan deniyoruz, çalışmazsa proxy ekleriz.
    const url = `https://export.arxiv.org/api/query?search_query=${searchQuery}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`arXiv API isteği başarısız: ${response.status}`);
        const xmlText = await response.text();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");
        const entries = Array.from(xmlDoc.getElementsByTagName('entry'));

        if (loadingEl) loadingEl.remove();

        if (entries.length === 0) {
            listEl.textContent = 'İlgili makale bulunamadı.';
            return;
        }

        entries.forEach(entry => {
            const title = entry.querySelector('title').textContent.trim();
            const author = entry.querySelector('author name').textContent.trim();
            const link = entry.querySelector('link[rel="alternate"]').getAttribute('href');
            const summary = entry.querySelector('summary').textContent.trim();

            const articleEl = document.createElement('div');
            articleEl.className = 'api-list-item';
            articleEl.innerHTML = `
                <h4><a href="${link}" target="_blank">${title}</a></h4>
                <p class="api-item-meta"><strong>Yazar:</strong> ${author}</p>
                <p>${summary.substring(0, 250)}...</p>
            `;
            listEl.appendChild(articleEl);
        });

    } catch (error) {
        console.error('arXiv hatası:', error);
        if (loadingEl) loadingEl.textContent = 'Makaleler yüklenirken bir hata oluştu.';
    }
}


// --- PubMed API Entegrasyonu (blog.html için) ---
async function fetchPubMed() {
    const container = document.getElementById('pubmed-container');
    const loadingEl = document.getElementById('pubmed-loading');
    const listEl = document.getElementById('pubmed-list');
    if (!container) return;

    const searchTerm = '("CRISPR"[Title/Abstract] OR "bioinformatics"[Title/Abstract]) AND "data analysis"[Title/Abstract]';
    const maxResults = 5;
    const eutils = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
    // Not: NCBI, yoğun kullanım için bir API anahtarı talep edebilir.
    const searchUrl = `${eutils}esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=${maxResults}&sort=pub_date&usehistory=y`;

    try {
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) throw new Error(`PubMed arama isteği başarısız: ${searchResponse.status}`);
        const searchXmlText = await searchResponse.text();
        
        const parser = new DOMParser();
        const searchXmlDoc = parser.parseFromString(searchXmlText, "text/xml");
        const idList = Array.from(searchXmlDoc.getElementsByTagName('Id')).map(id => id.textContent);

        if (idList.length === 0) {
            if (loadingEl) loadingEl.remove();
            listEl.textContent = 'İlgili makale bulunamadı.';
            return;
        }

        const summaryUrl = `${eutils}esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
        const summaryResponse = await fetch(summaryUrl);
        if (!summaryResponse.ok) throw new Error(`PubMed özet isteği başarısız: ${summaryResponse.status}`);
        const summaryData = await summaryResponse.json();

        if (loadingEl) loadingEl.remove();

        const result = summaryData.result;
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
                <h4><a href="${articleUrl}" target="_blank">${title}</a></h4>
                <p class="api-item-meta"><strong>Yazarlar:</strong> ${authors}</p>
                <p class="api-item-meta"><strong>Dergi:</strong> ${journal} | <strong>Tarih:</strong> ${pubDate}</p>
            `;
            listEl.appendChild(articleEl);
        }

    } catch (error) {
        console.error('PubMed hatası:', error);
        if (loadingEl) loadingEl.textContent = 'Makaleler yüklenirken bir hata oluştu.';
    }
}
