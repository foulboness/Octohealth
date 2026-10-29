# Octohealth

Built with HTML, CSS, and vanilla JavaScript.

## Features

- Animated sign-in and sign-up screens with browser-local demo accounts
- Compact dashboard, light/dark appearance, currency preferences, responsive navigation
- PDF and image file selection / drag-and-drop (stores file metadata only; files are not uploaded or retained as file contents)
- Manual bill line-item entry and transparent heuristic checks for possible duplicates, missing descriptions/codes, arithmetic mismatches, generic descriptions, and unusual zero/negative amounts
- Code Checker with search, severity filters, bill filters, verification steps, and review statuses
- My Bills library, Savings Insights, Audit History, Billing Guide, Help & Support
- Editable dispute/query letter generator, copy and `.txt` download
- JSON export of demo data and audit history

## Run locally

1. Extract the project folder.
2. Open `index.html` in a modern browser, or use VS Code's **Live Server** extension.
3. Create a local demo account, or use the optional demo login:
   - Email: `demo@octohealth.ai`
   - Password: `demo1234`
4. Select **Upload a bill**. Choose a PDF or image. This demo records the file name/type/size and does not extract text from the document.
5. In the bill review modal, manually enter the billing code, description, quantity, unit amount (optional), and line total from the itemized bill. The demo runs basic checks and shows verification steps.

## Important limitations

This is a UI and workflow prototype, **not a real AI billing agent**. It does not run OCR, call an LLM, access official CPT/HCPCS/ICD or South African tariff databases, validate code correctness against payer policy, check clinical necessity, submit claims, or contact hospitals. Its simple rules can miss errors and can flag legitimate charges. A code that looks unfamiliar or appears twice is not, by itself, proof of an incorrect charge.

Accounts and review metadata are stored in browser `localStorage`. This is not secure authentication or encrypted health-record storage. Do not enter real patient-identifying information or upload sensitive documents on a shared device. File contents are not uploaded, but filenames and manually entered information are stored locally. Clear the demo data from Settings when finished.

The currency preference changes how amounts are displayed; it does not convert the underlying values. If switching currencies, ensure the bill amounts are entered in the selected currency.

## Suggested production upgrades

- Secure backend authentication, authorization, encrypted storage, retention/deletion controls, and audit logging
- OCR for scanned PDFs/images with user confirmation of extracted text
- Official and properly licensed billing-code sources for the relevant country, payer, and code year
- AI extraction with evidence citations and confidence scores, plus deterministic arithmetic checks
- Provider/payer-specific policies and a human review workflow
- Privacy, legal, security, and healthcare billing review before handling real patient data
