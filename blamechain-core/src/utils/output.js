function outputSummary({ commits, contributors, todos, evolution }, options = {}) {
    console.log('\nSummary Report:');
    console.log(`- Total commits: ${commits.length}`);
    console.log(`- Contributors: ${contributors ? Object.keys(contributors).length : 0}`);
    console.log(`- TODOs found: ${todos.length}`);

    if (evolution && Object.keys(evolution).length > 0) {
        console.log('\nModule Evolution:');
        Object.entries(evolution).forEach(([file, related]) => {
            if (related.length > 0) {
                console.log(`- ${file} → ${related.join(', ')}`);
            }
        });
    }
}
module.exports = { outputSummary };