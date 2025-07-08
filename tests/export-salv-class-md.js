// Export SALV class to markdown file

const { handleGetClass } = require('../dist/handlers/handleGetClass');
const path = require('path');

async function main() {
  try {
    const className = 'CL_SALV_TABLE';
    const filePath = path.join('C:/Users/oleksii_kyslytsia/projects/abap2doc/.cache', `${className}.md`);
    const args = {
      class_name: className,
      filePath
    };
    const result = await handleGetClass(args);
    console.log(`Class ${className} exported to ${filePath}`);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
