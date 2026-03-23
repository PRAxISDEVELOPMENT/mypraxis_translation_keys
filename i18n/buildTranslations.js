const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'translations.json');
const outputDir = path.join(__dirname, 'generated');

const entries = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const locales = ['nl', 'fr', 'en'];

function setNestedValue(obj, key, value) {
    const parts = key.split('.');
    let current = obj;

    for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i];

        if (i === parts.length - 1) {
            current[part] = value;
            return;
        }

        if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {};
        }

        current = current[part];
    }
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

for (const locale of locales) {
    const result = {};

    for (const entry of entries) {
        const value = entry[locale] ?? entry.en ?? '';
        setNestedValue(result, entry.key, value);
    }

    fs.writeFileSync(
        path.join(outputDir, `${locale}.json`),
        JSON.stringify(result, null, 2) + '\n',
        'utf8'
    );
}

console.log('Translations generated successfully.');