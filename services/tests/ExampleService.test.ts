import { ExampleService } from '../ExampleService';

describe('ExampleService', () => {
    it('should configure correctly', () => {
        const service = new ExampleService();
        service.configure({ foo: 'bar' });
        expect((service as any).config.foo).toBe('bar');
    });

    it('should do something', () => {
        const service = new ExampleService();
        // ...test implementation...
    });
});
