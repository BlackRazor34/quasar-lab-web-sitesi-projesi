const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 3000;

// Statik dosyaları (HTML, CSS, JS, images) sunmak için
app.use(express.static(path.join(__dirname, '/')));

// arXiv API için proxy endpoint'i
app.get('/api/arxiv', async (req, res) => {
    const { category } = req.query;
    if (!category) {
        return res.status(400).json({ error: 'Kategori belirtilmedi.' });
    }

    const searchQuery = `cat:${category}`;
    const maxResults = 10;
    const url = `http://export.arxiv.org/api/query?search_query=${searchQuery}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`;

    try {
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' } // Bazı API'ler user-agent bekler
        });
        res.header('Content-Type', 'application/xml');
        res.send(response.data);
    } catch (error) {
        console.error('arXiv API Hatası:', error.message);
        res.status(500).json({ error: 'arXiv API\'sinden veri alınamadı.' });
    }
});

// PubMed API için proxy endpoint'i
app.get('/api/pubmed', async (req, res) => {
    const searchTerm = '("CRISPR"[Title/Abstract] OR "bioinformatics"[Title/Abstract]) AND "data analysis"[Title/Abstract]';
    const maxResults = 10;
    const eutils = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/';
    
    try {
        // 1. Adım: Makale ID'lerini ara
        const searchUrl = `${eutils}esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=${maxResults}&sort=pub_date&usehistory=y`;
        const searchResponse = await axios.get(searchUrl);
        
        const parser = require('xml2js');
        const searchResult = await parser.parseStringPromise(searchResponse.data);
        const idList = searchResult.eSearchResult.IdList[0].Id;

        if (!idList || idList.length === 0) {
            return res.json({ result: {} });
        }

        // 2. Adım: ID'lere göre özetleri al
        const summaryUrl = `${eutils}esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`;
        const summaryResponse = await axios.get(summaryUrl);
        
        res.json(summaryResponse.data);

    } catch (error) {
        console.error('PubMed API Hatası:', error.message);
        res.status(500).json({ error: 'PubMed API\'sinden veri alınamadı.' });
    }
});

// Ana sayfa için yönlendirme
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor.`);
    console.log('Siteyi görüntülemek için bu adresi tarayıcınızda açın.');
    console.log('Sunucuyu durdurmak için terminalde CTRL+C yapın.');
});