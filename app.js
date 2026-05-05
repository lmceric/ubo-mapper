const BASE_URL = '';


// Search button click
document.getElementById('searchBtn').addEventListener('click', () => {
    const query = document.getElementById('searchInput').value.trim();
    if (!query) return;
    searchCompany(query);
});

// Allow Enter key to search
document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;
        searchCompany(query);
    }
});

// Step 1: Search company by name
async function searchCompany(query) {
    const results = document.getElementById('results');
    results.innerHTML = '<p class="loading">Searching...</p>';

    try {
        const response = await fetch(
    `/api/search?q=${encodeURIComponent(query)}`
);

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            results.innerHTML = '<p class="error">No companies found.</p>';
            return;
        }

        displayCompanies(data.items);

    } catch (error) {
        results.innerHTML = '<p class="error">Error connecting to Companies House API.</p>';
        console.error(error);
    }
}

// Step 2: Display company list
function displayCompanies(companies) {
    const results = document.getElementById('results');
    results.innerHTML = '';

    companies.forEach(company => {
        const card = document.createElement('div');
        card.className = 'company-card';
        card.innerHTML = `
            <div class="company-name">${company.title}</div>
            <div class="company-meta">
                Company No: ${company.company_number} &nbsp;|&nbsp;
                Status: ${company.company_status || 'N/A'} &nbsp;|&nbsp;
                Type: ${company.company_type || 'N/A'}
            </div>
            <div class="company-meta">
                ${company.address_snippet || ''}
            </div>
        `;

        // Click to load PSC
        card.addEventListener('click', () => {
            loadPSC(company.company_number, company.title, card);
        });

        results.appendChild(card);
    });
}

// Step 3: Load PSC data for selected company
async function loadPSC(companyNumber, companyName, card) {
    // Remove any existing PSC section
    const existing = card.querySelector('.psc-section');
    if (existing) {
        existing.remove();
        return;
    }

    const pscSection = document.createElement('div');
    pscSection.className = 'psc-section';
    pscSection.innerHTML = '<p class="loading">Loading PSC data...</p>';
    card.appendChild(pscSection);

    try {
       const response = await fetch(
    `/api/psc/${companyNumber}`
);

        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            pscSection.innerHTML = '<p class="error">No PSC data found.</p>';
            return;
        }

        displayPSC(data.items, pscSection);

    } catch (error) {
        pscSection.innerHTML = '<p class="error">Error loading PSC data.</p>';
        console.error(error);
    }
}

// Step 4: Display PSC list
function displayPSC(pscs, container, layer) {
    container.innerHTML = '<strong>Persons with Significant Control (PSC)</strong>';
    const currentLayer = layer || 1;

    pscs.forEach(psc => {
        const isPerson = psc.kind === 'individual-person-with-significant-control';
        const tag = isPerson
            ? '<span class="tag tag-person">Individual</span>'
            : '<span class="tag tag-corporate">Corporate</span>';

        const natures = psc.natures_of_control
            ? psc.natures_of_control.join(', ')
            : 'N/A';

        const card = document.createElement('div');
        card.className = 'psc-card';
        card.innerHTML = `
            <div class="psc-name">${psc.name}</div>
            ${tag}
            <div class="psc-detail">Nature of Control: ${natures}</div>
            <div class="psc-detail">Nationality: ${psc.nationality || 'N/A'}</div>
            <div class="psc-detail">Country of Residence: ${psc.country_of_residence || 'N/A'}</div>
        `;

 

       // If Corporate and within 2 layers, show Trace UBO button
        if (!isPerson && currentLayer < 3) {
            const traceBtn = document.createElement('button');
            traceBtn.className = 'trace-btn';
            traceBtn.textContent = `Trace UBO → (Layer ${currentLayer + 1})`;
         traceBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    traceBtn.textContent = 'Loading...';
    traceBtn.disabled = true;
    traceUBO(psc.name, card, currentLayer + 1);
});
            card.appendChild(traceBtn);
        }

        if (isPerson) {
            const uboTag = document.createElement('div');
            uboTag.innerHTML = '<span class="tag tag-ubo">✓ UBO Identified</span>';
            card.appendChild(uboTag);
        }

        container.appendChild(card);
    });
}

async function traceUBO(companyName, parentCard, layer) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'trace-result';
    resultDiv.innerHTML = '<p class="loading">Searching...</p>';
    parentCard.appendChild(resultDiv);

    try {
        const response = await fetch(
            `/api/search-by-name?q=${encodeURIComponent(companyName)}`
        );
        const data = await response.json();

        if (!data.found || !data.pscs || data.pscs.length === 0) {
            resultDiv.innerHTML = '<p class="error">No PSC data found for this entity.</p>';
            return;
        }

        resultDiv.innerHTML = `<strong>↳ ${data.company_name}</strong>`;
        displayPSC(data.pscs, resultDiv, layer);

    } catch (error) {
        resultDiv.innerHTML = '<p class="error">Error tracing UBO.</p>';
        console.error(error);
    }
}