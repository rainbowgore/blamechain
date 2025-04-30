function printContributors(authorMap) {
    const sorted = Object.entries(authorMap).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
        console.log('No contributors found.');
        return;
    }

    console.log('\nTop Contributors:');
    sorted.forEach(([author, count]) => {
        console.log(`${author}: ${count} commits`);
    });
}

function printDateRange(commits) {
    const dates = commits.map(c => new Date(c.date));
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));

    console.log(`\nCommit activity spans from ${earliest.toDateString()} to ${latest.toDateString()}`);
}

module.exports = { printContributors, printDateRange };// test line
