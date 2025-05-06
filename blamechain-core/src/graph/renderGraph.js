function renderGraph(graph = {}) {
    console.log('\nCommit Graph (raw):');
    Object.entries(graph).forEach(([hash, data]) => {
        console.log(`- ${hash.slice(0, 7)}: ${data.author}  ${data.date}`);
    });
}

module.exports = { renderGraph };