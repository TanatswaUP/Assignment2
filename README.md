# BRICS Development Dashboard

An interactive dashboard comparing BRICS countries using World Bank World Development Indicators (WDI). Built for GMT 320, Assignment 1: Data visualisation and version control.

**Live site:** [your GitHub Pages link]

## Features
- Dashboard with a heading, control bar and visualisation area
- Three charts built with Chart.js: line (trend over time), bar (country ranking) and pie (share of combined value)
- Three summary indicators: average across selected countries, highest-ranked country, and average change over the selected period
- Filters for indicator, start year, end year and countries, which update every chart and summary
- Responsive layout for desktop and mobile

## Data
- **Source:** World Bank, World Development Indicators, https://datacatalog.worldbank.org/search/dataset/0037712/World-Development-Indicators
- **Countries:** [list your BRICS countries]
- **Indicators:** access to electricity (% of population), GDP growth (annual %), GDP per capita (current US$), individuals using the Internet (% of population), life expectancy at birth (years), under-5 mortality rate (per 1,000 live births), secondary school enrolment gender parity index, and unemployment (% of labour force, modelled ILO estimate)
- Missing values are left blank and shown as gaps, not estimated.

## Technologies
HTML, CSS, JavaScript, [Chart.js](https://www.chartjs.org/), [PapaParse](https://www.papaparse.com/)

## Project structure
```
├── index.html
├── css/style.css
├── js/app.js
└── data/wdi_brics.csv
```
