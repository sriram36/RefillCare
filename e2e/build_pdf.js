/**
 * Converts docs/TDD.md to TDD.pdf via Chrome Headless
 * and creates submission.zip containing exactly TDD.pdf and deployment.md
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('../frontend/node_modules/marked');
const puppeteer = require('../frontend/node_modules/puppeteer-core');
const { execSync } = require('child_process');

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TDD_MD = path.join(__dirname, '..', 'docs', 'TDD.md');
const TDD_PDF = path.join(__dirname, '..', 'TDD.pdf');
const DOCS_TDD_PDF = path.join(__dirname, '..', 'docs', 'TDD.pdf');
const DEPLOY_MD = path.join(__dirname, '..', 'docs', 'deployment.md');
const SUBMISSION_ZIP = path.join(__dirname, '..', 'submission.zip');

async function generatePdf() {
  console.log('1. Reading docs/TDD.md...');
  const mdContent = fs.readFileSync(TDD_MD, 'utf-8');
  const htmlBody = marked.parse(mdContent);

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>RefillCare: Technical Design Document</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
      @bottom-right {
        content: counter(page);
        font-size: 9pt;
        color: #64748b;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.5;
      color: #0f172a;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 18pt;
      font-weight: 800;
      color: #0f766e;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 6px;
      margin-top: 0;
      margin-bottom: 12px;
    }
    h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #1e293b;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-top: 18px;
      margin-bottom: 8px;
      page-break-after: avoid;
    }
    h3 {
      font-size: 11pt;
      font-weight: 700;
      color: #334155;
      margin-top: 14px;
      margin-bottom: 6px;
      page-break-after: avoid;
    }
    p, ul, ol {
      margin-top: 0;
      margin-bottom: 8px;
    }
    li {
      margin-bottom: 4px;
    }
    a {
      color: #0f766e;
      text-decoration: none;
      font-weight: 600;
    }
    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 14px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin: 10px 0 14px 0;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background-color: #f1f5f9;
      font-weight: 700;
      color: #1e293b;
    }
    tr:nth-child(even) td {
      background-color: #f8fafc;
    }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8.5pt;
      background-color: #f1f5f9;
      padding: 2px 4px;
      border-radius: 4px;
      color: #0f766e;
      border: 1px solid #e2e8f0;
    }
    pre {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 8.5pt;
      line-height: 1.4;
      overflow-x: auto;
      page-break-inside: avoid;
      margin: 8px 0 12px 0;
    }
    pre code {
      background: none;
      border: none;
      padding: 0;
    }
    blockquote {
      border-left: 3px solid #0f766e;
      padding-left: 10px;
      margin-left: 0;
      color: #475569;
    }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>
  `;

  console.log('2. Launching Chrome to render PDF...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'networkidle0' });

  console.log('3. Printing PDF to TDD.pdf...');
  await page.pdf({
    path: TDD_PDF,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '18mm',
      bottom: '18mm',
      left: '16mm',
      right: '16mm'
    }
  });

  fs.copyFileSync(TDD_PDF, DOCS_TDD_PDF);
  await browser.close();

  const stats = fs.statSync(TDD_PDF);
  console.log(`✓ TDD.pdf generated successfully (${(stats.size / 1024).toFixed(1)} KB)`);
}

function buildSubmissionZip() {
  console.log('\n4. Creating submission.zip with TDD.pdf and deployment.md...');
  const stagingDir = path.join(__dirname, '..', '.submission_staging');
  if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true });
  fs.mkdirSync(stagingDir);

  // Copy exactly TDD.pdf and deployment.md
  fs.copyFileSync(TDD_PDF, path.join(stagingDir, 'TDD.pdf'));
  fs.copyFileSync(DEPLOY_MD, path.join(stagingDir, 'deployment.md'));

  // Remove existing zip if present
  if (fs.existsSync(SUBMISSION_ZIP)) fs.unlinkSync(SUBMISSION_ZIP);

  // Use PowerShell Compress-Archive on Windows
  const cmd = `Compress-Archive -Path "${stagingDir}\\*" -DestinationPath "${SUBMISSION_ZIP}" -Force`;
  execSync(`powershell.exe -Command "${cmd}"`);

  // Clean staging
  fs.rmSync(stagingDir, { recursive: true });

  const zipStats = fs.statSync(SUBMISSION_ZIP);
  const sizeMb = zipStats.size / (1024 * 1024);
  console.log(`✓ submission.zip created at: ${SUBMISSION_ZIP}`);
  console.log(`  Size: ${sizeMb.toFixed(2)} MB (Limit: < 25 MB)`);

  if (sizeMb >= 25) {
    throw new Error('submission.zip exceeds 25 MB limit!');
  }
}

async function main() {
  await generatePdf();
  buildSubmissionZip();
  console.log('\n======================================================');
  console.log('Step 6 Complete: TDD.pdf and submission.zip generated!');
  console.log('======================================================');
}

main().catch(err => {
  console.error('Fatal error building PDF and submission package:', err);
  process.exit(1);
});
