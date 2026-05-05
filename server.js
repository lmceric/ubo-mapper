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
            headers: {
                'Authorization': 'Basic ' + auth
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

app.get('/api/search', async (req, res) => {
    const query = req.query.q;
    console.log('Query received:', query);
    try {
        const data = await callAPI(`/search/companies?q=${encodeURIComponent(query)}&items_per_page=5`);
        console.log('API response:', JSON.stringify(data));
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'API call failed' });
    }
});

app.get('/api/psc/:companyNumber', async (req, res) => {
    const { companyNumber } = req.params;
    try {
        const data = await callAPI(`/company/${companyNumber}/persons-with-significant-control`);
        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'API call failed' });
    }
});
// Search company by name and return first match
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
app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});