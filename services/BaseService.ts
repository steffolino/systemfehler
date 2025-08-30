export interface IService {
    configure(config: Record<string, any>): void;
}

export abstract class BaseService implements IService {
    protected config: Record<string, any> = {};
    configure(config: Record<string, any>): void {
        this.config = config;
    }
}
