const fs = require('fs');
const envContent = fs.readFileSync(require('path').resolve(__dirname, '.env'), 'utf8');
const API_KEY = envContent.match(/CH_API_KEY=(.+)/)[1].trim();

const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.static('.'));

const BASE_URL = 'api.company-information.service.gov.uk';

function callAPI(path) {
    return new Promise((resolve, reject) => {
        const auth = Buffer.from(API_KEY + ':').toString('base64');
        const options = {
            hostname: BASE_URL,
            path: path,
            method: 'GET',
            headers: { 'Authorization': 'Basic ' + auth }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.end();
    });
}

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    try {
        const data = await callAPI(`/search/companies?q=${encodeURIComponent(query)}&items_per_page=5`);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'API call failed' });
    }
});

app.get('/api/psc/:companyNumber', async (req, res) => {
    const { companyNumber } = req.params;
    try {
        const data = await callAPI(`/company/${companyNumber}/persons-with-significant-control`);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'API call failed' });
    }
});

app.get('/api/search-by-name', async (req, res) => {
    const query = req.query.q;
    try {
        const searchData = await callAPI(`/search/companies?q=${encodeURIComponent(query)}&items_per_page=3`);
        if (!searchData.items || searchData.items.length === 0) {
            return res.json({ found: false });
        }
        const company = searchData.items[0];
        const pscData = await callAPI(`/company/${company.company_number}/persons-with-significant-control`);
        res.json({
            found: true,
            company_name: company.title,
            company_number: company.company_number,
            pscs: pscData.items || []
        });
    } catch (error) {
        res.status(500).json({ error: 'API call failed' });
    }
});

app.get('/api/trace-full/:companyNumber', async (req, res) => {
    const { companyNumber } = req.params;
    const nodes = [];
    const links = [];
    const visited = new Set();

    async function trace(companyId, companyName, depth) {
        if (depth > 4 || visited.has(companyId)) return;
        visited.add(companyId);

        if (!nodes.find(n => n.id === companyId)) {
            nodes.push({
                id: companyId,
                label: companyName,
                type: depth === 0 ? 'target' : 'corporate'
            });
        }

        try {
            const data = await callAPI(`/company/${companyId}/persons-with-significant-control`);
            if (!data.items) return;
// Remove duplicate PSCs by normalised name
const seen = new Set();
const uniqueItems = data.items.filter(psc => {
    const key = psc.name.toLowerCase().trim().replace(/\./g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
});
for (const psc of uniqueItems) {
                const isPerson = psc.kind === 'individual-person-with-significant-control';
                const normalizedName = psc.name.toLowerCase().trim();
                const nodeId = normalizedName.replace(/\s+/g, '-');

                if (!nodes.find(n => n.label.toLowerCase().trim() === normalizedName)) {
                    nodes.push({
                        id: nodeId,
                        label: psc.name,
                        type: isPerson ? 'individual' : 'corporate',
                        nationality: psc.nationality,
                        country: psc.country_of_residence,
                        control: psc.natures_of_control ? psc.natures_of_control.join(', ') : 'N/A'
                    });
                }

                const existingNode = nodes.find(n => n.label.toLowerCase().trim() === normalizedName);
                const resolvedNodeId = existingNode ? existingNode.id : nodeId;

                const linkExists = links.find(l =>
                    l.source === companyId && l.target === resolvedNodeId
                );
                if (!linkExists) {
                    links.push({ source: companyId, target: resolvedNodeId, label: '75-100%' });
                }

                if (!isPerson) {
                    const searchData = await callAPI(`/search/companies?q=${encodeURIComponent(psc.name)}&items_per_page=1`);
                    if (searchData.items && searchData.items.length > 0) {
                        const corp = searchData.items[0];
                        const corpNodeId = corp.company_number;

                        const existingByName = nodes.find(n => n.label.toLowerCase().trim() === normalizedName);
                        if (existingByName) {
                            existingByName.id = corpNodeId;
                            links.forEach(l => {
                                if (l.source === resolvedNodeId) l.source = corpNodeId;
                                if (l.target === resolvedNodeId) l.target = corpNodeId;
                            });
                        }

                        await trace(corpNodeId, corp.title, depth + 1);
                    }
                }
            }
        } catch (e) {
            console.error('Trace error:', e);
        }
    }

    try {
        const companyData = await callAPI(`/company/${companyNumber}`);
        await trace(companyNumber, companyData.company_name, 0);
        res.json({ nodes, links });
    } catch (e) {
        res.status(500).json({ error: 'Trace failed' });
    }
});

app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});