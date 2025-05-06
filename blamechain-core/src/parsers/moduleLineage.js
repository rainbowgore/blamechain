const fs = require('fs');
const path = require('path');

function scanFileTree(startPath) {
    const result = [];

    function walk(dir) {
        const files = fs.readdirSync(dir);

        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                walk(fullPath);
            } else if (file.endsWith('.js')) {
                result.push(fullPath);
            }
        }
    }

    walk(startPath);
    return result;
}

module.exports = { scanFileTree };