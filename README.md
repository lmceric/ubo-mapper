# UBO Mapper
## Live Demo
👉 https://ubo-mapper-production.up.railway.app/

A KYC tool that automatically maps UK company ownership structures using the Companies House public API.

## What it does

In KYC work, tracing beneficial ownership manually is slow. You open Companies House, find the PSC, that PSC is another company, so you open that company, find its PSC, repeat — then draw it all out somewhere.

UBO Mapper automates this process:

- Search any UK company by name, number, or postcode
- Automatically traces PSC chains through corporate layers until it finds individuals or listed companies
- Draws the ownership structure as an interactive diagram
- Builds a cumulative map across multiple companies — useful for spotting shared UBOs

## Screenshots

![UBO Mapper Screenshot](screenshot.png)

## Tech stack

- Node.js + Express (backend proxy server)
- Companies House REST API (public data)
- D3.js (ownership structure visualisation)
- Vanilla JavaScript / HTML / CSS

## Setup

**Prerequisites:** Node.js installed

**1. Clone the repo**
```bash
git clone https://github.com/lmceric/ubo-mapper.git
cd ubo-mapper
```

**2. Install dependencies**
```bash
npm install
```

**3. Get a Companies House API key**

Register free at https://developer.company-information.service.gov.uk

**4. Create a `.env` file**
**5. Start the server**
```bash
node server.js
```

**6. Open in browser**
http://localhost:3000

## How to use

1. Enter a company name, number, or postcode in the search bar
2. Click any company in the results to view its ownership structure
3. The middle panel shows the current company's UBO chain
4. The right panel accumulates all searched companies — shared UBOs appear automatically
5. Use scroll to zoom in/out on the cumulative map
6. Click **End Session** to clear the cumulative map

## Data and compliance

All data is sourced from the Companies House public register. This tool is for research purposes only. Always verify with official sources before making compliance decisions.

No data is stored. All queries are made in real time directly to the Companies House API.

## Limitations

- Only covers UK companies registered at Companies House
- PSC data accuracy depends on what companies have filed
- Listed companies are exempt from PSC requirements and will show as end nodes
- Overseas entities may not be traceable beyond the first layer

## Author

Eric Chu — KYC/AML compliance professional based in the UK

[LinkedIn](https://www.linkedin.com/in/ericchu729)

---

*Built as a portfolio project to demonstrate the intersection of KYC domain knowledge and technical implementation.*