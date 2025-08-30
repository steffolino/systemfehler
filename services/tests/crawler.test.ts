import { CrawlerService } from '../crawler';

describe('CrawlerService', () => {
    it('should configure and crawl without errors', async () => {
        const crawler = new CrawlerService();
        const options = { startUrl: 'https://example.com', maxDepth: 1 };
        await crawler.crawl(options);
        // No assertion here since fetch is not implemented; add mocks as needed.
    });

    // Add more tests for edge cases and configuration as needed.
});
