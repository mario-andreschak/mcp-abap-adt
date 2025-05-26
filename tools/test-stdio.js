#!/usr/bin/env node
// Тестовий скрипт для перевірки MCP stdio-сервера

const { spawn } = require('child_process');
const path = require('path');

// Абсолютний шлях до dist/index.js
const serverPath = path.resolve(__dirname, '../dist/index.js');
const envPath = path.resolve(__dirname, '../.env');

console.log('Запуск MCP сервера через stdio...');

const child = spawn('node', [serverPath, `--env=${envPath}`], {
  stdio: ['pipe', 'pipe', 'pipe']
});

child.stdout.on('data', (data) => {
  process.stdout.write(`[STDOUT] ${data}`);
});

child.stderr.on('data', (data) => {
  process.stderr.write(`[STDERR] ${data}`);
});

child.on('close', (code) => {
  console.log(`MCP сервер завершився з кодом: ${code}`);
});

// Відправити реальний MCP-запит на визначення таблиці T100
function sendGetTableDefinition() {
  const request = {
    method: "GetTable",
    params: {
      name: "table_name",
      arguments:  "T100"
    }
  };
  child.stdin.write(JSON.stringify(request) + "\n");
  console.log("[TEST] Відправлено MCP-запит на визначення T100");
}

// Дати серверу 1 секунду на старт, потім відправити запит
setTimeout(sendGetTableDefinition, 1000);

// Для простого тесту: через 5 секунд завершити процес
setTimeout(() => {
  console.log('Тест завершено, зупиняємо сервер...');
  child.kill();
}, 5000);
