# Jaysons Dashboard — iPhone PWA

This is a mobile web app that can be installed on iPhone Home Screen.

## 1. Apps Script
Use the duplicate-safe Apps Script from the earlier package and deploy it as a Web App:
- Execute as: Me
- Who has access: Anyone
- Copy the `/exec` URL.

Default URL currently configured:
https://script.google.com/macros/s/AKfycbzwcazUzjP9fk9hMTZFQh95X1ijtBD8sOQFgme3Lh5Zz8r42ckPUWwqFu29RcYKbq-n/exec

If you redeploy with a different URL, open Settings inside the app and replace it.

## 2. Host this PWA
The files must be hosted over HTTPS for the best iPhone installation experience.
Easy options:
- GitHub Pages
- Cloudflare Pages
- Netlify

Upload all files in this folder.

## 3. Install on iPhone
Open the hosted URL in Safari.
Tap Share → Add to Home Screen → Add.

## 4. Data
The app fetches:
- sales
- receipts
- orders

from the Apps Script `doGet()` response and stores the last successful data locally for offline viewing.

## Important
The included URL must point to your deployed duplicate-safe Apps Script version. If the old Apps Script is still deployed, update/redeploy it first.
