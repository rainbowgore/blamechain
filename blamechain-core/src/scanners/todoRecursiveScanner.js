const fs = require('fs');
const path = require('path');

function scanTodosInDir(dirPath) {
    let results = [];

    function walk(currentPath) {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
            const fullPath = path.join(currentPath, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                walk(fullPath);
            } else if (stat.isFile() && /\.(jstsjsxtsx)$/.test(item)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                const lines = content.split('\n');

                lines.forEach((line, idx) => {
                    if (/TODO/i.test(line)) {
                        results.push({
                            file: fullPath,
                            line: idx + 1,
                            text: line.trim(),
                        });
                    }
                });
            }
        }
    }

    walk(dirPath);
    return results;
}

module.exports = { scanTodosInDir };