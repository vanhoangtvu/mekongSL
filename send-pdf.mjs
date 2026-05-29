#!/usr/bin/env node
/**
 * Send PDF report via Zalo Bot to admin
 * Usage: node send-pdf.mjs <path-to-pdf>
 */
import { Zalo, ThreadType } from 'zca-js';
import fs from 'fs';
import path from 'path';

const CREDENTIALS_PATH = '/home/hv/DuAn/zalo_bot/credentials.json';
const ADMIN_ID = '2209575191698846370';

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error('Usage: node send-pdf.mjs <path-to-pdf>');
    process.exit(1);
  }

  if (!fs.existsSync(pdfPath)) {
    console.error(`File not found: ${pdfPath}`);
    process.exit(1);
  }

  const pdfStat = fs.statSync(pdfPath);
  const pdfSizeMB = (pdfStat.size / 1024 / 1024).toFixed(2);
  console.log(`PDF file: ${pdfPath} (${pdfSizeMB} MB)`);

  // Load credentials
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error(`Credentials not found: ${CREDENTIALS_PATH}`);
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  if (!credentials.imei || !credentials.cookie || !credentials.userAgent) {
    console.error('Invalid credentials file');
    process.exit(1);
  }

  console.log('Logging in to Zalo...');
  const zalo = new Zalo({ selfListen: false, logging: false });

  try {
    const api = await zalo.login(credentials);
    const myInfo = await api.fetchAccountInfo();
    console.log(`Logged in as: ${myInfo.name} (${myInfo.uid})`);

    // Send text message first
    console.log('Sending text notification...');
    await api.sendMessage(
      {
        msg: `📄 *BÁO CÁO CẤU TRÚC S3 & ĐỀ XUẤT TỐI ƯU*\n\n` +
             `Xin gửi đến admin file báo cáo phân tích cấu trúc S3 hiện tại và đề xuất tối ưu.\n` +
             `📁 File: BaoCao_CauTrucS3_DeXuat.pdf\n` +
             `📏 Dung lượng: ${pdfSizeMB} MB\n` +
             `🕐 ${new Date().toLocaleString('vi-VN')}`,
      },
      ADMIN_ID,
      ThreadType.User
    );
    console.log('Text notification sent!');

    // Wait a bit
    await new Promise(r => setTimeout(r, 1500));

    // Send the PDF file
    console.log('Sending PDF file...');
    const result = await api.sendMessage(
      {
        msg: '📎 File báo cáo đính kèm:',
        attachments: [pdfPath],
      },
      ADMIN_ID,
      ThreadType.User
    );
    console.log('PDF file sent successfully!');
    console.log('Result:', JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
