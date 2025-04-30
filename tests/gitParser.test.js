const path = require('path');
const { analyzeFileHistory } = require('../src/parsers/gitParser');

describe('analyzeFileHistory', () => {
    it('returns commit history and contributors for a valid file', async () => {
        const testPath = path.resolve(__dirname, '../src/utils/format.js');
        const result = await analyzeFileHistory(testPath);
        expect(result).toHaveProperty('commits');
        expect(result).toHaveProperty('contributors');
    });
});