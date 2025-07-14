const { getAllTools } = require('./dist/lib/toolsRegistry.js');

try {
  const tools = getAllTools();
  console.log('Загальна кількість інструментів:', tools.length);
  
  tools.forEach((tool, index) => {
    if (!tool) {
      console.log(`Інструмент ${index} є null/undefined`);
    } else if (!tool.name) {
      console.log(`Інструмент ${index} не має властивості name:`, JSON.stringify(tool, null, 2));
    } else {
      console.log(`${index}: ${tool.name}`);
    }
  });
  
  console.log('\n✅ Усі інструменти успішно завантажені!');
  console.log('📊 Статистика:');
  console.log(`   - Загальна кількість: ${tools.length}`);
  console.log(`   - Успішно завантажені: ${tools.filter(t => t && t.name).length}`);
  console.log(`   - Проблемні: ${tools.filter(t => !t || !t.name).length}`);
  
  // Явно завершуємо процес
  process.exit(0);
} catch (error) {
  console.error('❌ Помилка при завантаженні інструментів:', error.message);
  process.exit(1);
}
