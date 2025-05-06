const fs = require('fs');
const path = require('path');

function scanTodosRecursively(startDir) {
    const todos = [];

    function walk(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile() && /\.(jstsjsxtsx)$/.test(entry.name)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                const lines = content.split('\n');

                lines.forEach((line, i) => {
                    if (line.includes('TODO')) {
                        todos.push({
                            file: fullPath,
                            line: i + 1,
                            text: line.trim()
                        });
                    }
                });
            }
        }
    }

    walk(startDir);
    return todos;
}

module.exports = { scanTodosRecursively };