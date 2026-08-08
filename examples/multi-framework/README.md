# Multi-Framework Examples

Real-world-inspired example result files for every supported input format.
**No real customer data** — all names, URLs, and identifiers are fake placeholders.

## Files

| File | Format | Framework | Tests |
|------|--------|-----------|-------|
| `cypress-junit.xml` | JUnit XML | Cypress | 12 (Auth, Cart, API) |
| `dotnet-trx.trx` | TRX | MSTest / VSTest (.NET + RestSharp) | 6 (Math, API, RestSharp) |
| `postman-newman.json` | Newman JSON | Postman / Newman | 6 (E-Commerce API) |
| `selenium-generic.json` | Generic JSON | Selenium | 8 (Login, Nav, Search, Cart, Checkout) |
| `soapui-junit.xml` | JUnit XML | SoapUI | 9 (SOAP, REST, Security) |

## Generate reports from these examples

```bash
# Build the project first
npm run build

# Generate all example reports + screenshots
node scripts/generate-examples.js
```

Or generate individual reports:

```bash
# Cypress
npx evoveo-smart-reporter generate --input examples/multi-framework/cypress-junit.xml --output examples/multi-framework/reports/cypress-report.html --framework "Cypress" --title "Cypress E2E Tests"

# .NET / TRX
npx evoveo-smart-reporter generate --input examples/multi-framework/dotnet-trx.trx --output examples/multi-framework/reports/dotnet-trx-report.html --framework "MSTest (TRX)" --title ".NET Test Results"

# Postman / Newman
npx evoveo-smart-reporter generate --input examples/multi-framework/postman-newman.json --format newman --output examples/multi-framework/reports/newman-report.html --title "Postman API Tests"

# Selenium (generic JSON)
npx evoveo-smart-reporter generate --input examples/multi-framework/selenium-generic.json --format json --output examples/multi-framework/reports/selenium-report.html --title "Selenium Web Tests"

# SoapUI
npx evoveo-smart-reporter generate --input examples/multi-framework/soapui-junit.xml --output examples/multi-framework/reports/soapui-report.html --framework "SoapUI" --title "SoapUI Service Tests"
```

Generated reports are saved to `reports/`. Open any `.html` file in a browser.
