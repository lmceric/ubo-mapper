// ============ GRAPH STATE ============
let midNodes = [];
let midLinks = [];
let rightNodes = [];
let rightLinks = [];

// ============ EVENT LISTENERS ============
document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('searchBtn').addEventListener('click', () => {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;
        searchCompany(query);
    });

    document.getElementById('searchInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = document.getElementById('searchInput').value.trim();
            if (!query) return;
            searchCompany(query);
        }
    });

    document.getElementById('endSessionBtn').addEventListener('click', () => {
        rightNodes = [];
        rightLinks = [];
        const graphDiv = document.getElementById('right-graph');
        if (graphDiv) graphDiv.innerHTML = '';
        const emptyDiv = document.getElementById('right-empty');
        if (emptyDiv) emptyDiv.style.display = 'block';
    });

    document.getElementById('expandBtn').addEventListener('click', () => {
        const panel = document.getElementById('right-panel');
        const btn = document.getElementById('expandBtn');
        const floatBtn = document.getElementById('floatCloseBtn');
        panel.classList.add('fullscreen');
        btn.style.display = 'none';
        floatBtn.style.display = 'block';
        setTimeout(() => renderRightGraph(), 100);
    });

    document.getElementById('floatCloseBtn').addEventListener('click', () => {
        const panel = document.getElementById('right-panel');
        const btn = document.getElementById('expandBtn');
        const floatBtn = document.getElementById('floatCloseBtn');
        panel.classList.remove('fullscreen');
        btn.style.display = '';
        floatBtn.style.display = 'none';
        setTimeout(() => renderRightGraph(), 100);
    });

});

// ============ SEARCH ============
async function searchCompany(query) {
    midNodes = [];
    midLinks = [];
    const midGraphDiv = document.getElementById('mid-graph');
    if (midGraphDiv) midGraphDiv.innerHTML = '';

    const results = document.getElementById('results');
    results.innerHTML = '<p class="loading">Searching...</p>';

    try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (!data.items || data.items.length === 0) {
            results.innerHTML = '<p class="error">No companies found.</p>';
            return;
        }

        displayCompanies(data.items);

    } catch (error) {
        results.innerHTML = '<p class="error">Error connecting to API.</p>';
        console.error(error);
    }
}

// ============ DISPLAY COMPANIES ============
function displayCompanies(companies) {
    const results = document.getElementById('results');
    results.innerHTML = '';

    companies.forEach(company => {
        const card = document.createElement('div');
        card.className = 'company-card';
        card.innerHTML = `
            <div class="company-name">${company.title}</div>
            <div class="company-meta">No: ${company.company_number} | ${company.company_status || 'N/A'} | ${company.company_type || 'N/A'}</div>
            <div class="company-meta">${company.address_snippet || ''}</div>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.company-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            loadPSC(company.company_number, company.title, card);
        });

        results.appendChild(card);
    });
}

// ============ LOAD PSC ============
async function loadPSC(companyNumber, companyName, card) {
    const existing = card.querySelector('.psc-section');
    if (existing) {
        existing.remove();
        return;
    }

    midNodes = [];
    midLinks = [];

    const pscSection = document.createElement('div');
    pscSection.className = 'psc-section';
    pscSection.dataset.companyId = companyNumber;
    pscSection.innerHTML = '<p class="loading">Loading PSC data...</p>';
    card.appendChild(pscSection);

    try {
        const response = await fetch(`/api/psc/${companyNumber}`);
        const data = await response.json();

       if (!data.items || data.items.length === 0) {
    pscSection.innerHTML = '<p class="error">⚠️ No PSC data found — company may have filed a "no registrable person" statement. Further investigation required.</p>';
}else {
            displayPSC(data.items, pscSection, 1, companyNumber);
        }

        const traceResponse = await fetch(`/api/trace-full/${companyNumber}`);
        const traceData = await traceResponse.json();

        if (traceData.nodes && traceData.nodes.length > 0) {
            midNodes = traceData.nodes.map(n => ({ ...n }));
            midLinks = traceData.links.map(l => ({
                source: midNodes.find(n => n.id === (l.source.id || l.source)),
                target: midNodes.find(n => n.id === (l.target.id || l.target)),
                label: l.label
            })).filter(l => l.source && l.target);

            traceData.nodes.forEach(n => addRightNode(n.id, n.label, n.type));
            traceData.links.forEach(l => {
                const normalizeId = (id) => id.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-').trim();

                const sourceNode = rightNodes.find(n =>
                    n.id === l.source ||
                    normalizeId(n.id) === normalizeId(l.source) ||
                    normalizeId(n.label) === normalizeId(l.source)
                ) || rightNodes.find(n => {
                    const traceNode = traceData.nodes.find(tn => tn.id === l.source);
                    return traceNode && normalizeId(n.label) === normalizeId(traceNode.label);
                });

                const targetNode = rightNodes.find(n =>
                    n.id === l.target ||
                    normalizeId(n.id) === normalizeId(l.target) ||
                    normalizeId(n.label) === normalizeId(l.target)
                ) || rightNodes.find(n => {
                    const traceNode = traceData.nodes.find(tn => tn.id === l.target);
                    return traceNode && normalizeId(n.label) === normalizeId(traceNode.label);
                });

                if (sourceNode && targetNode) {
                    const exists = rightLinks.find(lk =>
                        lk.source.id === sourceNode.id && lk.target.id === targetNode.id
                    );
                    if (!exists) {
                        rightLinks.push({ source: sourceNode, target: targetNode, label: l.label });
                    }
                }
            });
        }

        setTimeout(() => {
            renderMidGraph();
            renderRightGraph();
        }, 500);

    } catch (error) {
        pscSection.innerHTML = '<p class="error">Error loading PSC data.</p>';
        console.error(error);
    }
}

// ============ DISPLAY PSC ============
function displayPSC(pscs, container, layer, parentCompanyId) {
    container.innerHTML = '<strong>Persons with Significant Control (PSC)</strong>';
    const currentLayer = layer || 1;
    const companyId = parentCompanyId || container.dataset.companyId;

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
        const isOffshore = !isPerson && !psc.nationality && !psc.country_of_residence;
        card.innerHTML = `
            <div class="psc-name">${psc.name}</div>
            ${tag}
            <div class="psc-detail">Control: ${natures}</div>
            <div class="psc-detail">Nationality: ${psc.nationality || 'N/A'} | Residence: ${psc.country_of_residence || 'N/A'}</div>
            ${isOffshore ? '<div class="psc-detail" style="color:#e53e3e; margin-top:4px;">⚠️ Non-UK entity — further investigation required</div>' : ''}
        `;

        if (!isPerson && currentLayer < 3) {
            const traceBtn = document.createElement('button');
            traceBtn.className = 'trace-btn';
            traceBtn.textContent = `Trace UBO → (Layer ${currentLayer + 1})`;
            traceBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                traceBtn.textContent = 'Loading...';
                traceBtn.disabled = true;
                traceUBO(psc.name, card, currentLayer + 1, companyId);
            });
            card.appendChild(traceBtn);
        }

        if (isPerson) {
            const uboTag = document.createElement('div');
            uboTag.innerHTML = '<span class="tag tag-ubo">✓ UBO Identified</span>';
            card.appendChild(uboTag);
        }

        const nodeType = isPerson ? 'individual' : 'corporate';
        const nodeId = psc.name.replace(/\s+/g, '-').toLowerCase();

        addMidNode(nodeId, psc.name, nodeType);
        addMidLink(companyId, nodeId, '75-100%');
        addRightNode(nodeId, psc.name, nodeType);
        addRightLink(companyId, nodeId, '75-100%');

        container.appendChild(card);
    });
}

// ============ TRACE UBO ============
async function traceUBO(companyName, parentCard, layer, parentId) {
    const resultDiv = document.createElement('div');
    resultDiv.className = 'trace-result';
    resultDiv.innerHTML = '<p class="loading">Searching...</p>';
    parentCard.appendChild(resultDiv);

    try {
        const response = await fetch(`/api/search-by-name?q=${encodeURIComponent(companyName)}`);
        const data = await response.json();

        if (!data.found || !data.pscs || data.pscs.length === 0) {
            resultDiv.innerHTML = '<p class="error">No PSC data found for this entity.</p>';
            return;
        }

        const corpNodeId = companyName.replace(/\s+/g, '-').toLowerCase();
        resultDiv.dataset.companyId = corpNodeId;
        resultDiv.innerHTML = `<strong>↳ ${data.company_name}</strong>`;
        displayPSC(data.pscs, resultDiv, layer, corpNodeId);

        const activeCard = document.querySelector('.company-card.active');
        const pscSection = activeCard ? activeCard.querySelector('.psc-section') : null;
        const companyNumber = pscSection ? pscSection.dataset.companyId : null;

        if (companyNumber) {
            const traceResponse = await fetch(`/api/trace-full/${companyNumber}`);
            const traceData = await traceResponse.json();

            if (traceData.nodes && traceData.nodes.length > 0) {
                const normalizeId = (id) => id.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-').trim();

                traceData.nodes.forEach(n => addRightNode(n.id, n.label, n.type));
                traceData.links.forEach(l => {
                    const sourceNode = rightNodes.find(n =>
                        n.id === l.source ||
                        normalizeId(n.id) === normalizeId(l.source) ||
                        normalizeId(n.label) === normalizeId(l.source)
                    );
                    const targetNode = rightNodes.find(n =>
                        n.id === l.target ||
                        normalizeId(n.id) === normalizeId(l.target) ||
                        normalizeId(n.label) === normalizeId(l.target)
                    );

                    if (sourceNode && targetNode) {
                        const exists = rightLinks.find(lk =>
                            lk.source.id === sourceNode.id && lk.target.id === targetNode.id
                        );
                        if (!exists) {
                            rightLinks.push({ source: sourceNode, target: targetNode, label: l.label });
                        }
                    }
                });
            }
        }

        setTimeout(() => renderRightGraph(), 100);

    } catch (error) {
        resultDiv.innerHTML = '<p class="error">Error tracing UBO.</p>';
        console.error(error);
    }
}

// ============ MID GRAPH ============
function addMidNode(id, label, type) {
    if (!midNodes.find(n => n.id === id)) {
        midNodes.push({ id, label, type });
    }
}

function addMidLink(sourceId, targetId, label) {
    const sourceNode = midNodes.find(n => n.id === sourceId);
    const targetNode = midNodes.find(n => n.id === targetId);
    if (sourceNode && targetNode) {
        midLinks.push({ source: sourceNode, target: targetNode, label });
    }
}

function renderMidGraph() {
    const graphDiv = document.getElementById('mid-graph');
    const emptyDiv = document.getElementById('mid-empty');
    if (!graphDiv) return;

    graphDiv.innerHTML = '';
    if (emptyDiv) emptyDiv.style.display = 'none';
    if (midNodes.length === 0) return;

    const rect = graphDiv.getBoundingClientRect();
    const width = rect.width || 400;
    const height = rect.height || 500;

    drawGraph(graphDiv, midNodes, midLinks, width, height);
}

// ============ RIGHT GRAPH ============
function addRightNode(id, label, type) {
    const normalizedLabel = label.toLowerCase().trim()
        .replace(/\bMr\.\s*/gi, 'mr ')
        .replace(/\bMrs\.\s*/gi, 'mrs ')
        .replace(/\bMs\.\s*/gi, 'ms ')
        .replace(/\bDr\.\s*/gi, 'dr ')
        .replace(/\s+/g, ' ')
        .trim();

    const existing = rightNodes.find(n => {
        const existingNormalized = n.label.toLowerCase().trim()
            .replace(/\bMr\.\s*/gi, 'mr ')
            .replace(/\bMrs\.\s*/gi, 'mrs ')
            .replace(/\bMs\.\s*/gi, 'ms ')
            .replace(/\bDr\.\s*/gi, 'dr ')
            .replace(/\s+/g, ' ')
            .trim();
        return existingNormalized === normalizedLabel;
    });

    if (!existing) {
        const normalizedId = id.toLowerCase().trim();
        rightNodes.push({ id: normalizedId, label, type });
    } else {
        if (type === 'target' && existing.type !== 'target') {
            existing.type = type;
        }
    }
}

function addRightLink(sourceId, targetId, label) {
    const normalizeId = (id) => id.toLowerCase().trim()
        .replace(/\bmr\.\s*/gi, 'mr ')
        .replace(/\bmrs\.\s*/gi, 'mrs ')
        .replace(/\bms\.\s*/gi, 'ms ')
        .replace(/\bdr\.\s*/gi, 'dr ')
        .replace(/\s+/g, ' ')
        .trim();

    const normSource = normalizeId(sourceId);
    const normTarget = normalizeId(targetId);

    const sourceNode = rightNodes.find(n => normalizeId(n.id) === normSource);
    const targetNode = rightNodes.find(n => normalizeId(n.id) === normTarget);

    if (sourceNode && targetNode) {
        const exists = rightLinks.find(l =>
            normalizeId(l.source.id) === normSource &&
            normalizeId(l.target.id) === normTarget
        );
        if (!exists) {
            rightLinks.push({ source: sourceNode, target: targetNode, label });
        }
    }
}

function renderRightGraph() {
    const graphDiv = document.getElementById('right-graph');
    const emptyDiv = document.getElementById('right-empty');
    if (!graphDiv) return;

    graphDiv.innerHTML = '';
    if (emptyDiv) emptyDiv.style.display = 'none';
    if (rightNodes.length === 0) return;

    const rect = graphDiv.getBoundingClientRect();
    const width = rect.width || 400;
    const height = rect.height || 500;

    drawGraph(graphDiv, rightNodes, rightLinks, width, height);
}

// ============ DRAW GRAPH ============
function drawGraph(graphDiv, nodes, links, width, height) {
    if (nodes.length === 0) return;

const nodeColors = {
    target: '#2c5f8a',
    corporate: '#c05621',
    individual: '#276749',
    offshore: '#718096',
    unknown: '#718096'
};

    
    const svg = d3.select(graphDiv)
        .append('svg')
        .attr('width', width)
        .attr('height', height);

    svg.append('defs').append('marker')
        .attr('id', 'arrow-' + graphDiv.id)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 38)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#a0aec0');

    const container = graphDiv.id === 'right-graph'
        ? svg.append('g').attr('class', 'zoom-group')
        : svg.append('g');

    if (graphDiv.id === 'right-graph') {
        const zoom = d3.zoom()
            .scaleExtent([0.2, 3])
            .on('zoom', (event) => {
                container.attr('transform', event.transform);
            });
        svg.call(zoom);
    }

    const nodesCopy = nodes.map(n => ({ ...n }));
    const linksCopy = links.map(l => ({
        source: nodesCopy.find(n => n.id === (l.source.id || l.source)),
        target: nodesCopy.find(n => n.id === (l.target.id || l.target)),
        label: l.label
    })).filter(l => l.source && l.target);

    nodesCopy.forEach((node, i) => {
        node.x = width / 2 + (Math.random() - 0.5) * 150;
        node.y = (i + 1) * (height / (nodesCopy.length + 1));
    });

    const simulation = d3.forceSimulation(nodesCopy)
        .force('link', d3.forceLink(linksCopy).distance(120))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(45));

    const link = container.append('g')
        .selectAll('line')
        .data(linksCopy)
        .enter().append('line')
        .attr('stroke', '#a0aec0')
        .attr('stroke-width', 1.5)
        .attr('marker-end', `url(#arrow-${graphDiv.id})`);

    const linkLabel = container.append('g')
        .selectAll('text')
        .data(linksCopy)
        .enter().append('text')
        .attr('font-size', 9)
        .attr('fill', '#a0aec0')
        .attr('text-anchor', 'middle')
        .text(d => d.label);

    const node = container.append('g')
        .selectAll('g')
        .data(nodesCopy)
        .enter().append('g')
        .call(d3.drag()
            .on('start', (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x; d.fy = d.y;
            })
            .on('drag', (event, d) => {
                d.fx = event.x; d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null; d.fy = null;
            }));

    node.append('circle')
        .attr('r', 35)
        .attr('fill', d => nodeColors[d.type] || nodeColors.unknown)
        .attr('stroke', 'white')
        .attr('stroke-width', 2);

    node.append('text')
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-size', 9)
        .attr('font-weight', 'bold')
        .each(function(d) {
            const words = d.label.split(' ');
            const lines = [];
            let current = '';
            words.forEach(w => {
                if ((current + ' ' + w).trim().length > 11) {
                    if (current) lines.push(current);
                    current = w;
                } else {
                    current = (current + ' ' + w).trim();
                }
            });
            if (current) lines.push(current);

            const el = d3.select(this);
            el.text('');
            const maxLines = lines.slice(0, 4);
            maxLines.forEach((line, i) => {
                el.append('tspan')
                    .attr('x', 0)
                    .attr('dy', i === 0 ? `${-(maxLines.length - 1) * 7}px` : '14px')
                    .text(line);
            });
        });

    node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', 48)
        .attr('font-size', 9)
        .attr('fill', '#718096')
        .text(d => {
            if (d.type === 'target') return '🔵 Target';
            if (d.type === 'corporate') return '🟠 Corporate';
            if (d.type === 'individual') return '🟢 UBO';
            return '';
        });

    simulation.on('tick', () => {
        if (graphDiv.id !== 'right-graph') {
            nodesCopy.forEach(d => {
                d.x = Math.max(40, Math.min(width - 40, d.x));
                d.y = Math.max(40, Math.min(height - 40, d.y));
            });
        }

        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        linkLabel
            .attr('x', d => (d.source.x + d.target.x) / 2)
            .attr('y', d => (d.source.y + d.target.y) / 2 - 6);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
    });
}